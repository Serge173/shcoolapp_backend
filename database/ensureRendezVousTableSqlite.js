/**
 * Crée rendez_vous si absent (SQLite local).
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureRendezVousTableSqlite() {
  const dbPath = path.join(__dirname, '..', 'data', 'shoolapp.db');
  if (!fs.existsSync(dbPath)) return { skipped: true };
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rendez_vous (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT NOT NULL,
        telephone TEXT NOT NULL,
        pays_bureau TEXT NOT NULL DEFAULT 'CI' CHECK(pays_bureau IN ('CI', 'BF')),
        type_rdv TEXT NOT NULL,
        date_souhaitee TEXT NOT NULL,
        creneau TEXT NOT NULL,
        message TEXT,
        statut TEXT NOT NULL DEFAULT 'nouveau' CHECK(statut IN ('nouveau', 'a_confirmer', 'confirme', 'annule', 'termine')),
        notes_internes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[schema] Table rendez_vous OK (SQLite).');
  } finally {
    db.close();
  }
  return { ok: true };
}

module.exports = { ensureRendezVousTableSqlite };
