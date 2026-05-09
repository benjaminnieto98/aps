const { Pool, types } = require('pg');

// Parse PostgreSQL BIGINT (OID 20) as JS number instead of string
types.setTypeParser(20, (val) => parseInt(val, 10));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

// Force UTF-8 on every connection so accented characters (é, ñ, ü…) are stored/returned correctly
pool.on('connect', client => {
  client.query("SET client_encoding TO 'UTF8'").catch(console.error);
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      team_name TEXT,
      budget INTEGER DEFAULT 50000000,
      created_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pes_team TEXT,
      nationality TEXT,
      position TEXT,
      pes_position TEXT,
      rating INTEGER,
      age INTEGER,
      foot TEXT,
      owner_id INTEGER REFERENCES users(id),
      listed_price INTEGER,
      release_clause INTEGER
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      participant_ids TEXT,
      prizes TEXT,
      created_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER REFERENCES tournaments(id),
      round_number INTEGER,
      round_name TEXT,
      home_id INTEGER REFERENCES users(id),
      away_id INTEGER REFERENCES users(id),
      home_score INTEGER,
      away_score INTEGER,
      scorers TEXT,
      played_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS clause_offers (
      id SERIAL PRIMARY KEY,
      player_id TEXT,
      player_name TEXT,
      player_rating INTEGER,
      player_position TEXT,
      buyer_id INTEGER,
      buyer_username TEXT,
      owner_id INTEGER,
      owner_username TEXT,
      clause_amount INTEGER,
      status TEXT DEFAULT 'pending',
      new_clause_amount INTEGER,
      created_at BIGINT,
      resolved_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      player_id TEXT,
      player_name TEXT,
      player_rating INTEGER,
      player_position TEXT,
      from_user_id INTEGER,
      from_username TEXT,
      to_user_id INTEGER,
      to_username TEXT,
      price INTEGER,
      created_at BIGINT
    );
  `);

  const defaults = [
    ['initial_budget',  '50000000'],
    ['price_multiplier','1000'],
    ['max_roster',      '22'],
    ['min_roster',      '18'],
    ['admin_code',      'aps2006'],
    ['release_pct',     '60'],
    ['pos_mult_gk',     '0.8'],
    ['pos_mult_def',    '0.9'],
    ['pos_mult_mid',    '1.0'],
    ['pos_mult_fwd',       '1.2'],
    ['hide_without_team', '0'],
  ];
  for (const [key, value] of defaults) {
    await pool.query(
      'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value]
    );
  }
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb, withTransaction };
