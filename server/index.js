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
    const { rows } = await pool.query(`
      SELECT u.id, u.username, u.team_name, u.budget, COUNT(p.id)::int as player_count
      FROM users u LEFT JOIN players p ON p.owner_id = u.id
      GROUP BY u.id ORDER BY u.budget DESC
    `);
    res.json(rows);
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
