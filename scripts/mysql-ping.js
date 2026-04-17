#!/usr/bin/env node
/**
 * Vérifie la connexion MySQL (SSL selon .env). Usage: node scripts/mysql-ping.js
 */
require('dotenv').config();
const path = require('path');
const mysql = require('mysql2/promise');
const { getMysqlClientOptions } = require(path.join(__dirname, '..', 'utils', 'mysqlEnvOptions'));

async function main() {
  if (process.env.DB_DRIVER === 'sqlite' || !process.env.DB_HOST) {
    console.error('DB_HOST absent : mode SQLite, rien à pinger.');
    process.exit(2);
  }
  const conn = await mysql.createConnection({
    ...getMysqlClientOptions(),
  });
  const [rows] = await conn.query('SELECT 1 AS ok');
  await conn.end();
  console.log('MySQL OK:', rows);
  process.exit(0);
}

main().catch((e) => {
  console.error('MySQL KO:', e.code || e.message);
  process.exit(1);
});
