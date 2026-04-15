/**
 * Crée demandes_orientation si absent (SQLite local).
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureDemandesOrientationSqlite() {
  const dbPath = path.join(__dirname, '..', 'data', 'shoolapp.db');
  if (!fs.existsSync(dbPath)) return { skipped: true };
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS demandes_orientation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT NOT NULL,
        telephone TEXT NOT NULL,
        pays_bureau TEXT NOT NULL DEFAULT 'CI' CHECK(pays_bureau IN ('CI', 'BF')),
        grande_filiere TEXT NOT NULL,
        specialite TEXT NOT NULL,
        besoin_orientation INTEGER NOT NULL DEFAULT 1 CHECK(besoin_orientation IN (0, 1)),
        message TEXT,
        statut TEXT NOT NULL DEFAULT 'nouveau' CHECK(statut IN ('nouveau', 'validee', 'traitee', 'annulee')),
        notes_internes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[schema] Table demandes_orientation OK (SQLite).');
  } finally {
    db.close();
  }
  return { ok: true };
}

module.exports = { ensureDemandesOrientationSqlite };
