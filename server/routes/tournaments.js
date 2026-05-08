const express = require('express');
const { pool, withTransaction } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function generateRoundRobin(participants) {
  const teams = [...participants];
  if (teams.length % 2 !== 0) teams.push(null);
  const n = teams.length;
  const rounds = [];

  for (let round = 0; round < n - 1; round++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      if (home !== null && away !== null) {
        matches.push({ home, away });
      }
    }
    rounds.push(matches);
    const last = teams[n - 1];
    for (let i = n - 1; i > 1; i--) {
      teams[i] = teams[i - 1];
    }
    teams[1] = last;
  }
  return rounds;
}

// GET /api/tournaments
router.get('/', async (req, res) => {
  try {
    const { rows: tournaments } = await pool.query(
      'SELECT * FROM tournaments ORDER BY created_at DESC'
    );

    const result = await Promise.all(tournaments.map(async (t) => {
      const participantIds = JSON.parse(t.participant_ids || '[]');
      const participants = await Promise.all(participantIds.map(async (id) => {
        const { rows } = await pool.query(
          'SELECT id, username, team_name FROM users WHERE id = $1', [id]
        );
        return rows[0] || { id, username: 'Desconocido', team_name: null };
      }));

      return {
        ...t,
        participant_ids: participantIds,
        prizes: JSON.parse(t.prizes || '[]'),
        participants
      };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/tournaments
router.post('/', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const { name, participantIds, prizes } = req.body;
  if (!name || !participantIds || participantIds.length < 2) {
    return res.status(400).json({ error: 'Nombre y al menos 2 participantes requeridos' });
  }

  const format = participantIds.length <= 6 ? 'roundrobin' : 'groups';

  try {
    const { id: tournamentId, format: fmt } = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO tournaments (name, format, status, participant_ids, prizes, created_at)
         VALUES ($1, $2, 'active', $3, $4, $5) RETURNING id`,
        [name, format, JSON.stringify(participantIds), JSON.stringify(prizes || [0, 0, 0]), Date.now()]
      );
      const tId = rows[0].id;

      async function insertMatches(rounds) {
        for (let idx = 0; idx < rounds.length; idx++) {
          for (const match of rounds[idx]) {
            await client.query(
              'INSERT INTO matches (tournament_id, round_number, round_name, home_id, away_id) VALUES ($1,$2,$3,$4,$5)',
              [tId, idx + 1, `Fecha ${idx + 1}`, match.home, match.away]
            );
          }
        }
      }

      if (format === 'roundrobin') {
        await insertMatches(generateRoundRobin(participantIds));
      } else {
        const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
        const half = Math.ceil(shuffled.length / 2);
        const groupA = shuffled.slice(0, half);
        const groupB = shuffled.slice(half);

        const roundsA = generateRoundRobin(groupA);
        for (let idx = 0; idx < roundsA.length; idx++) {
          for (const match of roundsA[idx]) {
            await client.query(
              'INSERT INTO matches (tournament_id, round_number, round_name, home_id, away_id) VALUES ($1,$2,$3,$4,$5)',
              [tId, idx + 1, `Grupo A – Fecha ${idx + 1}`, match.home, match.away]
            );
          }
        }
        const roundsB = generateRoundRobin(groupB);
        for (let idx = 0; idx < roundsB.length; idx++) {
          for (const match of roundsB[idx]) {
            await client.query(
              'INSERT INTO matches (tournament_id, round_number, round_name, home_id, away_id) VALUES ($1,$2,$3,$4,$5)',
              [tId, idx + 1, `Grupo B – Fecha ${idx + 1}`, match.home, match.away]
            );
          }
        }
      }

      return { id: tId, format };
    });

    res.json({ success: true, id: tournamentId, format: fmt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/tournaments/:id/finish
router.post('/:id/finish', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const tournamentId = parseInt(req.params.id, 10);

  try {
    const { rows: tRows } = await pool.query(
      'SELECT * FROM tournaments WHERE id = $1', [tournamentId]
    );
    if (!tRows[0]) return res.status(404).json({ error: 'Torneo no encontrado' });
    const tournament = tRows[0];
    if (tournament.status === 'finished') {
      return res.status(400).json({ error: 'El torneo ya está finalizado' });
    }

    const participantIds = JSON.parse(tournament.participant_ids || '[]');
    const prizes = JSON.parse(tournament.prizes || '[]');

    const { rows: matches } = await pool.query(
      'SELECT * FROM matches WHERE tournament_id = $1', [tournamentId]
    );

    const standings = {};
    for (const pid of participantIds) {
      standings[pid] = { id: pid, pts: 0, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, gd: 0 };
    }

    for (const match of matches) {
      if (match.home_score === null || match.away_score === null) continue;
      const home = standings[match.home_id];
      const away = standings[match.away_id];
      if (!home || !away) continue;

      home.pj++; away.pj++;
      home.gf += match.home_score; home.gc += match.away_score;
      away.gf += match.away_score; away.gc += match.home_score;

      if (match.home_score > match.away_score) {
        home.pts += 3; home.g++; away.p++;
      } else if (match.home_score < match.away_score) {
        away.pts += 3; away.g++; home.p++;
      } else {
        home.pts += 1; home.e++;
        away.pts += 1; away.e++;
      }
    }

    for (const s of Object.values(standings)) {
      s.gd = s.gf - s.gc;
    }

    const sorted = Object.values(standings).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd  !== a.gd)  return b.gd  - a.gd;
      return b.gf - a.gf;
    });

    await withTransaction(async (client) => {
      for (let i = 0; i < prizes.length; i++) {
        if (sorted[i] && prizes[i] > 0) {
          await client.query(
            'UPDATE users SET budget = budget + $1 WHERE id = $2',
            [parseInt(prizes[i], 10), sorted[i].id]
          );
        }
      }
      await client.query(
        "UPDATE tournaments SET status = 'finished' WHERE id = $1", [tournamentId]
      );
    });

    res.json({ success: true, standings: sorted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
