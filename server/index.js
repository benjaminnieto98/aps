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
const swapOffersRoutes = require('./routes/swap-offers');

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
app.use('/api/swap-offers', swapOffersRoutes);

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

// Inline price calculation for stats (mirrors players.js calcPrice)
const POSITION_GROUP_STATS = {
  GK: 'gk', CB: 'def', LB: 'def',
  CDM: 'mid', CM: 'mid', CAM: 'mid',
  LW: 'fwd', ST: 'fwd'
};
function calcPriceStats(player, cfg) {
  const base      = parseInt(cfg.price_multiplier  || '1000', 10);
  const group     = POSITION_GROUP_STATS[player.position] || 'mid';
  const posMult   = parseFloat(cfg[`pos_mult_${group}`] || '1.0');
  const threshold = parseInt(cfg.rating_threshold   || '80',  10);
  const lowMult   = parseFloat(cfg.low_rating_mult  || '0.5');
  const ratingMult    = player.rating < threshold ? lowMult : 1.0;
  const purchaseBoost = Math.pow(1.1, player.purchase_count || 0);
  let price = Math.round(player.rating * player.rating * base * posMult * ratingMult * purchaseBoost);
  if (!player.owner_id && (player.purchase_count || 0) > 0) price = Math.round(price * 0.7);
  return price;
}

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

    // Finished tournaments — read winner IDs directly
    const { rows: finishedT } = await pool.query(`
      SELECT id, tournament_type, participant_ids,
             liga_winner_id, copa_winner_id, supercopa_winner_id
      FROM tournaments WHERE status = 'finished'
    `);

    // Compute stats per user
    const stats = {};
    for (const u of users) {
      stats[u.id] = { ...u, wins: 0, draws: 0, losses: 0, leagues_won: 0, cups_won: 0, supercopas_won: 0 };
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

    // Count championships per type
    for (const t of finishedT) {
      const type = t.tournament_type || 'league';

      if (type === 'league' || type === 'friendly') {
        // Legacy tournaments without stored winner: compute from standings
        if (!t.liga_winner_id) {
          const { rows: allMatchRows } = await pool.query(
            `SELECT home_id, away_id, home_score, away_score FROM matches
             WHERE tournament_id = $1 AND home_score IS NOT NULL AND away_score IS NOT NULL`,
            [t.id]
          );
          const ids = JSON.parse(t.participant_ids || '[]');
          const s = {};
          for (const id of ids) s[id] = { pts: 0, gd: 0, gf: 0 };
          for (const m of allMatchRows) {
            const hh = s[m.home_id], aa = s[m.away_id];
            if (!hh || !aa) continue;
            hh.gf += m.home_score; hh.gd += m.home_score - m.away_score;
            aa.gf += m.away_score; aa.gd += m.away_score - m.home_score;
            if (m.home_score > m.away_score) hh.pts += 3;
            else if (m.home_score < m.away_score) aa.pts += 3;
            else { hh.pts++; aa.pts++; }
          }
          const sorted = Object.entries(s).sort(([,a],[,b]) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf);
          if (sorted.length > 0) {
            const wid = parseInt(sorted[0][0], 10);
            if (stats[wid]) stats[wid].leagues_won++;
          }
        } else if (stats[t.liga_winner_id]) {
          stats[t.liga_winner_id].leagues_won++;
        }

      } else if (type === 'cup') {
        if (t.copa_winner_id && stats[t.copa_winner_id]) stats[t.copa_winner_id].cups_won++;

      } else if (type === 'superliga') {
        if (t.liga_winner_id   && stats[t.liga_winner_id])   stats[t.liga_winner_id].leagues_won++;
        if (t.copa_winner_id   && stats[t.copa_winner_id])   stats[t.copa_winner_id].cups_won++;
        if (t.supercopa_winner_id && stats[t.supercopa_winner_id]) stats[t.supercopa_winner_id].supercopas_won++;
      }
    }

    // total for sorting
    for (const s of Object.values(stats)) {
      s.tournaments_won = s.leagues_won + s.cups_won + s.supercopas_won;
    }

    // Compute team value (sum of dynamic prices of each user's players)
    const { rows: cfgRows } = await pool.query(
      `SELECT key, value FROM config WHERE key IN ('price_multiplier','pos_mult_gk','pos_mult_def','pos_mult_mid','pos_mult_fwd','rating_threshold','low_rating_mult')`
    );
    const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));

    const { rows: allPlayers } = await pool.query(
      'SELECT id, rating, position, owner_id, purchase_count FROM players WHERE owner_id IS NOT NULL'
    );
    for (const s of Object.values(stats)) s.team_value = 0;
    for (const p of allPlayers) {
      if (stats[p.owner_id]) {
        stats[p.owner_id].team_value += calcPriceStats(p, cfg);
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
    const [
      biggestTransfer, topSpenders, topEarners, mostTransferred, mostActive,
      biggestWin, mostGoalsMatch, topTeamByTournament, allScoredMatchesRes
    ] = await Promise.all([
      // Traspaso más caro
      pool.query(
        `SELECT player_name, player_position, player_rating, price, from_username, to_username, created_at
         FROM transfers WHERE type = 'compra' AND price IS NOT NULL ORDER BY price DESC LIMIT 1`
      ).then(r => r.rows[0] || null),

      // Top gastadores
      pool.query(
        `SELECT to_username as username, SUM(price)::int as total FROM transfers
         WHERE type='compra' AND price IS NOT NULL AND to_username IS NOT NULL
         GROUP BY to_username ORDER BY total DESC LIMIT 5`
      ).then(r => r.rows),

      // Top vendedores
      pool.query(
        `SELECT from_username as username, SUM(price)::int as total FROM transfers
         WHERE type='compra' AND price IS NOT NULL AND from_username IS NOT NULL
         GROUP BY from_username ORDER BY total DESC LIMIT 5`
      ).then(r => r.rows),

      // Jugador más transferido
      pool.query(
        `SELECT player_name, player_position, player_rating, COUNT(*)::int as times
         FROM transfers WHERE type='compra'
         GROUP BY player_id, player_name, player_position, player_rating ORDER BY times DESC LIMIT 1`
      ).then(r => r.rows[0] || null),

      // Más activo en el mercado
      pool.query(
        `SELECT username, COUNT(*)::int as ops FROM (
           SELECT to_username as username FROM transfers WHERE type='compra' AND to_username IS NOT NULL
           UNION ALL
           SELECT from_username FROM transfers WHERE type='compra' AND from_username IS NOT NULL
         ) t GROUP BY username ORDER BY ops DESC LIMIT 5`
      ).then(r => r.rows),

      // Mayor goleada (mayor diferencia de goles)
      pool.query(
        `SELECT m.id, m.home_score, m.away_score,
                ABS(m.home_score - m.away_score) as diff,
                uh.username as home_username, uh.team_name as home_team,
                ua.username as away_username, ua.team_name as away_team,
                t.name as tournament_name
         FROM matches m
         JOIN users uh ON m.home_id = uh.id
         JOIN users ua ON m.away_id = ua.id
         LEFT JOIN tournaments t ON m.tournament_id = t.id
         WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
         ORDER BY diff DESC, (m.home_score + m.away_score) DESC LIMIT 1`
      ).then(r => r.rows[0] || null),

      // Partido más goleador (más goles en total)
      pool.query(
        `SELECT m.id, m.home_score, m.away_score,
                (m.home_score + m.away_score) as total_goals,
                uh.username as home_username, uh.team_name as home_team,
                ua.username as away_username, ua.team_name as away_team,
                t.name as tournament_name
         FROM matches m
         JOIN users uh ON m.home_id = uh.id
         JOIN users ua ON m.away_id = ua.id
         LEFT JOIN tournaments t ON m.tournament_id = t.id
         WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
         ORDER BY total_goals DESC LIMIT 1`
      ).then(r => r.rows[0] || null),

      // Equipo más goleador en un torneo — solo liga
      pool.query(
        `SELECT t.name as tournament_name, u.username, u.team_name,
                SUM(CASE WHEN m.home_id = u.id THEN m.home_score ELSE m.away_score END)::int as goals
         FROM matches m
         JOIN tournaments t ON m.tournament_id = t.id
         JOIN users u ON (m.home_id = u.id OR m.away_id = u.id)
         WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL AND m.tournament_id IS NOT NULL
           AND (m.phase IS NULL OR m.phase NOT IN ('copa_semi','copa_final','supercopa_semi','supercopa_final','friendly'))
         GROUP BY t.id, t.name, u.id, u.username, u.team_name
         ORDER BY goals DESC LIMIT 1`
      ).then(r => r.rows[0] || null),

      // Scored matches for per-tournament player scorer calc — solo liga
      pool.query(
        `SELECT m.scorers, m.tournament_id, t.name as tournament_name
         FROM matches m
         LEFT JOIN tournaments t ON m.tournament_id = t.id
         WHERE m.scorers IS NOT NULL AND m.tournament_id IS NOT NULL
           AND (m.phase IS NULL OR m.phase NOT IN ('copa_semi','copa_final','supercopa_semi','supercopa_final','friendly'))`
      ),
    ]);

    // Win/draw/loss/clean sheet stats per user (from finished matches)
    const { rows: allUsers } = await pool.query('SELECT id, username, team_name FROM users');

    const matchStats = {};
    for (const u of allUsers) {
      matchStats[u.id] = { ...u, wins: 0, losses: 0, draws: 0, clean_sheets: 0, gf: 0, ga: 0, streak_wins: 0, streak_draws: 0 };
    }

    // We need ordered matches to compute current streaks
    const { rows: orderedMatches } = await pool.query(
      `SELECT home_id, away_id, home_score, away_score, played_at, id
       FROM matches WHERE home_score IS NOT NULL AND away_score IS NOT NULL
       ORDER BY played_at ASC NULLS FIRST, id ASC`
    );

    for (const m of orderedMatches) {
      const h = matchStats[m.home_id], a = matchStats[m.away_id];
      if (!h || !a) continue;
      h.gf += m.home_score; h.ga += m.away_score;
      a.gf += m.away_score; a.ga += m.home_score;
      if (m.away_score === 0) h.clean_sheets++;
      if (m.home_score === 0) a.clean_sheets++;
      if (m.home_score > m.away_score) { h.wins++; a.losses++; }
      else if (m.home_score < m.away_score) { a.wins++; h.losses++; }
      else { h.draws++; a.draws++; }
    }

    // Longest win streak per user (iterate matches in order)
    const userStreaks = {};
    for (const uid of Object.keys(matchStats)) {
      userStreaks[uid] = { cur: 0, max: 0 };
    }
    for (const m of orderedMatches) {
      const processUser = (uid, won) => {
        if (!userStreaks[uid]) return;
        if (won) { userStreaks[uid].cur++; userStreaks[uid].max = Math.max(userStreaks[uid].max, userStreaks[uid].cur); }
        else userStreaks[uid].cur = 0;
      };
      const homeWon = m.home_score > m.away_score;
      const awayWon = m.away_score > m.home_score;
      processUser(m.home_id, homeWon);
      processUser(m.away_id, awayWon);
    }
    for (const uid of Object.keys(matchStats)) {
      matchStats[uid].longest_win_streak = userStreaks[uid]?.max || 0;
    }

    const userList = Object.values(matchStats).filter(u => u.wins + u.draws + u.losses > 0);

    const mostWins    = [...userList].sort((a,b) => b.wins - a.wins).slice(0,5);
    const mostLosses  = [...userList].sort((a,b) => b.losses - a.losses).slice(0,5);
    const mostDraws   = [...userList].sort((a,b) => b.draws - a.draws).slice(0,5);
    const cleanSheets = [...userList].sort((a,b) => b.clean_sheets - a.clean_sheets).slice(0,5);
    const longestStreak = [...userList].sort((a,b) => b.longest_win_streak - a.longest_win_streak).slice(0,1)[0] || null;
    const bestAttack  = [...userList].sort((a,b) => b.gf - a.gf).slice(0,5).map(u => ({ ...u, total: u.gf }));
    const bestDefense = [...userList].filter(u => u.wins + u.draws + u.losses >= 3).sort((a,b) => a.ga - b.ga).slice(0,5).map(u => ({ ...u, total: u.ga }));

    // Top goleador en un torneo (JS, scorers stored as JSON)
    const goalsByTournamentPlayer = {};
    for (const m of allScoredMatchesRes.rows) {
      let sc; try { sc = JSON.parse(m.scorers); } catch { continue; }
      for (const s of sc) {
        const key = `${m.tournament_id}:${s.player_id}`;
        if (!goalsByTournamentPlayer[key]) goalsByTournamentPlayer[key] = { tournament_name: m.tournament_name, player_id: s.player_id, goals: 0 };
        goalsByTournamentPlayer[key].goals += s.count || 1;
      }
    }
    let topScorerByTournament = null;
    for (const entry of Object.values(goalsByTournamentPlayer)) {
      if (!topScorerByTournament || entry.goals > topScorerByTournament.goals) topScorerByTournament = entry;
    }
    if (topScorerByTournament) {
      const { rows: pRows } = await pool.query('SELECT name, position FROM players WHERE id = $1', [topScorerByTournament.player_id]);
      if (pRows[0]) { topScorerByTournament.player_name = pRows[0].name; topScorerByTournament.player_position = pRows[0].position; }
    }

    res.json({
      biggestTransfer, topSpenders, topEarners, mostTransferred, mostActive,
      biggestWin, mostGoalsMatch,
      mostWins, mostLosses, mostDraws, cleanSheets, longestStreak,
      bestAttack, bestDefense,
      topScorerByTournament, topTeamByTournament,
    });
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
