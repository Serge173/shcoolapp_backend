/**
 * Offres école : sous-filières, libellés catalogue, colonne offre_filiere_entiere sur universite_filieres.
 */
const mysql = require('mysql2/promise');

async function ensureUniversiteOffresMysql() {
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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS universite_sous_filieres (
        universite_id INT NOT NULL,
        sous_filiere_id INT NOT NULL,
        PRIMARY KEY (universite_id, sous_filiere_id),
        FOREIGN KEY (universite_id) REFERENCES universites(id) ON DELETE CASCADE,
        FOREIGN KEY (sous_filiere_id) REFERENCES sous_filieres(id) ON DELETE CASCADE
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS universite_specialites_libelle (
        universite_id INT NOT NULL,
        filiere_id INT NOT NULL,
        libelle VARCHAR(190) NOT NULL,
        PRIMARY KEY (universite_id, filiere_id, libelle),
        FOREIGN KEY (universite_id) REFERENCES universites(id) ON DELETE CASCADE,
        FOREIGN KEY (filiere_id) REFERENCES filieres(id) ON DELETE CASCADE
      )
    `);
  } catch (e) {
    await conn.end();
    throw e;
  }

  try {
    await conn.query(
      'ALTER TABLE universite_filieres ADD COLUMN offre_filiere_entiere TINYINT(1) NOT NULL DEFAULT 1'
    );
    console.log('[migration] Colonne universite_filieres.offre_filiere_entiere ajoutée (MySQL).');
  } catch (e) {
    const msg = String(e.message || '');
    if (msg.includes('Duplicate column') || msg.includes('1060')) {
      console.log('[migration] Colonne offre_filiere_entiere déjà présente (MySQL).');
    } else {
      await conn.end();
      throw e;
    }
  }

  await conn.end();
  return { ok: true };
}

module.exports = { ensureUniversiteOffresMysql };
