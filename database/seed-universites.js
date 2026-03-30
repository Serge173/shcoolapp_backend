/**
 * Seed : universités publiques + réseau MLA (17 écoles) + liaison aux filières
 * À lancer après schema.sql et seed-admin.js
 * Usage: node database/seed-universites.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { universites, filieresParUniversite } = require('../data/universites-seed');
const { campusesRowsForUniversite } = require('../data/campuses-seed');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shoolapp',
};

async function run() {
  const conn = await mysql.createConnection(config);

  console.log('Vérification des filières de base...');
  await conn.execute(
    "INSERT IGNORE INTO filieres (nom, slug) VALUES ('Psychologie', 'psychologie')"
  );

  console.log('Nettoyage des liaisons et des universités de démo...');
  await conn.query('DELETE FROM universite_filieres');
  await conn.query('DELETE FROM universite_photos');
  await conn.query('DELETE FROM inscriptions');
  try {
    await conn.query('DELETE FROM campuses');
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
  }
  await conn.query('DELETE FROM universites');

  console.log('Ajout des 22 universités (5 publiques + 17 MLA)...');
  for (const u of universites) {
    await conn.execute(
      'INSERT INTO universites (nom, type, ville, description, logo) VALUES (?, ?, ?, ?, ?)',
      [u.nom, u.type, u.ville, u.description, u.logo ?? null]
    );
  }

  const [rows] = await conn.query('SELECT id FROM universites ORDER BY id');
  const ids = rows.map((r) => r.id);

  console.log('Liaison universités <-> filières...');
  for (let i = 0; i < ids.length; i++) {
    const universiteId = ids[i];
    const filiereIds = filieresParUniversite[i + 1] || [1, 2];
    for (const fid of filiereIds) {
      await conn.execute(
        'INSERT INTO universite_filieres (universite_id, filiere_id) VALUES (?, ?)',
        [universiteId, fid]
      );
    }
  }

  console.log('Insertion des campus...');
  const [uniRows] = await conn.query('SELECT id, nom, ville FROM universites ORDER BY id');
  for (const row of uniRows) {
    const campusRows = campusesRowsForUniversite(row.nom, row.ville);
    for (const c of campusRows) {
      await conn.execute(
        'INSERT INTO campuses (universite_id, nom, ville, adresse, latitude, longitude, ordre) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [row.id, c.nom, c.ville, c.adresse, c.latitude, c.longitude, c.ordre]
      );
    }
  }

  console.log('Terminé. Filières + 22 universités + campus (logos MLA : public/images/ecoles/*.png).');
  await conn.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
