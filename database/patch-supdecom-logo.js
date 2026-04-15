/**
 * Met à jour le logo SUP'DE COM (URL officielle).
 * SQLite : node database/patch-supdecom-logo.js
 * MySQL : même commande avec DB_DRIVER=mysql (ou sans sqlite) et variables .env remplies.
 */
require('dotenv').config();
const path = require('path');

const LOGO = 'https://www.ecoles-supdecom.com/_ipx/s_180x72/images/logo-navbar.svg';
const NOM = "SUP'DE COM";

const useSqlite = process.env.DB_DRIVER === 'sqlite' || !process.env.DB_HOST;

async function main() {
  if (useSqlite) {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'data', 'shoolapp.db');
    const db = new Database(dbPath);
    const r = db.prepare('UPDATE universites SET logo = ? WHERE nom = ?').run(LOGO, NOM);
    console.log(`patch-supdecom-logo (sqlite): ${r.changes} ligne(s) mise(s) à jour.`);
    const row = db.prepare('SELECT id, nom, logo FROM universites WHERE nom = ?').get(NOM);
    console.log(row || 'Aucune ligne pour ce nom.');
    db.close();
    return;
  }

  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shoolapp',
  });
  const [res] = await conn.execute('UPDATE universites SET logo = ? WHERE nom = ?', [LOGO, NOM]);
  console.log(`patch-supdecom-logo (mysql): ${res.affectedRows} ligne(s) mise(s) à jour.`);
  const [rows] = await conn.execute('SELECT id, nom, logo FROM universites WHERE nom = ?', [NOM]);
  console.log(rows[0] || 'Aucune ligne pour ce nom.');
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
