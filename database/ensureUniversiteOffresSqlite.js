/**
 * Tables offres détaillées école : sous-filières + libellés catalogue, et lien filière « entière ».
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureUniversiteOffresSqlite() {
  const dbPath = path.join(__dirname, '..', 'data', 'shoolapp.db');
  if (!fs.existsSync(dbPath)) return { skipped: true };
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS universite_sous_filieres (
        universite_id INTEGER NOT NULL REFERENCES universites(id) ON DELETE CASCADE,
        sous_filiere_id INTEGER NOT NULL REFERENCES sous_filieres(id) ON DELETE CASCADE,
        PRIMARY KEY (universite_id, sous_filiere_id)
      );
      CREATE TABLE IF NOT EXISTS universite_specialites_libelle (
        universite_id INTEGER NOT NULL REFERENCES universites(id) ON DELETE CASCADE,
        filiere_id INTEGER NOT NULL REFERENCES filieres(id) ON DELETE CASCADE,
        libelle TEXT NOT NULL,
        PRIMARY KEY (universite_id, filiere_id, libelle)
      );
    `);
    const cols = db.prepare('PRAGMA table_info(universite_filieres)').all();
    if (!cols.some((r) => r.name === 'offre_filiere_entiere')) {
      db.exec(
        'ALTER TABLE universite_filieres ADD COLUMN offre_filiere_entiere INTEGER NOT NULL DEFAULT 1;'
      );
      console.log('[schema] Colonne universite_filieres.offre_filiere_entiere ajoutée (SQLite).');
    }
  } finally {
    db.close();
  }
  return { ok: true };
}

module.exports = { ensureUniversiteOffresSqlite };
