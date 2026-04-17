/**
 * Colonne grand_groupe sur filieres (MySQL, idempotente).
 */
const mysql = require('mysql2/promise');
const { getMysqlClientOptions } = require('../utils/mysqlEnvOptions');

async function migrateFiliereGrandGroupeMysql() {
  if (!process.env.DB_HOST) {
    return { skipped: true, reason: 'no DB_HOST' };
  }

  const conn = await mysql.createConnection({
    ...getMysqlClientOptions(),
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
