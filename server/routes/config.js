const express = require('express');
const { pool } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/config
router.get('/', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  try {
    const { rows } = await pool.query('SELECT key, value FROM config');
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));

    res.json({
      initialBudget:    parseInt(cfg.initial_budget   || '50000000', 10),
      priceMultiplier:  parseInt(cfg.price_multiplier  || '1000',     10),
      maxRoster:        parseInt(cfg.max_roster        || '22',       10),
      minRoster:        parseInt(cfg.min_roster        || '18',       10),
      releasePct:       parseInt(cfg.release_pct       || '60',       10),
      adminCode:        cfg.admin_code || 'aps2006',
      posMultGk:        parseFloat(cfg.pos_mult_gk  || '0.8'),
      posMultDef:       parseFloat(cfg.pos_mult_def || '0.9'),
      posMultMid:       parseFloat(cfg.pos_mult_mid || '1.0'),
      posMultFwd:       parseFloat(cfg.pos_mult_fwd || '1.2'),
      hideWithoutTeam:  cfg.hide_without_team === '1',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/config
router.put('/', authenticate, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo administradores' });

  const {
    initialBudget, priceMultiplier, maxRoster, minRoster,
    releasePct, adminCode,
    posMultGk, posMultDef, posMultMid, posMultFwd,
    hideWithoutTeam
  } = req.body;

  try {
    const updates = [
      ['initial_budget',    initialBudget    !== undefined ? String(parseInt(initialBudget,    10)) : null],
      ['price_multiplier',  priceMultiplier  !== undefined ? String(parseInt(priceMultiplier,  10)) : null],
      ['max_roster',        maxRoster        !== undefined ? String(parseInt(maxRoster,         10)) : null],
      ['min_roster',        minRoster        !== undefined ? String(parseInt(minRoster,          10)) : null],
      ['release_pct',       releasePct       !== undefined ? String(parseInt(releasePct,         10)) : null],
      ['admin_code',        adminCode        !== undefined ? String(adminCode) : null],
      ['pos_mult_gk',       posMultGk        !== undefined ? String(parseFloat(posMultGk))   : null],
      ['pos_mult_def',      posMultDef       !== undefined ? String(parseFloat(posMultDef))  : null],
      ['pos_mult_mid',      posMultMid       !== undefined ? String(parseFloat(posMultMid))  : null],
      ['pos_mult_fwd',      posMultFwd       !== undefined ? String(parseFloat(posMultFwd))  : null],
      ['hide_without_team', hideWithoutTeam  !== undefined ? (hideWithoutTeam ? '1' : '0')   : null],
    ];

    for (const [key, value] of updates) {
      if (value !== null) {
        await pool.query(
          'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [key, value]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
