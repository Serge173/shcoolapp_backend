require('dotenv').config();
const path = require('path');

const useSqlite = process.env.DB_DRIVER === 'sqlite' || !process.env.DB_HOST;

if (useSqlite) {
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, '..', 'data', 'shoolapp.db');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const runQuery = (sql, params = []) => {
    const stmt = db.prepare(sql);
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
      const rows = params.length ? stmt.all(...params) : stmt.all();
      return [rows];
    }
    const info = params.length ? stmt.run(...params) : stmt.run();
    return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }];
  };
  module.exports = {
    query(sql, params) {
      return Promise.resolve(runQuery(sql, params || []));
    },
    execute(sql, params) {
      return Promise.resolve(runQuery(sql, params || []));
    },
  };
} else {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shoolapp',
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  module.exports = pool;
}
