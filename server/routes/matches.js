const express = require('express');
const { pool } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/matches?tournament=:id
router.get('/', async (req, res) => {
  const { tournament } = req.query;
  if (!tournament) return res.status(400).json({ error: 'Se requiere el parámetro tournament' });

  try {
    const { rows: matches } = await pool.query(`
      SELECT m.*,
             uh.username as home_username, uh.team_name as home_team,
             ua.username as away_username, ua.team_name as away_team
      FROM matches m
      LEFT JOIN users uh ON m.home_id = uh.id
      LEFT JOIN users ua ON m.away_id = ua.id
      WHERE m.tournament_id = $1
      ORDER BY m.round_number, m.id
    `, [parseInt(tournament, 10)]);

    const enriched = await Promise.all(matches.map(async (match) => {
      let scorers = [];
      if (match.scorers) {
        try {
          const raw = JSON.parse(match.scorers);
          scorers = await Promise.all(raw.map(async (s) => {
            const { rows } = await pool.query(
              'SELECT id, name FROM players WHERE id = $1', [s.player_id]
            );
            return { ...s, player_name: rows[0] ? rows[0].name : 'Desconocido' };
          }));
        } catch (e) {
          scorers = [];
        }
      }
      return { ...match, scorers };
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/matches/:id/result
router.post('/:id/result', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const matchId = parseInt(req.params.id, 10);
  const { homeScore, awayScore, scorers } = req.body;

  if (homeScore === undefined || homeScore === null || awayScore === undefined || awayScore === null) {
    return res.status(400).json({ error: 'Se requieren los marcadores' });
  }

  try {
    const { rows } = await pool.query('SELECT id FROM matches WHERE id = $1', [matchId]);
    if (!rows[0]) return res.status(404).json({ error: 'Partido no encontrado' });

    await pool.query(
      'UPDATE matches SET home_score = $1, away_score = $2, scorers = $3, played_at = $4 WHERE id = $5',
      [parseInt(homeScore, 10), parseInt(awayScore, 10), JSON.stringify(scorers || []), Date.now(), matchId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
