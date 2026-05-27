const express = require('express');
const { pool, withTransaction } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function generateRoundRobin(participants) {
  const teams = [...participants];
  if (teams.length % 2 !== 0) teams.push(null);
  const n = teams.length;
  const rounds = [];
  for (let round = 0; round < n - 1; round++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i], away = teams[n - 1 - i];
      if (home !== null && away !== null) matches.push({ home, away });
    }
    rounds.push(matches);
    const last = teams[n - 1];
    for (let i = n - 1; i > 1; i--) teams[i] = teams[i - 1];
    teams[1] = last;
  }
  return rounds;
}

// Returns [[teamA, teamB], [teamC, teamD], ...] shuffled randomly
function shuffleIntoPairs(participants) {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1] !== undefined) pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

// Given sorted standings array, returns seeded copa pairs: [1st vs last, 2nd vs 3rd, ...]
function seedCopaPairs(standings) {
  const n = standings.length;
  const pairs = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    pairs.push([standings[i].id, standings[n - 1 - i].id]);
  }
  return pairs;
}

function computeStandings(participantIds, matches) {
  const s = {};
  for (const id of participantIds) {
    s[id] = { id, pts: 0, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, gd: 0 };
  }
  for (const m of matches) {
    if (m.home_score === null || m.away_score === null) continue;
    const home = s[m.home_id], away = s[m.away_id];
    if (!home || !away) continue;
    home.pj++; away.pj++;
    home.gf += m.home_score; home.gc += m.away_score;
    away.gf += m.away_score; away.gc += m.home_score;
    if (m.home_score > m.away_score)       { home.pts += 3; home.g++; away.p++; }
    else if (m.home_score < m.away_score)  { away.pts += 3; away.g++; home.p++; }
    else                                   { home.pts++; home.e++; away.pts++; away.e++; }
  }
  for (const st of Object.values(s)) st.gd = st.gf - st.gc;
  return Object.values(s).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

// Determine winner of a bracket slot by aggregate goals across all legs.
// Returns { winnerId, loserId }
function getBracketSlotResult(slotMatches) {
  const teams = [...new Set(slotMatches.flatMap(m => [m.home_id, m.away_id]))];
  const [tA, tB] = teams;
  let gA = 0, gB = 0;
  for (const m of slotMatches) {
    if (m.home_id === tA) { gA += m.home_score || 0; gB += m.away_score || 0; }
    else                  { gB += m.home_score || 0; gA += m.away_score || 0; }
  }
  if (gA > gB) return { winnerId: tA, loserId: tB };
  if (gB > gA) return { winnerId: tB, loserId: tA };
  // Aggregate tie → random (could add away-goals rule later)
  return Math.random() < 0.5
    ? { winnerId: tA, loserId: tB }
    : { winnerId: tB, loserId: tA };
}

// ─── DB insert helpers ────────────────────────────────────────────────────────

// Insert round-robin matches (with optional ida/vuelta)
async function insertLeagueRounds(client, tId, participantIds, legs, phase = null) {
  const rounds = generateRoundRobin(participantIds);

  async function insertRounds(roundList, prefix, offset) {
    for (let idx = 0; idx < roundList.length; idx++) {
      const rNum  = offset + idx + 1;
      const rName = legs === 2 ? `${prefix} ${rNum - (offset)}` : `Fecha ${rNum}`;
      for (const m of roundList[idx]) {
        await client.query(
          'INSERT INTO matches (tournament_id, round_number, round_name, home_id, away_id, phase) VALUES ($1,$2,$3,$4,$5,$6)',
          [tId, rNum, rName, m.home, m.away, phase]
        );
      }
    }
  }

  if (legs === 2) {
    await insertRounds(rounds, 'Fecha (Ida)', 0);
    const vuelta = rounds.map(r => r.map(m => ({ home: m.away, away: m.home })));
    await insertRounds(vuelta, 'Fecha (Vuelta)', rounds.length);
  } else {
    await insertRounds(rounds, 'Fecha', 0);
  }
}

// Insert knockout pairs (semis or final)
// roundLabel: 'Semifinal', 'Final', 'Cuartos de Final', etc.
// phase: 'semi', 'final', 'copa_semi', 'copa_final', 'supercopa_semi', 'supercopa_final'
async function insertKnockoutPairs(client, tId, pairs, legs, roundLabel, phase, roundOffset = 0) {
  for (let slot = 0; slot < pairs.length; slot++) {
    const [homeTeam, awayTeam] = pairs[slot];
    if (legs === 2) {
      await client.query(
        'INSERT INTO matches (tournament_id, round_number, round_name, home_id, away_id, phase, bracket_slot) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [tId, roundOffset + 1, `${roundLabel} – Ida`, homeTeam, awayTeam, phase, slot]
      );
      await client.query(
        'INSERT INTO matches (tournament_id, round_number, round_name, home_id, away_id, phase, bracket_slot) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [tId, roundOffset + 2, `${roundLabel} – Vuelta`, awayTeam, homeTeam, phase, slot]
      );
    } else {
      await client.query(
        'INSERT INTO matches (tournament_id, round_number, round_name, home_id, away_id, phase, bracket_slot) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [tId, roundOffset + 1, roundLabel, homeTeam, awayTeam, phase, slot]
      );
    }
  }
}

// ─── GET /api/tournaments ─────────────────────────────────────────────────────
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
      return { ...t, participant_ids: participantIds, prizes: JSON.parse(t.prizes || '[]'), participants };
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─── POST /api/tournaments ────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const { name, participantIds, prizes, legs, legs_copa, tournament_type } = req.body;
  const type = tournament_type || 'league';

  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  if (type === 'friendly' && (!participantIds || participantIds.length !== 2))
    return res.status(400).json({ error: 'Un amistoso requiere exactamente 2 participantes' });
  if (type !== 'friendly' && (!participantIds || participantIds.length < 2))
    return res.status(400).json({ error: 'Al menos 2 participantes requeridos' });

  const legsLiga = (legs === 2 || legs === '2') ? 2 : 1;
  const legsCopa = (legs_copa === 2 || legs_copa === '2') ? 2 : 1;

  // League: use roundrobin or groups format (existing logic)
  const format = participantIds.length <= 6 ? 'roundrobin' : 'groups';

  try {
    const tId = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO tournaments (name, format, status, participant_ids, prizes, legs, legs_copa, tournament_type, current_phase, created_at)
         VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          name, format, JSON.stringify(participantIds),
          JSON.stringify(prizes || [0, 0, 0]),
          legsLiga, legsCopa, type,
          type === 'superliga' ? 'liga' : null,
          Date.now()
        ]
      );
      const id = rows[0].id;

      if (type === 'league') {
        // Round-robin (existing behavior)
        if (format === 'roundrobin') {
          await insertLeagueRounds(client, id, participantIds, legsLiga, null);
        } else {
          const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
          const half = Math.ceil(shuffled.length / 2);
          await insertLeagueRounds(client, id, shuffled.slice(0, half), legsLiga, null);
          await insertLeagueRounds(client, id, shuffled.slice(half), legsLiga, null);
        }

      } else if (type === 'cup') {
        // Knockout bracket
        const pairs = shuffleIntoPairs(participantIds);
        const hasQuarters = participantIds.length >= 8;
        if (hasQuarters) {
          await insertKnockoutPairs(client, id, pairs, legsLiga, 'Cuartos de Final', 'quarter', 0);
        } else {
          await insertKnockoutPairs(client, id, pairs, legsLiga, 'Semifinal', 'semi', 0);
        }

      } else if (type === 'superliga') {
        // Only liga phase at creation
        await insertLeagueRounds(client, id, participantIds, legsLiga, 'liga');

      } else if (type === 'friendly') {
        // Single match
        await client.query(
          'INSERT INTO matches (tournament_id, round_number, round_name, home_id, away_id, phase) VALUES ($1,1,$2,$3,$4,$5)',
          [id, 'Amistoso', participantIds[0], participantIds[1], 'friendly']
        );
      }

      return id;
    });

    res.json({ success: true, id: tId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─── POST /api/tournaments/:id/advance-round  (for cup) ───────────────────────
// Advances from quarter→semi or semi→final based on current results
router.post('/:id/advance-round', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const tId = parseInt(req.params.id, 10);
  try {
    const { rows: tRows } = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tId]);
    if (!tRows[0]) return res.status(404).json({ error: 'Torneo no encontrado' });
    const t = tRows[0];
    if (t.tournament_type !== 'cup') return res.status(400).json({ error: 'Solo para torneos tipo Copa' });
    if (t.status === 'finished') return res.status(400).json({ error: 'El torneo ya está finalizado' });

    const { rows: matches } = await pool.query(
      'SELECT * FROM matches WHERE tournament_id = $1', [tId]
    );

    const legs = t.legs || 1;

    // Check what's the current state
    const quarters = matches.filter(m => m.phase === 'quarter');
    const semis    = matches.filter(m => m.phase === 'semi');
    const finals   = matches.filter(m => m.phase === 'final');

    // Already has a final?
    if (finals.length > 0) return res.status(400).json({ error: 'Ya existe una final. Finalizá el torneo cuando se juegue.' });

    // Advance quarter → semi
    if (quarters.length > 0 && semis.length === 0) {
      const unplayed = quarters.filter(m => m.home_score === null);
      if (unplayed.length > 0) return res.status(400).json({ error: `Faltan ${unplayed.length} partido(s) de cuartos por jugarse` });

      // Determine winners by bracket_slot
      const slots = [...new Set(quarters.map(m => m.bracket_slot))];
      const semiPairs = slots.map(slot => {
        const { winnerId } = getBracketSlotResult(quarters.filter(m => m.bracket_slot === slot));
        return winnerId;
      });
      // Pair winners: [0 vs 1, 2 vs 3, ...]
      const pairs = [];
      for (let i = 0; i < semiPairs.length; i += 2) {
        if (semiPairs[i + 1] !== undefined) pairs.push([semiPairs[i], semiPairs[i + 1]]);
      }
      await withTransaction(async (client) => {
        await insertKnockoutPairs(client, tId, pairs, legs, 'Semifinal', 'semi', 0);
      });
      return res.json({ success: true, message: 'Semifinales generadas', phase: 'semi' });
    }

    // Advance semi → final
    const currentSemis = semis.length > 0 ? semis : quarters;
    const phaseToCheck = semis.length > 0 ? semis : quarters;
    const unplayed = phaseToCheck.filter(m => m.home_score === null);
    if (unplayed.length > 0) return res.status(400).json({ error: `Faltan ${unplayed.length} partido(s) por jugarse` });

    const slots = [...new Set(phaseToCheck.map(m => m.bracket_slot))];
    const finalists = slots.map(slot => {
      const { winnerId } = getBracketSlotResult(phaseToCheck.filter(m => m.bracket_slot === slot));
      return winnerId;
    });
    // Final: winner[0] vs winner[1]
    const finalPairs = [[finalists[0], finalists[1]]];

    await withTransaction(async (client) => {
      await insertKnockoutPairs(client, tId, finalPairs, 1, 'Final', 'final', 0);
    });
    res.json({ success: true, message: 'Final generada', phase: 'final' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─── POST /api/tournaments/:id/advance-copa  (for superliga) ──────────────────
// First call: liga done → create copa semis
// Second call: copa semis done → create copa final
router.post('/:id/advance-copa', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const tId = parseInt(req.params.id, 10);
  try {
    const { rows: tRows } = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tId]);
    if (!tRows[0]) return res.status(404).json({ error: 'Torneo no encontrado' });
    const t = tRows[0];
    if (t.tournament_type !== 'superliga') return res.status(400).json({ error: 'Solo para Superliga' });
    if (t.status === 'finished') return res.status(400).json({ error: 'El torneo ya está finalizado' });

    const { rows: matches } = await pool.query('SELECT * FROM matches WHERE tournament_id = $1', [tId]);
    const participantIds = JSON.parse(t.participant_ids || '[]');
    const legsCopa = t.legs_copa || 1;

    const ligaMatches   = matches.filter(m => m.phase === 'liga');
    const copasSemi     = matches.filter(m => m.phase === 'copa_semi');
    const copaFinal     = matches.filter(m => m.phase === 'copa_final');

    // Step 2: copa semi done → create copa final
    if (copasSemi.length > 0 && copaFinal.length === 0) {
      const unplayed = copasSemi.filter(m => m.home_score === null);
      if (unplayed.length > 0)
        return res.status(400).json({ error: `Faltan ${unplayed.length} partido(s) de semifinal por jugarse` });

      const slots = [...new Set(copasSemi.map(m => m.bracket_slot))];
      const finalists = slots.map(slot => {
        const { winnerId } = getBracketSlotResult(copasSemi.filter(m => m.bracket_slot === slot));
        return winnerId;
      });

      await withTransaction(async (client) => {
        await insertKnockoutPairs(client, tId, [[finalists[0], finalists[1]]], 1, 'Copa – Final', 'copa_final', 0);
      });
      return res.json({ success: true, message: 'Final de Copa generada', phase: 'copa_final' });
    }

    // Step 1: liga done → create copa semis
    if (copasSemi.length === 0) {
      const unplayed = ligaMatches.filter(m => m.home_score === null);
      if (unplayed.length > 0)
        return res.status(400).json({ error: `Faltan ${unplayed.length} partido(s) de liga por jugarse` });

      const standings = computeStandings(participantIds, ligaMatches);
      const pairs = seedCopaPairs(standings);

      await withTransaction(async (client) => {
        await insertKnockoutPairs(client, tId, pairs, legsCopa, 'Copa – Semifinal', 'copa_semi', 0);
        await client.query("UPDATE tournaments SET current_phase = 'copa' WHERE id = $1", [tId]);
      });
      return res.json({ success: true, message: 'Semifinales de Copa generadas', phase: 'copa_semi' });
    }

    res.status(400).json({ error: 'No hay una acción de Copa disponible en este momento' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─── POST /api/tournaments/:id/advance-supercopa  (for superliga) ──────────────
// Handles: copa done → create supercopa (semi or final based on double champ)
//          supercopa semi done → create supercopa final
router.post('/:id/advance-supercopa', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const tId = parseInt(req.params.id, 10);
  try {
    const { rows: tRows } = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tId]);
    if (!tRows[0]) return res.status(404).json({ error: 'Torneo no encontrado' });
    const t = tRows[0];
    if (t.tournament_type !== 'superliga') return res.status(400).json({ error: 'Solo para Superliga' });
    if (t.status === 'finished') return res.status(400).json({ error: 'El torneo ya está finalizado' });

    const { rows: matches } = await pool.query('SELECT * FROM matches WHERE tournament_id = $1', [tId]);
    const participantIds = JSON.parse(t.participant_ids || '[]');

    const ligaMatches    = matches.filter(m => m.phase === 'liga');
    const copasSemi      = matches.filter(m => m.phase === 'copa_semi');
    const copaFinal      = matches.filter(m => m.phase === 'copa_final');
    const supercopaSemi  = matches.filter(m => m.phase === 'supercopa_semi');
    const supercopaFinal = matches.filter(m => m.phase === 'supercopa_final');

    // Step 2: supercopa semi done → create supercopa final
    if (supercopaSemi.length > 0 && supercopaFinal.length === 0) {
      const unplayed = supercopaSemi.filter(m => m.home_score === null);
      if (unplayed.length > 0)
        return res.status(400).json({ error: `Faltan ${unplayed.length} partido(s) de la Semifinal Supercopa` });

      const { winnerId: semiWinner } = getBracketSlotResult(supercopaSemi);
      // The double champion is the team that won both liga and copa
      const ligaStandings = computeStandings(participantIds, ligaMatches);
      const ligaWinner = ligaStandings[0].id;
      // Copa winner is determined from copa final
      const copaWinnerResult = getBracketSlotResult(copaFinal);
      const copaWinner = copaWinnerResult.winnerId;

      // Double champion waits in the final
      const doubleChamp = ligaWinner === copaWinner ? ligaWinner : null;

      await withTransaction(async (client) => {
        await insertKnockoutPairs(client, tId, [[semiWinner, doubleChamp]], 1, 'Supercopa – Final', 'supercopa_final', 0);
      });
      return res.json({ success: true, message: 'Final de la Supercopa generada', phase: 'supercopa_final' });
    }

    // Step 1: copa done → create supercopa
    if (supercopaSemi.length === 0 && supercopaFinal.length === 0) {
      if (copaFinal.length === 0)
        return res.status(400).json({ error: 'La fase Copa aún no ha finalizado' });

      const unplayed = copaFinal.filter(m => m.home_score === null);
      if (unplayed.length > 0)
        return res.status(400).json({ error: `Faltan ${unplayed.length} partido(s) de la Final de Copa` });

      const ligaStandings = computeStandings(participantIds, ligaMatches);
      const ligaWinner  = ligaStandings[0].id;
      const ligaSecond  = ligaStandings[1]?.id;

      const { winnerId: copaWinner, loserId: copaRunnerUp } = getBracketSlotResult(copaFinal);

      const isDouble = ligaWinner === copaWinner;
      await withTransaction(async (client) => {
        if (isDouble) {
          await insertKnockoutPairs(
            client, tId, [[ligaSecond, copaRunnerUp]], 1, 'Supercopa – Semifinal', 'supercopa_semi', 0
          );
        } else {
          await insertKnockoutPairs(
            client, tId, [[ligaWinner, copaWinner]], 1, 'Supercopa – Final', 'supercopa_final', 0
          );
        }
        await client.query("UPDATE tournaments SET current_phase = 'supercopa' WHERE id = $1", [tId]);
      });

      if (isDouble) {
        return res.json({ success: true, message: 'Campeón doble detectado. Semifinal de Supercopa generada', phase: 'supercopa_semi' });
      } else {
        return res.json({ success: true, message: 'Final de Supercopa generada', phase: 'supercopa_final' });
      }
    }

    res.status(400).json({ error: 'No hay una acción de Supercopa disponible en este momento' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─── POST /api/tournaments/:id/finish ─────────────────────────────────────────
router.post('/:id/finish', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const tournamentId = parseInt(req.params.id, 10);
  try {
    const { rows: tRows } = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (!tRows[0]) return res.status(404).json({ error: 'Torneo no encontrado' });
    const tournament = tRows[0];
    if (tournament.status === 'finished') return res.status(400).json({ error: 'El torneo ya está finalizado' });

    const participantIds = JSON.parse(tournament.participant_ids || '[]');
    const prizes = JSON.parse(tournament.prizes || '[]');
    const { rows: matches } = await pool.query('SELECT * FROM matches WHERE tournament_id = $1', [tournamentId]);

    const type = tournament.tournament_type || 'league';

    // Pre-validate before opening transaction (avoid errors mid-transaction)
    if (type === 'cup') {
      const finalMatches = matches.filter(m => m.phase === 'final');
      if (finalMatches.length === 0) return res.status(400).json({ error: 'La final aún no se ha jugado' });
      if (finalMatches.some(m => m.home_score === null)) return res.status(400).json({ error: 'La final no ha terminado' });
    }
    if (type === 'superliga') {
      const supercopaFinal = matches.filter(m => m.phase === 'supercopa_final');
      if (supercopaFinal.length === 0) return res.status(400).json({ error: 'La Supercopa aún no se ha jugado' });
      if (supercopaFinal.some(m => m.home_score === null)) return res.status(400).json({ error: 'La Supercopa no ha terminado' });
    }

    await withTransaction(async (client) => {

      if (type === 'league' || type === 'friendly') {
        const standings = computeStandings(participantIds, matches);
        for (let i = 0; i < prizes.length; i++) {
          if (standings[i] && prizes[i] > 0)
            await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [prizes[i], standings[i].id]);
        }
        await client.query(
          "UPDATE tournaments SET status = 'finished', liga_winner_id = $1 WHERE id = $2",
          [standings[0]?.id || null, tournamentId]
        );

      } else if (type === 'cup') {
        const finalMatches = matches.filter(m => m.phase === 'final');
        const { winnerId, loserId } = getBracketSlotResult(finalMatches);
        if (prizes[0] > 0) await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [prizes[0], winnerId]);
        if (prizes[1] > 0) await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [prizes[1], loserId]);
        await client.query(
          "UPDATE tournaments SET status = 'finished', copa_winner_id = $1 WHERE id = $2",
          [winnerId, tournamentId]
        );

      } else if (type === 'superliga') {
        const ligaMatches    = matches.filter(m => m.phase === 'liga');
        const copaFinal      = matches.filter(m => m.phase === 'copa_final');
        const supercopaFinal = matches.filter(m => m.phase === 'supercopa_final');

        const ligaWinner      = computeStandings(participantIds, ligaMatches)[0]?.id || null;
        const copaWinner      = copaFinal.length > 0 ? getBracketSlotResult(copaFinal).winnerId : null;
        const supercopaWinner = getBracketSlotResult(supercopaFinal).winnerId;

        if (prizes[0] > 0) await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [prizes[0], supercopaWinner]);
        if (prizes[1] > 0 && ligaWinner) await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [prizes[1], ligaWinner]);
        if (prizes[2] > 0 && copaWinner) await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [prizes[2], copaWinner]);

        await client.query(
          "UPDATE tournaments SET status = 'finished', current_phase = 'completed', liga_winner_id = $1, copa_winner_id = $2, supercopa_winner_id = $3 WHERE id = $4",
          [ligaWinner, copaWinner, supercopaWinner, tournamentId]
        );
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
