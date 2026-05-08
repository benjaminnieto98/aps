const express = require('express');
const { pool } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/transfers
// Query params: type, player (name search), user (username search), limit, offset
router.get('/', authenticate, async (req, res) => {
  const { type, player, user, limit = 50, offset = 0 } = req.query;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (type) {
    conditions.push(`t.type = $${idx++}`);
    params.push(type);
  }
  if (player) {
    conditions.push(`t.player_name ILIKE $${idx++}`);
    params.push(`%${player}%`);
  }
  if (user) {
    conditions.push(`(t.from_username ILIKE $${idx} OR t.to_username ILIKE $${idx + 1})`);
    idx += 2;
    params.push(`%${user}%`, `%${user}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int as cnt FROM transfers t ${whereClause}`,
      params
    );
    const total = countResult.rows[0].cnt;

    const rowsResult = await pool.query(
      `SELECT t.* FROM transfers t ${whereClause} ORDER BY t.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    res.json({ total, transfers: rowsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
