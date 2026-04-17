/**
 * Crée la table rendez_vous si absente (MySQL / Render).
 */
const mysql = require('mysql2/promise');
const { getMysqlClientOptions } = require('../utils/mysqlEnvOptions');

const DDL = `
CREATE TABLE IF NOT EXISTS rendez_vous (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(40) NOT NULL,
  pays_bureau ENUM('CI', 'BF') NOT NULL DEFAULT 'CI',
  type_rdv VARCHAR(50) NOT NULL,
  date_souhaitee DATE NOT NULL,
  creneau VARCHAR(40) NOT NULL,
  message TEXT,
  statut ENUM('nouveau', 'a_confirmer', 'confirme', 'annule', 'termine') NOT NULL DEFAULT 'nouveau',
  notes_internes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rdv_statut (statut),
  INDEX idx_rdv_date_souhaitee (date_souhaitee),
  INDEX idx_rdv_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function ensureRendezVousTableMysql() {
  if (!process.env.DB_HOST) return { skipped: true };
  const conn = await mysql.createConnection({
    ...getMysqlClientOptions(),
    multipleStatements: true,
  });
  try {
    await conn.query(DDL);
    console.log('[schema] Table rendez_vous OK (MySQL).');
  } finally {
    await conn.end();
  }
  return { ok: true };
}

module.exports = { ensureRendezVousTableMysql };
