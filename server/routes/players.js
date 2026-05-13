const express = require('express');
const { pool, withTransaction } = require('../db');
const { authenticate } = require('../middleware/auth');
const { logTransfer } = require('../transfers');

const router = express.Router();

const POSITION_GROUP = {
  GK:  'gk',
  CB:  'def', LB: 'def',
  CDM: 'mid', CM: 'mid', CAM: 'mid',
  LW:  'fwd', ST: 'fwd'
};

// All config keys needed for price calculation
const PRICE_CONFIG_KEYS =
  "'price_multiplier','pos_mult_gk','pos_mult_def','pos_mult_mid','pos_mult_fwd','rating_threshold','low_rating_mult'";

// Pure price calculation — pass a cfg object already fetched from DB
function calcPrice(player, cfg) {
  const base      = parseInt(cfg.price_multiplier  || '1000', 10);
  const group     = POSITION_GROUP[player.position] || 'mid';
  const posMult   = parseFloat(cfg[`pos_mult_${group}`] || '1.0');
  const threshold = parseInt(cfg.rating_threshold   || '80',  10);
  const lowMult   = parseFloat(cfg.low_rating_mult  || '0.5');
  const ratingMult    = player.rating < threshold ? lowMult : 1.0;
  const purchaseBoost = Math.pow(1.1, player.purchase_count || 0);
  return Math.round(player.rating * player.rating * base * posMult * ratingMult * purchaseBoost);
}

// Fetches config once then calls calcPrice
async function getPlayerPrice(player) {
  const { rows } = await pool.query(
    `SELECT key, value FROM config WHERE key IN (${PRICE_CONFIG_KEYS})`
  );
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return calcPrice(player, cfg);
}

// GET /api/players
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, u.username as owner_username
      FROM players p
      LEFT JOIN users u ON p.owner_id = u.id
      ORDER BY p.rating DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/players/market
router.get('/market', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, u.username as owner_username
      FROM players p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.listed_price IS NOT NULL
      AND (p.owner_id != $1 OR p.owner_id IS NULL)
      ORDER BY p.listed_price ASC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/players/clauses — ALL owned players (except mine), effective clause = stored ?? base price
router.get('/clauses', authenticate, async (req, res) => {
  try {
    const { rows: cfgRows } = await pool.query(
      `SELECT key, value FROM config WHERE key IN (${PRICE_CONFIG_KEYS})`
    );
    const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));

    const { rows } = await pool.query(`
      SELECT p.*, u.username as owner_username
      FROM players p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.owner_id IS NOT NULL
        AND p.owner_id != $1
        AND p.listed_price IS NULL
      ORDER BY p.rating DESC
    `, [req.user.id]);

    const result = rows.map(p => {
      const basePrice = calcPrice(p, cfg);
      return {
        ...p,
        base_price: basePrice,
        release_clause: p.release_clause ?? basePrice,
      };
    });

    result.sort((a, b) => a.release_clause - b.release_clause);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/players/free
router.get('/free', async (req, res) => {
  try {
    const { rows: cfgRows } = await pool.query(
      `SELECT key, value FROM config WHERE key IN (${PRICE_CONFIG_KEYS},'hide_without_team')`
    );
    const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));
    const hideWithout = cfg.hide_without_team === '1';

    const whereExtra = hideWithout
      ? `AND p.pes_team IS NOT NULL AND p.pes_team != '' AND p.pes_team NOT ILIKE 'without%team%'`
      : '';

    const { rows } = await pool.query(`
      SELECT p.*, NULL as owner_username
      FROM players p
      WHERE p.owner_id IS NULL ${whereExtra}
      ORDER BY p.rating DESC
    `);

    res.json(rows.map(p => ({ ...p, price: calcPrice(p, cfg) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/players/my — includes base_price so clients don't need config to show prices
router.get('/my', authenticate, async (req, res) => {
  try {
    const { rows: cfgRows } = await pool.query(
      `SELECT key, value FROM config WHERE key IN (${PRICE_CONFIG_KEYS})`
    );
    const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));

    const { rows } = await pool.query(`
      SELECT p.*, u.username as owner_username
      FROM players p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.owner_id = $1
      ORDER BY p.rating DESC
    `, [req.user.id]);

    const result = rows.map(p => {
      const basePrice = calcPrice(p, cfg);
      return { ...p, base_price: basePrice };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/players/:id/list
router.post('/:id/list', authenticate, async (req, res) => {
  const { price } = req.body;
  const playerId = req.params.id;

  if (!price || !Number.isInteger(Number(price)) || Number(price) <= 0) {
    return res.status(400).json({ error: 'El precio debe ser un número entero positivo' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    const player = rows[0];
    if (player.owner_id !== req.user.id) return res.status(403).json({ error: 'No es tu jugador' });

    const { rows: cfgRows } = await pool.query(
      "SELECT value FROM config WHERE key = 'min_roster'"
    );
    const minRoster = cfgRows[0] ? parseInt(cfgRows[0].value, 10) : 18;
    const { rows: cntRows } = await pool.query(
      'SELECT COUNT(*)::int as cnt FROM players WHERE owner_id = $1', [req.user.id]
    );
    if (cntRows[0].cnt <= minRoster) {
      return res.status(400).json({
        error: `No podés poner jugadores en venta con ${minRoster} o menos jugadores en el plantel (mínimo: ${minRoster})`
      });
    }

    await pool.query('UPDATE players SET listed_price = $1 WHERE id = $2', [parseInt(price, 10), playerId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/players/:id/unlist
router.post('/:id/unlist', authenticate, async (req, res) => {
  const playerId = req.params.id;
  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    if (rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'No es tu jugador' });

    await pool.query('UPDATE players SET listed_price = NULL WHERE id = $1', [playerId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/players/:id/clause — raise clause above base price; owner pays the difference
router.post('/:id/clause', authenticate, async (req, res) => {
  const { amount } = req.body;
  const playerId = req.params.id;

  if (!amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número entero positivo' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    const player = rows[0];
    if (player.owner_id !== req.user.id) return res.status(403).json({ error: 'No es tu jugador' });

    const basePrice = await getPlayerPrice(player);
    const currentClause = player.release_clause ?? basePrice;
    const newAmount = parseInt(amount, 10);

    if (newAmount <= currentClause) {
      return res.status(400).json({
        error: `La nueva cláusula debe ser mayor a la actual (${currentClause.toLocaleString()})`
      });
    }

    const cost = newAmount - currentClause;

    const { rows: ownerRows } = await pool.query(
      'SELECT budget FROM users WHERE id = $1', [req.user.id]
    );
    if (ownerRows[0].budget < cost) {
      return res.status(400).json({
        error: `Presupuesto insuficiente (necesitás ${cost.toLocaleString()} para subir la cláusula)`
      });
    }

    await withTransaction(async (client) => {
      await client.query('UPDATE users SET budget = budget - $1 WHERE id = $2', [cost, req.user.id]);
      await client.query('UPDATE players SET release_clause = $1 WHERE id = $2', [newAmount, playerId]);
    });

    res.json({ success: true, newClause: newAmount, paid: cost });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/players/:id/remove-clause
router.post('/:id/remove-clause', authenticate, async (req, res) => {
  const playerId = req.params.id;
  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    if (rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'No es tu jugador' });

    await pool.query('UPDATE players SET release_clause = NULL WHERE id = $1', [playerId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/players/:id/release
router.post('/:id/release', authenticate, async (req, res) => {
  const playerId = req.params.id;

  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    const player = rows[0];
    if (player.owner_id !== req.user.id) return res.status(403).json({ error: 'No es tu jugador' });

    const { rows: cfgMin } = await pool.query("SELECT value FROM config WHERE key = 'min_roster'");
    const minRoster = cfgMin[0] ? parseInt(cfgMin[0].value, 10) : 18;
    const { rows: cntRows } = await pool.query(
      'SELECT COUNT(*)::int as cnt FROM players WHERE owner_id = $1', [req.user.id]
    );
    if (cntRows[0].cnt <= minRoster) {
      return res.status(400).json({
        error: `No podés liberar jugadores con ${minRoster} o menos en el plantel (mínimo: ${minRoster})`
      });
    }

    const { rows: cfgPct } = await pool.query("SELECT value FROM config WHERE key = 'release_pct'");
    const releasePct = cfgPct[0] ? parseInt(cfgPct[0].value, 10) : 60;

    const basePrice = await getPlayerPrice(player);
    const payout = Math.round(basePrice * releasePct / 100);

    const { rows: ownerRows } = await pool.query(
      'SELECT id, username FROM users WHERE id = $1', [req.user.id]
    );
    const owner = ownerRows[0];

    await withTransaction(async (client) => {
      await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [payout, req.user.id]);
      await client.query(
        'UPDATE players SET owner_id = NULL, listed_price = NULL, release_clause = NULL WHERE id = $1',
        [playerId]
      );
      await logTransfer({ type: 'liberacion', player, from: owner, to: null, price: payout, _client: client });
    });

    res.json({ success: true, payout, basePrice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/players/:id/offer  { amount }  — oferta por debajo de la cláusula (dueño acepta/rechaza)
router.post('/:id/offer', authenticate, async (req, res) => {
  const playerId = req.params.id;
  const { amount } = req.body;

  if (!amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número entero positivo' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    const player = rows[0];

    if (!player.owner_id) return res.status(400).json({ error: 'El jugador no tiene dueño' });
    if (player.owner_id === req.user.id) return res.status(400).json({ error: 'No podés hacerte una oferta a vos mismo' });

    const { rows: cfgRows } = await pool.query(
      `SELECT key, value FROM config WHERE key IN (${PRICE_CONFIG_KEYS})`
    );
    const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));
    const basePrice  = calcPrice(player, cfg);
    const clauseVal  = player.release_clause ?? basePrice;
    const offerAmt   = parseInt(amount, 10);

    if (offerAmt >= clauseVal) {
      return res.status(400).json({
        error: `Para pagar la cláusula completa (${clauseVal.toLocaleString()}) usá "Activar cláusula"`
      });
    }

    const { rows: buyerRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const buyer = buyerRows[0];
    if (buyer.budget < offerAmt) return res.status(400).json({ error: 'Presupuesto insuficiente' });

    const { rows: cfgMax } = await pool.query("SELECT value FROM config WHERE key = 'max_roster'");
    const maxRoster = cfgMax[0] ? parseInt(cfgMax[0].value, 10) : 22;
    const { rows: rosterRows } = await pool.query(
      'SELECT COUNT(*)::int as cnt FROM players WHERE owner_id = $1', [req.user.id]
    );
    if (rosterRows[0].cnt >= maxRoster) {
      return res.status(400).json({ error: `Ya tenés el plantel lleno (máx. ${maxRoster})` });
    }

    // Check no duplicate pending direct offer
    const { rows: existOffer } = await pool.query(
      "SELECT id FROM clause_offers WHERE player_id = $1 AND buyer_id = $2 AND status = 'pending' AND offer_type = 'offer'",
      [playerId, req.user.id]
    );
    if (existOffer[0]) return res.status(400).json({ error: 'Ya tenés una oferta pendiente para este jugador' });

    const { rows: ownerRows } = await pool.query('SELECT id, username FROM users WHERE id = $1', [player.owner_id]);
    const owner = ownerRows[0];

    await pool.query(`
      INSERT INTO clause_offers
        (player_id, player_name, player_rating, player_position,
         buyer_id, buyer_username, owner_id, owner_username, clause_amount, offer_type, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'offer',$10)
    `, [
      player.id, player.name, player.rating, player.position,
      req.user.id, buyer.username,
      owner.id, owner.username,
      offerAmt, Date.now()
    ]);

    res.json({ success: true, message: 'Oferta enviada. El dueño puede aceptarla o rechazarla.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/players/:id/buy
router.post('/:id/buy', authenticate, async (req, res) => {
  const playerId = req.params.id;

  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    const player = rows[0];
    if (player.owner_id === req.user.id) {
      return res.status(400).json({ error: 'Ya eres el dueño de este jugador' });
    }

    let price = null;
    let isClausePurchase = false;

    if (player.listed_price !== null) {
      // Direct purchase at listed price (instant)
      price = player.listed_price;
    } else if (player.owner_id === null) {
      // Free agent — buy at base price instantly
      price = player.release_clause ?? await getPlayerPrice(player);
    } else {
      // Owned player — always a clause purchase (pending offer)
      // Effective clause = explicitly raised clause OR base price
      price = player.release_clause ?? await getPlayerPrice(player);
      isClausePurchase = true;
    }

    const { rows: buyerRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const buyer = buyerRows[0];
    if (buyer.budget < price) {
      return res.status(400).json({ error: 'Presupuesto insuficiente' });
    }

    const { rows: cfgMax } = await pool.query("SELECT value FROM config WHERE key = 'max_roster'");
    const maxRoster = cfgMax[0] ? parseInt(cfgMax[0].value, 10) : 22;
    const { rows: rosterRows } = await pool.query(
      'SELECT COUNT(*)::int as cnt FROM players WHERE owner_id = $1', [req.user.id]
    );
    if (rosterRows[0].cnt >= maxRoster) {
      return res.status(400).json({ error: `Has alcanzado el límite máximo de ${maxRoster} jugadores` });
    }

    if (isClausePurchase) {
      const { rows: existOffer } = await pool.query(
        "SELECT id FROM clause_offers WHERE player_id = $1 AND buyer_id = $2 AND status = 'pending'",
        [playerId, req.user.id]
      );
      if (existOffer[0]) {
        return res.status(400).json({ error: 'Ya tenés una oferta pendiente para este jugador' });
      }

      const { rows: ownerRows } = await pool.query(
        'SELECT id, username FROM users WHERE id = $1', [player.owner_id]
      );
      const owner = ownerRows[0];

      await pool.query(`
        INSERT INTO clause_offers
          (player_id, player_name, player_rating, player_position,
           buyer_id, buyer_username, owner_id, owner_username, clause_amount, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        player.id, player.name, player.rating, player.position,
        req.user.id, buyer.username,
        owner.id, owner.username,
        price, Date.now()
      ]);

      return res.json({
        success: true, pending: true, price,
        message: 'Oferta enviada. El manager puede aceptar o subir la cláusula.'
      });
    }

    // Instant transfer
    if (player.owner_id !== null) {
      const { rows: cfgMin } = await pool.query("SELECT value FROM config WHERE key = 'min_roster'");
      const minRoster = cfgMin[0] ? parseInt(cfgMin[0].value, 10) : 18;
      const { rows: sellerCnt } = await pool.query(
        'SELECT COUNT(*)::int as cnt FROM players WHERE owner_id = $1', [player.owner_id]
      );
      if (sellerCnt[0].cnt <= minRoster) {
        return res.status(400).json({
          error: `El vendedor no puede quedar con menos de ${minRoster} jugadores`
        });
      }
    }

    const { rows: buyerUserRows } = await pool.query(
      'SELECT id, username FROM users WHERE id = $1', [req.user.id]
    );
    const buyerUser = buyerUserRows[0];
    const sellerUser = player.owner_id
      ? (await pool.query('SELECT id, username FROM users WHERE id = $1', [player.owner_id])).rows[0]
      : null;

    await withTransaction(async (client) => {
      await client.query('UPDATE users SET budget = budget - $1 WHERE id = $2', [price, req.user.id]);
      if (player.owner_id !== null) {
        await client.query('UPDATE users SET budget = budget + $1 WHERE id = $2', [price, player.owner_id]);
      }
      await client.query(
        'UPDATE players SET owner_id = $1, listed_price = NULL, release_clause = NULL, purchase_count = purchase_count + 1 WHERE id = $2',
        [req.user.id, playerId]
      );
      await logTransfer({ type: 'compra', player, from: sellerUser, to: buyerUser, price, _client: client });
    });

    res.json({ success: true, pending: false, price });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/players/:id/profile
router.get('/:id/profile', async (req, res) => {
  const playerId = req.params.id;
  try {
    const { rows } = await pool.query(`
      SELECT p.*, u.username as owner_username, u.team_name as owner_team
      FROM players p LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.id = $1
    `, [playerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });

    const { rows: history } = await pool.query(
      'SELECT * FROM transfers WHERE player_id = $1 ORDER BY created_at DESC',
      [playerId]
    );

    const { rows: matches } = await pool.query(
      'SELECT scorers FROM matches WHERE scorers IS NOT NULL'
    );
    let goals = 0;
    for (const m of matches) {
      try {
        const scorers = JSON.parse(m.scorers);
        const entry = scorers.find(s => s.player_id === playerId);
        if (entry) goals += entry.count || 1;
      } catch {}
    }

    res.json({ player: rows[0], history, goals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/players/:id/edit
router.post('/:id/edit', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const { name, position, rating } = req.body;
  const playerId = req.params.id;

  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (!rows[0]) return res.status(404).json({ error: 'Jugador no encontrado' });
    const player = rows[0];

    await pool.query(
      'UPDATE players SET name = $1, position = $2, rating = $3 WHERE id = $4',
      [
        name || player.name,
        position || player.position,
        rating !== undefined ? parseInt(rating, 10) : player.rating,
        playerId
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/players/add
router.post('/add', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const { id, name, pes_team, nationality, position, pes_position, rating, age, foot } = req.body;

  if (!id || !name || !position || !rating) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const { rows } = await pool.query('SELECT id FROM players WHERE id = $1', [id]);
    if (rows[0]) return res.status(400).json({ error: 'Ya existe un jugador con ese ID' });

    await pool.query(`
      INSERT INTO players
        (id, name, pes_team, nationality, position, pes_position, rating, age, foot,
         owner_id, listed_price, release_clause)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,NULL,NULL)
    `, [
      id, name, pes_team || '', nationality || '', position,
      pes_position || position, parseInt(rating, 10),
      age ? parseInt(age, 10) : null, foot || ''
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
