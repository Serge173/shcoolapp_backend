/**
 * Ajoute filieres.grand_groupe si absent (référentiel des 11 grands domaines côté front).
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureFiliereGrandGroupeSqlite() {
  const dbPath = path.join(__dirname, '..', 'data', 'shoolapp.db');
  if (!fs.existsSync(dbPath)) return { skipped: true };
  const db = new Database(dbPath);
  try {
    const cols = db.prepare('PRAGMA table_info(filieres)').all();
    if (!cols.some((r) => r.name === 'grand_groupe')) {
      db.exec('ALTER TABLE filieres ADD COLUMN grand_groupe TEXT;');
      console.log('[schema] Colonne filieres.grand_groupe ajoutée (SQLite).');
    }
  } finally {
    db.close();
  }
  return { ok: true };
}

module.exports = { ensureFiliereGrandGroupeSqlite };
