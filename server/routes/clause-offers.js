const express = require('express');
const { pool, withTransaction } = require('../db');
const { authenticate } = require('../middleware/auth');
const { logTransfer } = require('../transfers');

const router = express.Router();

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

    await withTransaction(async (client) => {
      await client.query('UPDATE users SET budget = budget - $1 WHERE id = $2', [offer.clause_amount, buyer.id]);
      await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [offer.clause_amount, req.user.id]);
      await client.query(
        'UPDATE players SET owner_id = $1, listed_price = NULL, release_clause = NULL WHERE id = $2',
        [buyer.id, offer.player_id]
      );
      await client.query(
        "UPDATE clause_offers SET status = 'accepted', resolved_at = $1 WHERE id = $2",
        [now, offerId]
      );
      await client.query(
        "UPDATE clause_offers SET status = 'rejected', resolved_at = $1 WHERE player_id = $2 AND id != $3 AND status = 'pending'",
        [now, offer.player_id, offerId]
      );
      await logTransfer({ type: 'compra', player, from: owner, to: buyer, price: offer.clause_amount, _client: client });
    });

    res.json({ success: true });
  } catch (err) {
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

    const newAmt = parseInt(newAmount, 10);
    if (newAmt <= offer.clause_amount) {
      return res.status(400).json({
        error: `La nueva cláusula debe ser mayor a la actual (${offer.clause_amount})`
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
      await client.query('UPDATE players SET release_clause = $1 WHERE id = $2', [newAmt, offer.player_id]);
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

module.exports = router;
