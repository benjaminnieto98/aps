const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = 'aps-secret-key-2006';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, username, is_admin, team_name, budget FROM users WHERE id = $1',
      [payload.id]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, username, is_admin, team_name, budget FROM users WHERE id = $1',
      [payload.id]
    );
    req.user = rows[0] || null;
  } catch (err) {
    req.user = null;
  }
  next();
}

module.exports = { authenticate, optionalAuth, JWT_SECRET };
