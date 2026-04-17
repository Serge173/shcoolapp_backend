#!/usr/bin/env node
/**
 * Applique database/schema.sql sur MySQL distant (sans CREATE DATABASE / USE).
 * Ignore les doublons (INSERT filières déjà présentes). Idempotent pour les tables IF NOT EXISTS.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getMysqlClientOptions } = require(path.join(__dirname, '..', 'utils', 'mysqlEnvOptions'));

function stripLeadingDbCommands(sql) {
  return sql
    .replace(/^CREATE DATABASE IF NOT EXISTS[^;]+;/im, '')
    .replace(/^USE\s+[^;]+;/im, '')
    .trim();
}

function splitStatements(sql) {
  const parts = sql.split(/;\s*\r?\n/).map((s) => s.trim()).filter(Boolean);
  return parts
    .map((p) => (p.endsWith(';') ? p.slice(0, -1).trim() : p))
    .filter(Boolean)
    .filter((p) => {
      const lines = p.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return false;
      return !lines.every((l) => l.startsWith('--'));
    });
}

async function main() {
  if (process.env.DB_DRIVER === 'sqlite' || !process.env.DB_HOST) {
    console.error('DB_HOST requis pour apply-schema-mysql.');
    process.exit(2);
  }
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  let sql = fs.readFileSync(schemaPath, 'utf8');
  sql = stripLeadingDbCommands(sql);
  const statements = splitStatements(sql);
  const conn = await mysql.createConnection({
    ...getMysqlClientOptions(),
    multipleStatements: false,
    connectTimeout: 30000,
  });

  for (let i = 0; i < statements.length; i++) {
    const st = statements[i];
    try {
      await conn.query(st);
      console.log(`[${i + 1}/${statements.length}] OK`);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) {
        console.warn(`[${i + 1}/${statements.length}] skip doublon:`, st.slice(0, 72), '…');
        continue;
      }
      if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.errno === 1050) {
        console.warn(`[${i + 1}/${statements.length}] skip table existe`);
        continue;
      }
      console.error(`[${i + 1}/${statements.length}] échec:`, e.message);
      throw e;
    }
  }
  await conn.end();
  console.log('Schéma appliqué.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
