const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, adminCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    }

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE username = $1', [username]
    );
    if (existing[0]) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const { rows: cfgAdmin } = await pool.query(
      "SELECT value FROM config WHERE key = 'admin_code'"
    );
    const isAdmin = adminCode && cfgAdmin[0] && adminCode === cfgAdmin[0].value ? 1 : 0;

    const { rows: cfgBudget } = await pool.query(
      "SELECT value FROM config WHERE key = 'initial_budget'"
    );
    const initialBudget = cfgBudget[0] ? parseInt(cfgBudget[0].value, 10) : 50000000;

    const passwordHash = await bcrypt.hash(password, 10);

    const { rows: inserted } = await pool.query(
      `INSERT INTO users (username, password_hash, is_admin, budget, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [username, passwordHash, isAdmin, initialBudget, Date.now()]
    );

    const user = {
      id: inserted[0].id,
      username,
      is_admin: isAdmin,
      team_name: null,
      budget: initialBudget
    };

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username = $1', [username]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        team_name: user.team_name,
        budget: user.budget
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
