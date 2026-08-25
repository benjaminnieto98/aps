const express = require('express');
const { pool, withTransaction } = require('../db');
const { authenticate } = require('../middleware/auth');
const { logTransfer } = require('../transfers');

const router = express.Router();

// GET /api/clause-offers/all  — public feed of all offers (paginated)
router.get('/all', authenticate, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);
  const status = req.query.status || '';   // optional filter

  try {
    const where  = status ? `WHERE status = $3` : '';
    const params = status ? [limit, offset, status] : [limit, offset];

    const [rowsRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, player_id, player_name, player_rating, player_position,
                buyer_id, buyer_username, owner_id, owner_username,
                clause_amount, new_clause_amount, status, offer_type, created_at, resolved_at
         FROM clause_offers
         ${where}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int as total FROM clause_offers ${where}`,
        status ? [status] : []
      ),
    ]);

    res.json({ total: countRes.rows[0].total, offers: rowsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/clause-offers/received
router.get('/received', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM clause_offers WHERE owner_id = $1 AND status = 'pending' ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/clause-offers/sent
router.get('/sent', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM clause_offers WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/clause-offers/:id/accept
router.post('/:id/accept', authenticate, async (req, res) => {
  const offerId = parseInt(req.params.id, 10);

  try {
    const { rows: offerRows } = await pool.query(
      'SELECT * FROM clause_offers WHERE id = $1', [offerId]
    );
    if (!offerRows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    const offer = offerRows[0];

    if (offer.owner_id !== req.user.id) return res.status(403).json({ error: 'No sos el dueño del jugador' });
    if (offer.status !== 'pending') return res.status(400).json({ error: 'La oferta ya fue resuelta' });

    const { rows: playerRows } = await pool.query('SELECT * FROM players WHERE id = $1', [offer.player_id]);
    if (!playerRows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    const player = playerRows[0];
    if (player.owner_id !== req.user.id) return res.status(403).json({ error: 'Ya no sos el dueño del jugador' });

    const { rows: buyerRows } = await pool.query('SELECT * FROM users WHERE id = $1', [offer.buyer_id]);
    if (!buyerRows[0]) return res.status(400).json({ error: 'El comprador ya no existe' });
    const buyer = buyerRows[0];
    if (buyer.budget < offer.clause_amount) {
      return res.status(400).json({ error: 'El comprador ya no tiene presupuesto suficiente' });
    }

    const { rows: cfgMin } = await pool.query("SELECT value FROM config WHERE key = 'min_roster'");
    const minRoster = cfgMin[0] ? parseInt(cfgMin[0].value, 10) : 18;
    const { rows: sellerCnt } = await pool.query(
      'SELECT COUNT(*)::int as cnt FROM players WHERE owner_id = $1', [req.user.id]
    );
    if (sellerCnt[0].cnt <= minRoster) {
      return res.status(400).json({ error: `No podés quedar con menos de ${minRoster} jugadores` });
    }

    const { rows: cfgMax } = await pool.query("SELECT value FROM config WHERE key = 'max_roster'");
    const maxRoster = cfgMax[0] ? parseInt(cfgMax[0].value, 10) : 22;
    const { rows: buyerCnt } = await pool.query(
      'SELECT COUNT(*)::int as cnt FROM players WHERE owner_id = $1', [buyer.id]
    );
    if (buyerCnt[0].cnt >= maxRoster) {
      return res.status(400).json({ error: 'El comprador ya tiene el plantel lleno' });
    }

    const { rows: ownerRows } = await pool.query(
      'SELECT id, username FROM users WHERE id = $1', [req.user.id]
    );
    const owner = ownerRows[0];
    const now = Date.now();

    const nextOverride = Math.round(offer.clause_amount * 1.1);

    await withTransaction(async (client) => {
      // Claim the offer atomically — prevents double-execution on rapid double-click
      const { rows: claimed } = await client.query(
        "UPDATE clause_offers SET status = 'accepted', resolved_at = $1 WHERE id = $2 AND status = 'pending' RETURNING id",
        [now, offerId]
      );
      if (claimed.length === 0) throw Object.assign(new Error('La oferta ya fue procesada'), { status: 409 });

      await client.query('UPDATE users SET budget = budget - $1 WHERE id = $2', [offer.clause_amount, buyer.id]);
      await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [offer.clause_amount, req.user.id]);
      await client.query(
        'UPDATE players SET owner_id = $1, listed_price = NULL, release_clause = NULL, purchase_count = purchase_count + 1, price_override = $3 WHERE id = $2',
        [buyer.id, offer.player_id, nextOverride]
      );
      await client.query(
        "UPDATE clause_offers SET status = 'rejected', resolved_at = $1 WHERE player_id = $2 AND id != $3 AND status = 'pending'",
        [now, offer.player_id, offerId]
      );
      await logTransfer({ type: 'compra', player, from: owner, to: buyer, price: offer.clause_amount, _client: client });
    });

    res.json({ success: true });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/clause-offers/:id/raise  { newAmount }
router.post('/:id/raise', authenticate, async (req, res) => {
  const offerId = parseInt(req.params.id, 10);
  const { newAmount } = req.body;

  if (!newAmount || !Number.isInteger(Number(newAmount)) || Number(newAmount) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número entero positivo' });
  }

  try {
    const { rows: offerRows } = await pool.query('SELECT * FROM clause_offers WHERE id = $1', [offerId]);
    if (!offerRows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    const offer = offerRows[0];

    if (offer.owner_id !== req.user.id) return res.status(403).json({ error: 'No sos el dueño del jugador' });
    if (offer.status !== 'pending') return res.status(400).json({ error: 'La oferta ya fue resuelta' });
    if (offer.offer_type === 'offer') return res.status(400).json({ error: 'Solo podés aceptar o rechazar una oferta directa' });

    const MIN_RAISE = 1_000_000;
    const newAmt = parseInt(newAmount, 10);
    if (newAmt < offer.clause_amount + MIN_RAISE) {
      return res.status(400).json({
        error: `La nueva cláusula debe ser al menos ${(offer.clause_amount + MIN_RAISE).toLocaleString()} (mínimo +1.000.000)`
      });
    }

    const { rows: ownerRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const owner = ownerRows[0];
    const diff = newAmt - offer.clause_amount;
    if (owner.budget < diff) {
      return res.status(400).json({
        error: `Presupuesto insuficiente para subir la cláusula (necesitás ${diff.toLocaleString()})`
      });
    }

    const { rows: playerRows } = await pool.query('SELECT * FROM players WHERE id = $1', [offer.player_id]);
    if (!playerRows[0] || playerRows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Ya no sos el dueño del jugador' });
    }

    const now = Date.now();

    await withTransaction(async (client) => {
      await client.query('UPDATE users SET budget = budget - $1 WHERE id = $2', [diff, req.user.id]);
      // Raise also anchors the base value (price_override) so the boost persists through swaps
      await client.query(
        'UPDATE players SET release_clause = $1, price_override = $1, raised_count = COALESCE(raised_count, 0) + 1 WHERE id = $2',
        [newAmt, offer.player_id]
      );
      await client.query(
        "UPDATE clause_offers SET status = 'raised', new_clause_amount = $1, resolved_at = $2 WHERE id = $3",
        [newAmt, now, offerId]
      );
      await client.query(
        "UPDATE clause_offers SET status = 'rejected', resolved_at = $1 WHERE player_id = $2 AND status = 'pending'",
        [now, offer.player_id]
      );
    });

    res.json({ success: true, newClause: newAmt, paid: diff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/clause-offers/:id/reject
router.post('/:id/reject', authenticate, async (req, res) => {
  const offerId = parseInt(req.params.id, 10);

  try {
    const { rows: offerRows } = await pool.query('SELECT * FROM clause_offers WHERE id = $1', [offerId]);
    if (!offerRows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    const offer = offerRows[0];

    if (offer.owner_id !== req.user.id) return res.status(403).json({ error: 'No sos el dueño del jugador' });
    if (offer.status !== 'pending') return res.status(400).json({ error: 'La oferta ya fue resuelta' });

    await pool.query(
      "UPDATE clause_offers SET status = 'rejected', resolved_at = $1 WHERE id = $2",
      [Date.now(), offerId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/clause-offers/:id/accept-raised — buyer pays the raised clause amount
router.post('/:id/accept-raised', authenticate, async (req, res) => {
  const offerId = parseInt(req.params.id, 10);

  try {
    const { rows: offerRows } = await pool.query('SELECT * FROM clause_offers WHERE id = $1', [offerId]);
    if (!offerRows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    const offer = offerRows[0];

    if (offer.buyer_id !== req.user.id) return res.status(403).json({ error: 'No sos el comprador de esta oferta' });
    if (offer.status !== 'raised') return res.status(400).json({ error: 'La oferta no está en estado "subida"' });
    if (!offer.new_clause_amount) return res.status(400).json({ error: 'No hay monto nuevo definido' });

    const { rows: playerRows } = await pool.query('SELECT * FROM players WHERE id = $1', [offer.player_id]);
    if (!playerRows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    const player = playerRows[0];
    if (player.owner_id !== offer.owner_id) return res.status(400).json({ error: 'El jugador ya cambió de dueño' });

    const { rows: buyerRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const buyer = buyerRows[0];
    if (buyer.budget < offer.new_clause_amount) {
      return res.status(400).json({ error: 'Presupuesto insuficiente para pagar la cláusula aumentada' });
    }

    const { rows: cfgMin } = await pool.query("SELECT value FROM config WHERE key = 'min_roster'");
    const minRoster = cfgMin[0] ? parseInt(cfgMin[0].value, 10) : 18;
    const { rows: sellerCnt } = await pool.query(
      'SELECT COUNT(*)::int as cnt FROM players WHERE owner_id = $1', [offer.owner_id]
    );
    if (sellerCnt[0].cnt <= minRoster) {
      return res.status(400).json({ error: `El vendedor no puede quedar con menos de ${minRoster} jugadores` });
    }

    const { rows: cfgMax } = await pool.query("SELECT value FROM config WHERE key = 'max_roster'");
    const maxRoster = cfgMax[0] ? parseInt(cfgMax[0].value, 10) : 22;
    const { rows: buyerCnt } = await pool.query(
      'SELECT COUNT(*)::int as cnt FROM players WHERE owner_id = $1', [req.user.id]
    );
    if (buyerCnt[0].cnt >= maxRoster) {
      return res.status(400).json({ error: 'Ya tenés el plantel lleno' });
    }

    const { rows: ownerRows } = await pool.query('SELECT id, username FROM users WHERE id = $1', [offer.owner_id]);
    const owner = ownerRows[0];
    const now = Date.now();

    const nextOverride = Math.round(offer.new_clause_amount * 1.1);

    await withTransaction(async (client) => {
      // Claim the offer atomically — prevents double-execution on rapid double-click
      const { rows: claimed } = await client.query(
        "UPDATE clause_offers SET status = 'accepted', resolved_at = $1 WHERE id = $2 AND status = 'raised' RETURNING id",
        [now, offerId]
      );
      if (claimed.length === 0) throw Object.assign(new Error('La oferta ya fue procesada'), { status: 409 });

      await client.query('UPDATE users SET budget = budget - $1 WHERE id = $2', [offer.new_clause_amount, req.user.id]);
      await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [offer.new_clause_amount, offer.owner_id]);
      await client.query(
        'UPDATE players SET owner_id = $1, listed_price = NULL, release_clause = NULL, purchase_count = purchase_count + 1, price_override = $3 WHERE id = $2',
        [req.user.id, offer.player_id, nextOverride]
      );
      await logTransfer({ type: 'compra', player, from: owner, to: buyer, price: offer.new_clause_amount, _client: client });
    });

    res.json({ success: true, price: offer.new_clause_amount });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/clause-offers/:id/cancel — buyer withdraws from a raised offer
router.post('/:id/cancel', authenticate, async (req, res) => {
  const offerId = parseInt(req.params.id, 10);

  try {
    const { rows: offerRows } = await pool.query('SELECT * FROM clause_offers WHERE id = $1', [offerId]);
    if (!offerRows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    const offer = offerRows[0];

    if (offer.buyer_id !== req.user.id) return res.status(403).json({ error: 'No sos el comprador de esta oferta' });
    if (!['pending', 'raised'].includes(offer.status)) {
      return res.status(400).json({ error: 'La oferta ya fue resuelta' });
    }

    await pool.query(
      "UPDATE clause_offers SET status = 'cancelled', resolved_at = $1 WHERE id = $2",
      [Date.now(), offerId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
