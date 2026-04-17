/**
 * Crée la table demandes_orientation si absente (MySQL / Render).
 */
const mysql = require('mysql2/promise');
const { getMysqlClientOptions } = require('../utils/mysqlEnvOptions');

const DDL = `
CREATE TABLE IF NOT EXISTS demandes_orientation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(40) NOT NULL,
  pays_bureau ENUM('CI', 'BF') NOT NULL DEFAULT 'CI',
  grande_filiere VARCHAR(200) NOT NULL,
  specialite VARCHAR(400) NOT NULL,
  besoin_orientation TINYINT(1) NOT NULL DEFAULT 1,
  message TEXT,
  statut ENUM('nouveau', 'validee', 'traitee', 'annulee') NOT NULL DEFAULT 'nouveau',
  notes_internes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_do_statut (statut),
  INDEX idx_do_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function ensureDemandesOrientationMysql() {
  if (!process.env.DB_HOST) return { skipped: true };
  const conn = await mysql.createConnection({
    ...getMysqlClientOptions(),
    multipleStatements: true,
  });
  try {
    await conn.query(DDL);
    console.log('[schema] Table demandes_orientation OK (MySQL).');
  } finally {
    await conn.end();
  }
  return { ok: true };
}

module.exports = { ensureDemandesOrientationMysql };
