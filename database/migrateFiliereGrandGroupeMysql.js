/**
 * Colonne grand_groupe sur filieres (MySQL, idempotente).
 */
const mysql = require('mysql2/promise');

async function migrateFiliereGrandGroupeMysql() {
  if (!process.env.DB_HOST) {
    return { skipped: true, reason: 'no DB_HOST' };
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shoolapp',
    ssl:
      process.env.DB_SSL === 'true'
        ? { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined,
  });

  try {
    await conn.query('ALTER TABLE filieres ADD COLUMN grand_groupe VARCHAR(100) NULL');
    console.log('[migration] Colonne filieres.grand_groupe ajoutée (MySQL).');
  } catch (e) {
    const msg = String(e.message || '');
    if (msg.includes('Duplicate column') || msg.includes('1060')) {
      console.log('[migration] Colonne filieres.grand_groupe déjà présente.');
    } else {
      throw e;
    }
  }

  await conn.end();
  return { ok: true };
}

module.exports = { migrateFiliereGrandGroupeMysql };
