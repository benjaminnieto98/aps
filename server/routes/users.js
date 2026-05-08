const express = require('express');
const { pool, withTransaction } = require('../db');
const { authenticate } = require('../middleware/auth');
const { logTransfer } = require('../transfers');

const router = express.Router();

// GET /api/users
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.username, u.is_admin, u.team_name, u.budget, u.created_at,
             COUNT(p.id)::int as player_count
      FROM users u
      LEFT JOIN players p ON p.owner_id = u.id
      GROUP BY u.id
      ORDER BY u.username
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/users/:id/assign-team
router.post('/:id/assign-team', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const userId = parseInt(req.params.id, 10);
  const { teamName } = req.body;
  if (!teamName) return res.status(400).json({ error: 'Nombre de equipo requerido' });

  try {
    const { rows: cfgRows } = await pool.query(
      "SELECT value FROM config WHERE key = 'max_roster'"
    );
    const maxRoster = cfgRows[0] ? parseInt(cfgRows[0].value, 10) : 22;

    const { rows: userRows } = await pool.query(
      'SELECT id, username FROM users WHERE id = $1', [userId]
    );
    if (!userRows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    const targetUser = userRows[0];

    const count = await withTransaction(async (client) => {
      // Free current players
      const { rows: prevPlayers } = await client.query(
        'SELECT * FROM players WHERE owner_id = $1', [userId]
      );
      await client.query(
        'UPDATE players SET owner_id = NULL, listed_price = NULL, release_clause = NULL WHERE owner_id = $1',
        [userId]
      );
      for (const p of prevPlayers) {
        await logTransfer({ type: 'reset', player: p, from: targetUser, to: null, price: null, _client: client });
      }

      // Get top players from that team
      const { rows: teamPlayers } = await client.query(`
        SELECT * FROM players
        WHERE pes_team = $1 AND owner_id IS NULL
        ORDER BY rating DESC
        LIMIT $2
      `, [teamName, maxRoster]);

      // Assign them
      for (const p of teamPlayers) {
        await client.query('UPDATE players SET owner_id = $1 WHERE id = $2', [userId, p.id]);
        await logTransfer({ type: 'asignacion', player: p, from: null, to: targetUser, price: null, _client: client });
      }

      await client.query('UPDATE users SET team_name = $1 WHERE id = $2', [teamName, userId]);

      return teamPlayers.length;
    });

    res.json({ success: true, playersAssigned: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/users/:id/reset-team
router.post('/:id/reset-team', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const userId = parseInt(req.params.id, 10);

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    const user = rows[0];

    await withTransaction(async (client) => {
      const { rows: prevPlayers } = await client.query(
        'SELECT * FROM players WHERE owner_id = $1', [userId]
      );
      await client.query(
        'UPDATE players SET owner_id = NULL, listed_price = NULL, release_clause = NULL WHERE owner_id = $1',
        [userId]
      );
      await client.query('UPDATE users SET team_name = NULL WHERE id = $1', [userId]);
      for (const p of prevPlayers) {
        await logTransfer({ type: 'reset', player: p, from: user, to: null, price: null, _client: client });
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const userId = parseInt(req.params.id, 10);
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
  }

  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    await withTransaction(async (client) => {
      await client.query(
        'UPDATE players SET owner_id = NULL, listed_price = NULL, release_clause = NULL WHERE owner_id = $1',
        [userId]
      );
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/users/:id/budget
router.post('/:id/budget', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const userId = parseInt(req.params.id, 10);
  const { amount } = req.body;

  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  try {
    await pool.query('UPDATE users SET budget = $1 WHERE id = $2', [parseInt(amount, 10), userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/users/:id/toggle-admin
router.post('/:id/toggle-admin', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const userId = parseInt(req.params.id, 10);

  try {
    const { rows } = await pool.query('SELECT id, is_admin FROM users WHERE id = $1', [userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    const newAdmin = rows[0].is_admin ? 0 : 1;
    await pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [newAdmin, userId]);
    res.json({ success: true, is_admin: newAdmin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
