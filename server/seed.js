const path = require('path');
const fs = require('fs');

const positionMap = {
  'GK': 'GK', 'CBT': 'CB', 'SB': 'LB', 'WB': 'LB',
  'DMF': 'CDM', 'CMF': 'CM', 'SMF': 'CM',
  'AMF': 'CAM', 'SS': 'CAM', 'CWP': 'CAM',
  'WF': 'LW', 'CF': 'ST'
};

async function seed(pool) {
  const { rows } = await pool.query('SELECT COUNT(*)::int as cnt FROM players');
  if (rows[0].cnt > 0) {
    console.log(`Seed: ya hay ${rows[0].cnt} jugadores, se omite.`);
    return;
  }

  const jsonPath = path.join(__dirname, '..', 'pes6_players.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn('Seed: no se encontró pes6_players.json, se omite.');
    return;
  }

  const players = JSON.parse(fs.readFileSync(jsonPath, { encoding: 'utf8' }));
  console.log(`Seed: importando ${players.length} jugadores...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const BATCH = 100;
    for (let i = 0; i < players.length; i += BATCH) {
      const batch = players.slice(i, i + BATCH);
      const valuePlaceholders = batch.map((_, j) => {
        const b = j * 9;
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},NULL,NULL,NULL)`;
      }).join(',');

      const params = batch.flatMap(p => [
        p.id, p.name, p.team, p.nationality,
        positionMap[p.position] || p.position,
        p.position,
        parseInt(p.rating, 10),
        parseInt(p.age, 10),
        p.foot
      ]);

      await client.query(`
        INSERT INTO players
          (id, name, pes_team, nationality, position, pes_position, rating, age, foot,
           owner_id, listed_price, release_clause)
        VALUES ${valuePlaceholders}
        ON CONFLICT (id) DO NOTHING
      `, params);
    }

    await client.query('COMMIT');
    console.log(`Seed: ${players.length} jugadores importados.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed error:', e);
    throw e;
  } finally {
    client.release();
  }
}

// Allow running directly: node seed.js
if (require.main === module) {
  const { pool, initDb } = require('./db');
  (async () => {
    await initDb();
    await seed(pool);
    await pool.end();
    process.exit(0);
  })();
}

module.exports = { seed };
