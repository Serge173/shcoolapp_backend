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
  const { getMysqlClientOptions } = require('../utils/mysqlEnvOptions');
  const pool = mysql.createPool({
    ...getMysqlClientOptions(),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,
    queueLimit: 0,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 20000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
  module.exports = pool;
}
