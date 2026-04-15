const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const filieresRouter = require('./routes/filieres');
const universitesRouter = require('./routes/universites');
const inscriptionsRouter = require('./routes/inscriptions');
const adminRouter = require('./routes/admin');
const contactRouter = require('./routes/contact');
const rendezVousRouter = require('./routes/rendez-vous');
const demandesOrientationRouter = require('./routes/demandes-orientation');
const programmesFigsRouter = require('./routes/programmes-figs');
const { uploadDir } = require('./middleware/upload');
const { requestLogger } = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production.');
}

if (isProd && !process.env.CORS_ORIGIN) {
  throw new Error('CORS_ORIGIN must be configured in production.');
}

app.set('trust proxy', 1);
app.use(cookieParser());
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "img-src": ["'self'", 'data:', 'https:'],
      "script-src": ["'self'"],
      "connect-src": ["'self'", 'https:'],
      "style-src": ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      "font-src": ["'self'", 'https://fonts.gstatic.com', 'data:'],
    },
  },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((v) => v.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!isProd) return cb(null, true);
    return cb(null, corsOrigins.includes(origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '200kb' }));
app.use(requestLogger);

// Limitation des demandes d'inscription (anti-spam)
const inscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de demandes. Réessayez plus tard.' },
});
app.use('/api/inscriptions', inscriptionLimiter);

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de messages. Réessayez plus tard.' },
});
const rdvLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Trop de demandes de rendez-vous. Réessayez plus tard.' },
});
const demandeOrientationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: { error: 'Trop de demandes. Réessayez plus tard.' },
});
app.use('/api/contact', contactLimiter, contactRouter);
app.use('/api/rendez-vous', rdvLimiter, rendezVousRouter);
app.use('/api/demandes-orientation', demandeOrientationLimiter, demandesOrientationRouter);
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes admin. Réessayez plus tard.' },
});

// Fichiers statiques (uploads)
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  next();
}, express.static(path.isAbsolute(uploadDir) ? uploadDir : path.join(__dirname, uploadDir), {
  fallthrough: false,
  maxAge: isProd ? '7d' : 0,
}));

// Routes publiques
app.use('/api/filieres', filieresRouter);
app.use('/api/universites', universitesRouter);
app.use('/api/programmes-figs', programmesFigsRouter);
app.use('/api/inscriptions', inscriptionsRouter);
app.use('/api/admin', adminLimiter, adminRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur.' });
});

async function start() {
  const useSqlite =
    process.env.DB_DRIVER === 'sqlite' || !process.env.DB_HOST;
  if (!useSqlite && process.env.SKIP_DB_MIGRATION !== '1') {
    try {
      const { runPaysBureauMigrationMysql } = require('./database/migratePaysBureauMysql');
      await runPaysBureauMigrationMysql();
      const { ensureRendezVousTableMysql } = require('./database/ensureRendezVousTableMysql');
      await ensureRendezVousTableMysql();
      const { ensureDemandesOrientationMysql } = require('./database/ensureDemandesOrientationMysql');
      await ensureDemandesOrientationMysql();
      const { migrateFiliereGrandGroupeMysql } = require('./database/migrateFiliereGrandGroupeMysql');
      await migrateFiliereGrandGroupeMysql();
      const { ensureUniversiteOffresMysql } = require('./database/ensureUniversiteOffresMysql');
      await ensureUniversiteOffresMysql();
    } catch (err) {
      console.error('[migration] Échec migration pays_bureau (MySQL):', err.message || err);
      process.exit(1);
    }
  } else if (useSqlite) {
    try {
      const { ensureRendezVousTableSqlite } = require('./database/ensureRendezVousTableSqlite');
      ensureRendezVousTableSqlite();
      const { ensureDemandesOrientationSqlite } = require('./database/ensureDemandesOrientationSqlite');
      ensureDemandesOrientationSqlite();
      const { ensureInscriptionsPaysBureauSqlite } = require('./database/ensureInscriptionsPaysBureauSqlite');
      ensureInscriptionsPaysBureauSqlite();
      const { ensureFiliereGrandGroupeSqlite } = require('./database/ensureFiliereGrandGroupeSqlite');
      ensureFiliereGrandGroupeSqlite();
      const { ensureUniversiteOffresSqlite } = require('./database/ensureUniversiteOffresSqlite');
      ensureUniversiteOffresSqlite();
    } catch (e) {
      console.warn('[schema] SQLite:', e.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`Serveur FigsApp-Côte d'Ivoire sur http://localhost:${PORT}`);
  });
}

start();
