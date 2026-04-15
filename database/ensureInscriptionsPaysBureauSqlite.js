/**
 * Ajoute inscriptions.pays_bureau si absent (bases SQLite créées avant cette colonne).
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureInscriptionsPaysBureauSqlite() {
  const dbPath = path.join(__dirname, '..', 'data', 'shoolapp.db');
  if (!fs.existsSync(dbPath)) return { skipped: true };
  const db = new Database(dbPath);
  try {
    const cols = db.prepare('PRAGMA table_info(inscriptions)').all();
    const hasCol = cols.some((r) => r.name === 'pays_bureau');
    if (!hasCol) {
      db.exec("ALTER TABLE inscriptions ADD COLUMN pays_bureau TEXT NOT NULL DEFAULT 'CI';");
      console.log('[schema] Colonne inscriptions.pays_bureau ajoutée (SQLite).');
    }
  } finally {
    db.close();
  }
  return { ok: true };
}

module.exports = { ensureInscriptionsPaysBureauSqlite };
