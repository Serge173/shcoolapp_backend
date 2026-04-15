/**
 * Migration pays_bureau sur MySQL (idempotente).
 * Utilisée au démarrage du serveur (Render) et par `npm run migrate:pays-bureau`.
 */
const mysql = require('mysql2/promise');

async function runPaysBureauMigrationMysql() {
  if (!process.env.DB_HOST) {
    return { skipped: true, reason: 'no DB_HOST (SQLite ou non configuré)' };
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
    await conn.query(
      `ALTER TABLE inscriptions ADD COLUMN pays_bureau ENUM('CI', 'BF') NOT NULL DEFAULT 'CI'`
    );
    console.log('[migration] Colonne pays_bureau ajoutée.');
  } catch (e) {
    const msg = String(e.message || '');
    if (msg.includes('Duplicate column') || msg.includes('1060')) {
      console.log('[migration] Colonne pays_bureau déjà présente.');
    } else {
      throw e;
    }
  }

  try {
    await conn.query('CREATE INDEX idx_inscriptions_pays_bureau ON inscriptions(pays_bureau)');
    console.log('[migration] Index idx_inscriptions_pays_bureau créé.');
  } catch (e) {
    const msg = String(e.message || '');
    if (msg.includes('Duplicate key name') || String(e.code) === 'ER_DUP_KEYNAME' || msg.includes('1061')) {
      console.log('[migration] Index idx_inscriptions_pays_bureau déjà présent.');
    } else {
      throw e;
    }
  }

  await conn.end();
  return { ok: true };
}

module.exports = { runPaysBureauMigrationMysql };
