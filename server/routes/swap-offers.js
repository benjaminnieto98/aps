const express = require('express');
const { pool, withTransaction } = require('../db');
const { authenticate } = require('../middleware/auth');
const { logTransfer } = require('../transfers');

const router = express.Router();

// GET /api/swap-offers/received — pending swaps where current user is receiver
router.get('/received', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM swap_offers WHERE receiver_id = $1 AND status = 'pending' ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/swap-offers/sent — all swaps proposed by current user
router.get('/sent', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM swap_offers WHERE proposer_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/swap-offers — propose a swap
router.post('/', authenticate, async (req, res) => {
  const { offered_player_id, requested_player_id, cash_difference = 0 } = req.body;

  if (!offered_player_id || !requested_player_id) {
    return res.status(400).json({ error: 'Se requieren ambos jugadores' });
  }
  if (offered_player_id === requested_player_id) {
    return res.status(400).json({ error: 'No podés intercambiar un jugador por sí mismo' });
  }

  try {
    const [offRes, reqRes, proposerRes] = await Promise.all([
      pool.query('SELECT * FROM players WHERE id = $1', [offered_player_id]),
      pool.query('SELECT * FROM players WHERE id = $1', [requested_player_id]),
      pool.query('SELECT id, username FROM users WHERE id = $1', [req.user.id]),
    ]);

    const offeredPlayer = offRes.rows[0];
    if (!offeredPlayer) return res.status(404).json({ error: 'Tu jugador no encontrado' });
    if (offeredPlayer.owner_id !== req.user.id) return res.status(403).json({ error: 'No sos el dueño del jugador ofrecido' });

    const requestedPlayer = reqRes.rows[0];
    if (!requestedPlayer) return res.status(404).json({ error: 'Jugador pedido no encontrado' });
    if (!requestedPlayer.owner_id) return res.status(400).json({ error: 'No podés pedir un agente libre en un intercambio' });
    if (requestedPlayer.owner_id === req.user.id) return res.status(400).json({ error: 'El jugador pedido ya es tuyo' });

    const { rows: existing } = await pool.query(
      `SELECT id FROM swap_offers WHERE status = 'pending'
       AND (offered_player_id = $1 OR requested_player_id = $1
            OR offered_player_id = $2 OR requested_player_id = $2)`,
      [offered_player_id, requested_player_id]
    );
    if (existing.length > 0) return res.status(400).json({ error: 'Uno de los jugadores ya tiene un intercambio pendiente' });

    const cashDiff = parseInt(cash_difference, 10) || 0;
    if (cashDiff > 0) {
      const { rows: budgetRows } = await pool.query('SELECT budget FROM users WHERE id = $1', [req.user.id]);
      if (budgetRows[0].budget < cashDiff) {
        return res.status(400).json({ error: 'Presupuesto insuficiente para la compensación ofrecida' });
      }
    }

    const { rows: receiverRows } = await pool.query('SELECT id, username FROM users WHERE id = $1', [requestedPlayer.owner_id]);
    const receiver = receiverRows[0];
    const proposer = proposerRes.rows[0];

    await pool.query(
      `INSERT INTO swap_offers
         (proposer_id, proposer_username, offered_player_id, offered_player_name, offered_player_rating, offered_player_position,
          receiver_id, receiver_username, requested_player_id, requested_player_name, requested_player_rating, requested_player_position,
          cash_difference, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14)`,
      [
        proposer.id, proposer.username,
        offeredPlayer.id, offeredPlayer.name, offeredPlayer.rating, offeredPlayer.position,
        receiver.id, receiver.username,
        requestedPlayer.id, requestedPlayer.name, requestedPlayer.rating, requestedPlayer.position,
        cashDiff, Date.now(),
      ]
    );

    res.json({ success: true, message: 'Oferta de intercambio enviada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/swap-offers/:id/accept
router.post('/:id/accept', authenticate, async (req, res) => {
  const offerId = parseInt(req.params.id, 10);

  try {
    const { rows: offerRows } = await pool.query('SELECT * FROM swap_offers WHERE id = $1', [offerId]);
    if (!offerRows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    const offer = offerRows[0];

    if (offer.receiver_id !== req.user.id) return res.status(403).json({ error: 'No sos el receptor de esta oferta' });
    if (offer.status !== 'pending') return res.status(400).json({ error: 'La oferta ya fue resuelta' });

    const [offPR, reqPR] = await Promise.all([
      pool.query('SELECT * FROM players WHERE id = $1', [offer.offered_player_id]),
      pool.query('SELECT * FROM players WHERE id = $1', [offer.requested_player_id]),
    ]);
    if (!offPR.rows[0] || offPR.rows[0].owner_id !== offer.proposer_id) {
      return res.status(400).json({ error: 'El jugador ofrecido ya no pertenece al proponente' });
    }
    if (!reqPR.rows[0] || reqPR.rows[0].owner_id !== offer.receiver_id) {
      return res.status(400).json({ error: 'El jugador pedido ya no te pertenece' });
    }

    const cashDiff = offer.cash_difference || 0;
    if (cashDiff > 0) {
      const { rows: propBudget } = await pool.query('SELECT budget FROM users WHERE id = $1', [offer.proposer_id]);
      if (propBudget[0].budget < cashDiff) {
        return res.status(400).json({ error: 'El proponente ya no tiene presupuesto suficiente para la compensación' });
      }
    } else if (cashDiff < 0) {
      const absCash = Math.abs(cashDiff);
      const { rows: recBudget } = await pool.query('SELECT budget FROM users WHERE id = $1', [req.user.id]);
      if (recBudget[0].budget < absCash) {
        return res.status(400).json({ error: `Presupuesto insuficiente para la compensación (${absCash.toLocaleString()})` });
      }
    }

    const now = Date.now();

    await withTransaction(async (client) => {
      // Swap players (no price_override, no purchase_count update — swaps don't affect price anchoring)
      await client.query(
        'UPDATE players SET owner_id = $1, listed_price = NULL, release_clause = NULL WHERE id = $2',
        [offer.receiver_id, offer.offered_player_id]
      );
      await client.query(
        'UPDATE players SET owner_id = $1, listed_price = NULL, release_clause = NULL WHERE id = $2',
        [offer.proposer_id, offer.requested_player_id]
      );

      if (cashDiff > 0) {
        await client.query('UPDATE users SET budget = budget - $1 WHERE id = $2', [cashDiff, offer.proposer_id]);
        await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [cashDiff, offer.receiver_id]);
      } else if (cashDiff < 0) {
        const absCash = Math.abs(cashDiff);
        await client.query('UPDATE users SET budget = budget - $1 WHERE id = $2', [absCash, offer.receiver_id]);
        await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [absCash, offer.proposer_id]);
      }

      await client.query(
        "UPDATE swap_offers SET status = 'accepted', resolved_at = $1 WHERE id = $2",
        [now, offerId]
      );

      // Cancel other pending swaps for these players
      await client.query(
        `UPDATE swap_offers SET status = 'cancelled', resolved_at = $1
         WHERE id != $2 AND status = 'pending'
         AND (offered_player_id IN ($3,$4) OR requested_player_id IN ($3,$4))`,
        [now, offerId, offer.offered_player_id, offer.requested_player_id]
      );

      // Log both legs of the swap (price = null, no money changes logged per player)
      await logTransfer({
        type: 'intercambio',
        player: offPR.rows[0],
        from: { id: offer.proposer_id, username: offer.proposer_username },
        to:   { id: offer.receiver_id,  username: offer.receiver_username },
        price: null,
        _client: client,
      });
      await logTransfer({
        type: 'intercambio',
        player: reqPR.rows[0],
        from: { id: offer.receiver_id,  username: offer.receiver_username },
        to:   { id: offer.proposer_id, username: offer.proposer_username },
        price: null,
        _client: client,
      });
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/swap-offers/:id/reject
router.post('/:id/reject', authenticate, async (req, res) => {
  const offerId = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query('SELECT * FROM swap_offers WHERE id = $1', [offerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    if (rows[0].receiver_id !== req.user.id) return res.status(403).json({ error: 'No sos el receptor' });
    if (rows[0].status !== 'pending') return res.status(400).json({ error: 'La oferta ya fue resuelta' });
    await pool.query(
      "UPDATE swap_offers SET status = 'rejected', resolved_at = $1 WHERE id = $2",
      [Date.now(), offerId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/swap-offers/:id/cancel
router.post('/:id/cancel', authenticate, async (req, res) => {
  const offerId = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query('SELECT * FROM swap_offers WHERE id = $1', [offerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    if (rows[0].proposer_id !== req.user.id) return res.status(403).json({ error: 'No sos el proponente' });
    if (rows[0].status !== 'pending') return res.status(400).json({ error: 'La oferta ya fue resuelta' });
    await pool.query(
      "UPDATE swap_offers SET status = 'cancelled', resolved_at = $1 WHERE id = $2",
      [Date.now(), offerId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
