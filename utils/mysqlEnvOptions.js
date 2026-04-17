/**
 * Options MySQL communes (Render, Railway, PlanetScale, etc.).
 * Railway expose souvent MYSQLPORT → à copier dans DB_PORT sur Render.
 */
function mysqlSslOption() {
  if (process.env.DB_SSL !== 'true') return undefined;
  return {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

function getMysqlClientOptions() {
  const opts = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'shoolapp',
    ssl: mysqlSslOption(),
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 20000,
  };
  if (process.env.DB_PORT != null && String(process.env.DB_PORT).trim() !== '') {
    const p = Number(process.env.DB_PORT);
    if (!Number.isNaN(p) && p > 0) opts.port = p;
  }
  return opts;
}

module.exports = { getMysqlClientOptions, mysqlSslOption };
