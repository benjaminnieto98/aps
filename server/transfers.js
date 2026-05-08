const { pool } = require('./db');

async function logTransfer({ type, player, from = null, to = null, price = null, _client = null }) {
  const q = _client || pool;
  await q.query(`
    INSERT INTO transfers
      (type, player_id, player_name, player_rating, player_position,
       from_user_id, from_username, to_user_id, to_username, price, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    type,
    player.id, player.name, player.rating, player.position,
    from ? from.id       : null,
    from ? from.username : null,
    to   ? to.id         : null,
    to   ? to.username   : null,
    price,
    Date.now()
  ]);
}

module.exports = { logTransfer };
