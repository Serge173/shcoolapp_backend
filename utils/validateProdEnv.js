/**
 * Centralise les contrôles d'environnement en production (fail-fast au démarrage).
 */
function isSqliteMode() {
  return process.env.DB_DRIVER === 'sqlite' || !process.env.DB_HOST;
}

function assertProductionConfig() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return;

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production.');
  }
  if (String(process.env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  if (!process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN must be configured in production.');
  }
  const origins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const isAllowedCorsOrigin = (o) => {
    if (o.includes('*')) return false;
    if (/^https:\/\//i.test(o)) return true;
    // Dev local / tests : navigateur sur localhost même si NODE_ENV=production
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o);
  };
  const bad = origins.filter((o) => !isAllowedCorsOrigin(o));
  if (bad.length) {
    throw new Error(
      'CORS_ORIGIN: URLs publiques en https uniquement, ou http://localhost|127.0.0.1 (port optionnel). Pas de wildcard. Séparateur virgule.'
    );
  }

  if (!isSqliteMode()) {
    if (!process.env.DB_USER) {
      throw new Error('DB_USER is required in production when DB_HOST is set.');
    }
    if (process.env.DB_PASSWORD === undefined) {
      throw new Error('DB_PASSWORD must be set (can be empty) in production when DB_HOST is set.');
    }
    if (!process.env.DB_NAME) {
      throw new Error('DB_NAME is required in production when DB_HOST is set.');
    }
  }
}

/** Pour CI / script CLI : `node utils/validateProdEnv.js --prod` → exit 1 si invalide. */
function validateCli() {
  try {
    assertProductionConfig();
    console.log('OK: configuration production valide.');
    process.exit(0);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}

module.exports = { assertProductionConfig, isSqliteMode, validateCli };

if (require.main === module) {
  if (process.argv.includes('--prod')) {
    require('dotenv').config();
    process.env.NODE_ENV = 'production';
    validateCli();
  } else {
    console.log('Usage: node utils/validateProdEnv.js --prod');
    console.log('  (charge .env puis vérifie JWT, CORS, MySQL comme au démarrage Render)');
    process.exit(0);
  }
}
