const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { pool, initDb } = require('./db');
const { seed } = require('./seed');

const authRoutes = require('./routes/auth');
const playersRoutes = require('./routes/players');
const usersRoutes = require('./routes/users');
const tournamentsRoutes = require('./routes/tournaments');
const matchesRoutes = require('./routes/matches');
const configRoutes = require('./routes/config');
const transfersRoutes = require('./routes/transfers');
const clauseOffersRoutes = require('./routes/clause-offers');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: isProd ? true : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tournaments', tournamentsRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/config', configRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/clause-offers', clauseOffersRoutes);

// Stats
app.get('/api/stats/scorers', async (req, res) => {
  try {
    const { rows: matches } = await pool.query(
      'SELECT scorers, home_id, away_id FROM matches WHERE scorers IS NOT NULL'
    );
    const scorerMap = {};
    for (const match of matches) {
      try {
        for (const s of JSON.parse(match.scorers)) {
          if (!s.player_id) continue;
          scorerMap[s.player_id] = (scorerMap[s.player_id] || 0) + (s.count || 1);
        }
      } catch {}
    }
    const ids = Object.keys(scorerMap);
    if (!ids.length) return res.json([]);

    const result = await Promise.all(ids.map(async (pid) => {
      const { rows: pRows } = await pool.query(
        'SELECT id, name, position, owner_id FROM players WHERE id = $1', [pid]
      );
      const player = pRows[0];
      if (!player) return null;
      let owner = null;
      if (player.owner_id) {
        const { rows: oRows } = await pool.query(
          'SELECT username, team_name FROM users WHERE id = $1', [player.owner_id]
        );
        owner = oRows[0] || null;
      }
      return {
        player_id: pid,
        player_name: player.name,
        position: player.position,
        owner_username: owner?.username,
        owner_team: owner?.team_name,
        goals: scorerMap[pid]
      };
    }));

    res.json(result.filter(Boolean).sort((a, b) => b.goals - a.goals));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/api/stats/managers', async (req, res) => {
  try {
    // Base user + player count
    const { rows: users } = await pool.query(`
      SELECT u.id, u.username, u.team_name, u.budget, COUNT(p.id)::int as player_count
      FROM users u LEFT JOIN players p ON p.owner_id = u.id
      GROUP BY u.id
    `);

    // Match results per user
    const { rows: matchRows } = await pool.query(`
      SELECT home_id, away_id, home_score, away_score
      FROM matches
      WHERE home_score IS NOT NULL AND away_score IS NOT NULL
    `);

    // Finished tournaments — winner is first in standings (most pts/gd/gf)
    const { rows: finishedT } = await pool.query(`
      SELECT id, participant_ids FROM tournaments WHERE status = 'finished'
    `);
    const { rows: allMatchRows } = await pool.query(`
      SELECT tournament_id, home_id, away_id, home_score, away_score
      FROM matches WHERE home_score IS NOT NULL AND away_score IS NOT NULL
    `);

    // Compute stats per user
    const stats = {};
    for (const u of users) {
      stats[u.id] = { ...u, wins: 0, draws: 0, losses: 0, tournaments_won: 0 };
    }

    for (const m of matchRows) {
      if (m.home_score === null || m.away_score === null) continue;
      const h = stats[m.home_id], a = stats[m.away_id];
      if (h && a) {
        if (m.home_score > m.away_score)       { h.wins++;  a.losses++; }
        else if (m.home_score < m.away_score)  { a.wins++;  h.losses++; }
        else                                   { h.draws++; a.draws++;  }
      }
    }

    // Determine winner of each finished tournament
    for (const t of finishedT) {
      const ids = JSON.parse(t.participant_ids || '[]');
      const tMatches = allMatchRows.filter(m => m.tournament_id === t.id);
      const s = {};
      for (const id of ids) s[id] = { pts: 0, gd: 0, gf: 0 };
      for (const m of tMatches) {
        const hh = s[m.home_id], aa = s[m.away_id];
        if (!hh || !aa) continue;
        hh.gf += m.home_score; hh.gd += m.home_score - m.away_score;
        aa.gf += m.away_score; aa.gd += m.away_score - m.home_score;
        if (m.home_score > m.away_score)      { hh.pts += 3; }
        else if (m.home_score < m.away_score) { aa.pts += 3; }
        else                                  { hh.pts++;  aa.pts++; }
      }
      const sorted = Object.entries(s).sort(([,a],[,b]) =>
        b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
      );
      if (sorted.length > 0) {
        const winnerId = parseInt(sorted[0][0], 10);
        if (stats[winnerId]) stats[winnerId].tournaments_won++;
      }
    }

    const result = Object.values(stats).sort((a, b) =>
      b.tournaments_won - a.tournaments_won ||
      b.wins - a.wins ||
      b.budget - a.budget
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/api/stats/records', async (req, res) => {
  try {
    const [biggestTransfer, topSpenders, topEarners, mostTransferred, mostActive] = await Promise.all([
      pool.query(
        `SELECT player_name, player_position, player_rating, price, from_username, to_username, created_at
         FROM transfers WHERE type = 'compra' AND price IS NOT NULL ORDER BY price DESC LIMIT 1`
      ).then(r => r.rows[0] || null),

      pool.query(
        `SELECT to_username as username, SUM(price)::int as total FROM transfers
         WHERE type='compra' AND price IS NOT NULL AND to_username IS NOT NULL
         GROUP BY to_username ORDER BY total DESC LIMIT 5`
      ).then(r => r.rows),

      pool.query(
        `SELECT from_username as username, SUM(price)::int as total FROM transfers
         WHERE type='compra' AND price IS NOT NULL AND from_username IS NOT NULL
         GROUP BY from_username ORDER BY total DESC LIMIT 5`
      ).then(r => r.rows),

      pool.query(
        `SELECT player_name, player_position, player_rating, COUNT(*)::int as times
         FROM transfers WHERE type='compra'
         GROUP BY player_id, player_name, player_position, player_rating ORDER BY times DESC LIMIT 1`
      ).then(r => r.rows[0] || null),

      pool.query(
        `SELECT username, COUNT(*)::int as ops FROM (
           SELECT to_username as username FROM transfers WHERE type='compra' AND to_username IS NOT NULL
           UNION ALL
           SELECT from_username FROM transfers WHERE type='compra' AND from_username IS NOT NULL
         ) t GROUP BY username ORDER BY ops DESC LIMIT 5`
      ).then(r => r.rows)
    ]);

    res.json({ biggestTransfer, topSpenders, topEarners, mostTransferred, mostActive });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/api/stats/h2h', async (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) return res.status(400).json({ error: 'Se requieren user1 y user2' });

  const u1 = parseInt(user1, 10);
  const u2 = parseInt(user2, 10);

  try {
    const [u1Row, u2Row, matchRows] = await Promise.all([
      pool.query('SELECT id, username, team_name FROM users WHERE id = $1', [u1]),
      pool.query('SELECT id, username, team_name FROM users WHERE id = $1', [u2]),
      pool.query(`
        SELECT m.id, m.home_id, m.away_id, m.home_score, m.away_score,
               m.round_name, m.played_at,
               t.name as tournament_name
        FROM matches m
        LEFT JOIN tournaments t ON m.tournament_id = t.id
        WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
          AND ((m.home_id = $1 AND m.away_id = $2) OR (m.home_id = $2 AND m.away_id = $1))
        ORDER BY m.played_at ASC, m.id ASC
      `, [u1, u2])
    ]);

    if (!u1Row.rows[0] || !u2Row.rows[0]) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const matches = matchRows.rows;
    const stats = {
      [u1]: { wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 },
      [u2]: { wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 },
    };

    for (const m of matches) {
      const isU1Home = m.home_id === u1;
      const u1gf = isU1Home ? m.home_score : m.away_score;
      const u2gf = isU1Home ? m.away_score : m.home_score;
      stats[u1].gf += u1gf; stats[u1].ga += u2gf;
      stats[u2].gf += u2gf; stats[u2].ga += u1gf;
      if (u1gf > u2gf)      { stats[u1].wins++;  stats[u2].losses++; }
      else if (u1gf < u2gf) { stats[u2].wins++;  stats[u1].losses++; }
      else                  { stats[u1].draws++; stats[u2].draws++;  }
    }

    res.json({
      user1: { ...u1Row.rows[0], ...stats[u1] },
      user2: { ...u2Row.rows[0], ...stats[u2] },
      matches: matches.map(m => ({
        id: m.id,
        home_id:   m.home_id,
        away_id:   m.away_id,
        home_score: m.home_score,
        away_score: m.away_score,
        round_name: m.round_name,
        tournament_name: m.tournament_name,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Serve compiled React app (production)
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Startup: init DB tables, seed players, then listen
(async () => {
  try {
    await initDb();
    console.log('DB initialized');
    await seed(pool);
    app.listen(PORT, () => {
      console.log(`APS Server running on http://localhost:${PORT} [${isProd ? 'production' : 'development'}]`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
})();
