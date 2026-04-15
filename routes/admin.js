const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../config/db');
const path = require('path');
const { authenticate, generateToken, ADMIN_COOKIE_NAME } = require('../middleware/auth');
const { uploadPhotos, uploadBrochure, uploadLogo, photosDir, brochuresDir, logosDir } = require('../middleware/upload');
const { resolveLogoUrl } = require('../utils/logoUrl');
const { writeAudit } = require('../utils/auditLog');
const { ensureReferentielSousFilieres, ensureReferentielSousFilieresAll } = require('../utils/filiereReferentielSync');

const isProd = process.env.NODE_ENV === 'production';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez plus tard.' },
});

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

function keyFor(req, email = '') {
  return `${getClientIp(req)}:${String(email || '').toLowerCase()}`;
}

function isAllowedLogoRef(s) {
  if (!s) return true;
  return /^https?:\/\//i.test(s) || /^\/?images\//i.test(s);
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

/** Doit rester aligné sur frontend/src/data/filieresGroupsConfig.js (GROUPS). */
const FILIERE_GRANDS_GROUPES = [
  'Agri agro management',
  'Communication',
  'Comptabilite - gestion',
  'Design',
  'Environnement',
  'Finance',
  'Informatique',
  'Management',
  'Marketing',
  'Relations internationales',
  'Tourisme',
];

function parseGrandGroupeFromBody(value) {
  if (value === undefined) return { grand_groupe: undefined };
  if (value === null || String(value).trim() === '') return { grand_groupe: null };
  const s = String(value).trim();
  if (!FILIERE_GRANDS_GROUPES.includes(s)) return { error: 'Grand groupe invalide.' };
  return { grand_groupe: s };
}

// Login
router.post('/login', loginLimiter, [
  body('email').trim().isEmail().withMessage('Email invalide'),
  body('password').isString().isLength({ min: 8, max: 256 }).withMessage('Mot de passe invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const aliases = normalizedEmail === 'admin@schoolapp.com'
      ? ['admin@schoolapp.com', 'admin@shoolapp.com']
      : (normalizedEmail === 'admin@shoolapp.com'
        ? ['admin@shoolapp.com', 'admin@schoolapp.com']
        : [normalizedEmail]);
    const placeholders = aliases.map(() => '?').join(', ');
    const [rows] = await db.query(
      `SELECT id, email, password, nom FROM admins WHERE email IN (${placeholders}) ORDER BY id LIMIT 1`,
      aliases
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    const token = generateToken(admin);
    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
    });
    writeAudit('admin.login.success', { adminId: admin.id, email: admin.email, ip: getClientIp(req) });
    res.json({ admin: { id: admin.id, email: admin.email, nom: admin.nom } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/logout', authenticate, (req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
  writeAudit('admin.logout', { adminId: req.adminId, ip: getClientIp(req) });
  res.json({ message: 'Déconnecté.' });
});

router.get('/me', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT id, email, nom FROM admins WHERE id = ?', [req.adminId]);
  if (!rows.length) return res.status(401).json({ error: 'Session invalide.' });
  res.json({ admin: rows[0] });
});

// Toutes les routes ci-dessous nécessitent une authentification
router.use(authenticate);

// Statistiques
router.get('/stats', async (req, res) => {
  try {
    const [total] = await db.query('SELECT COUNT(*) AS total FROM inscriptions');
    const [byType] = await db.query(
      'SELECT type_universite AS type, COUNT(*) AS count FROM inscriptions GROUP BY type_universite'
    );
    const [byFiliere] = await db.query(
      `SELECT f.nom AS filiere, COUNT(i.id) AS count FROM filieres f
       LEFT JOIN inscriptions i ON i.filiere_id = f.id GROUP BY f.id ORDER BY count DESC`
    );
    const [byUniversite] = await db.query(
      `SELECT u.nom AS universite, u.type, COUNT(i.id) AS count FROM universites u
       LEFT JOIN inscriptions i ON i.universite_id = u.id GROUP BY u.id ORDER BY count DESC`
    );
    let byPaysBureau = { CI: 0, BF: 0 };
    try {
      const [byPays] = await db.query(
        'SELECT pays_bureau AS pays, COUNT(*) AS count FROM inscriptions GROUP BY pays_bureau'
      );
      byPaysBureau = byPays.reduce((acc, r) => ({ ...acc, [r.pays]: r.count }), { CI: 0, BF: 0 });
    } catch (e) {
      const msg = String(e.message || '');
      if (!msg.includes('no such column') && !msg.includes('Unknown column')) throw e;
    }
    let rendezVous = { total: 0, nouveau: 0, a_confirmer: 0, confirme: 0, annule: 0, termine: 0 };
    try {
      const [rvTotal] = await db.query('SELECT COUNT(*) AS n FROM rendez_vous');
      rendezVous.total = rvTotal[0]?.n ?? 0;
      const [rvBy] = await db.query(
        'SELECT statut, COUNT(*) AS n FROM rendez_vous GROUP BY statut'
      );
      for (const row of rvBy || []) {
        if (row.statut in rendezVous) rendezVous[row.statut] = row.n;
      }
    } catch (e) {
      const msg = String(e.message || '');
      if (!msg.includes('no such table') && !msg.includes("doesn't exist") && !msg.includes("Unknown table")) throw e;
    }

    let demandesOrientation = {
      total: 0,
      nouveau: 0,
      validee: 0,
      traitee: 0,
      annulee: 0,
    };
    try {
      const [dTotal] = await db.query('SELECT COUNT(*) AS n FROM demandes_orientation');
      demandesOrientation.total = dTotal[0]?.n ?? 0;
      const [dBy] = await db.query(
        'SELECT statut, COUNT(*) AS n FROM demandes_orientation GROUP BY statut'
      );
      for (const row of dBy || []) {
        if (row.statut in demandesOrientation) demandesOrientation[row.statut] = row.n;
      }
    } catch (e) {
      const msg = String(e.message || '');
      if (!msg.includes('no such table') && !msg.includes("doesn't exist") && !msg.includes("Unknown table")) throw e;
    }

    res.json({
      total: total[0].total,
      byType: byType.reduce((acc, r) => ({ ...acc, [r.type]: r.count }), { publique: 0, privee: 0 }),
      byPaysBureau,
      byFiliere,
      byUniversite,
      rendezVous,
      demandesOrientation,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Liste des inscriptions avec filtres
router.get('/inscriptions', [
  query('type').optional().isIn(['publique', 'privee']),
  query('filiere_id').optional().isInt(),
  query('universite_id').optional().isInt(),
  query('pays_bureau').optional().isIn(['CI', 'BF']),
  query('date_debut').optional().isISO8601(),
  query('date_fin').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    let sql = `
      SELECT i.id, i.nom, i.prenom, i.date_naissance, i.sexe, i.telephone, i.email, i.ville,
             i.niveau_etude, i.serie_bac, i.annee_bac, i.filiere_id, i.filiere_autre,
             i.universite_id, i.type_universite, i.created_at,
             COALESCE(i.pays_bureau, 'CI') AS pays_bureau,
             COALESCE(f.nom, i.filiere_autre) AS filiere_nom,
             u.nom AS universite_nom, u.ville AS universite_ville
      FROM inscriptions i
      LEFT JOIN filieres f ON f.id = i.filiere_id
      JOIN universites u ON u.id = i.universite_id
      WHERE 1=1`;
    const params = [];
    if (req.query.type) {
      sql += ' AND i.type_universite = ?';
      params.push(req.query.type);
    }
    if (req.query.filiere_id) {
      sql += ' AND i.filiere_id = ?';
      params.push(req.query.filiere_id);
    }
    if (req.query.universite_id) {
      sql += ' AND i.universite_id = ?';
      params.push(req.query.universite_id);
    }
    if (req.query.pays_bureau) {
      sql += ' AND COALESCE(i.pays_bureau, \'CI\') = ?';
      params.push(req.query.pays_bureau);
    }
    if (req.query.date_debut) {
      sql += ' AND DATE(i.created_at) >= ?';
      params.push(req.query.date_debut);
    }
    if (req.query.date_fin) {
      sql += ' AND DATE(i.created_at) <= ?';
      params.push(req.query.date_fin);
    }
    sql += ' ORDER BY i.created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

const RDV_STATUTS = ['nouveau', 'a_confirmer', 'confirme', 'annule', 'termine'];

router.get('/rendez-vous', [
  query('statut').optional().isIn(RDV_STATUTS),
  query('pays_bureau').optional().isIn(['CI', 'BF']),
  query('date_debut').optional().isISO8601(),
  query('date_fin').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    let sql = `SELECT id, nom, prenom, email, telephone, pays_bureau, type_rdv, date_souhaitee, creneau, message,
      statut, notes_internes, created_at, updated_at
      FROM rendez_vous WHERE 1=1`;
    const params = [];
    if (req.query.statut) {
      sql += ' AND statut = ?';
      params.push(req.query.statut);
    }
    if (req.query.pays_bureau) {
      sql += ' AND pays_bureau = ?';
      params.push(req.query.pays_bureau);
    }
    if (req.query.date_debut) {
      sql += ' AND DATE(created_at) >= ?';
      params.push(req.query.date_debut);
    }
    if (req.query.date_fin) {
      sql += ' AND DATE(created_at) <= ?';
      params.push(req.query.date_fin);
    }
    sql += ' ORDER BY (statut = \'nouveau\') DESC, created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    if (String(err.message || '').includes('no such table') || String(err.code) === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

const DO_STATUTS = ['nouveau', 'validee', 'traitee', 'annulee'];

router.get('/demandes-orientation', [
  query('statut').optional().isIn(DO_STATUTS),
  query('pays_bureau').optional().isIn(['CI', 'BF']),
  query('date_debut').optional().isISO8601(),
  query('date_fin').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    let sql = `SELECT id, nom, prenom, email, telephone, pays_bureau, grande_filiere, specialite,
      besoin_orientation, message, statut, notes_internes, created_at, updated_at
      FROM demandes_orientation WHERE 1=1`;
    const params = [];
    if (req.query.statut) {
      sql += ' AND statut = ?';
      params.push(req.query.statut);
    }
    if (req.query.pays_bureau) {
      sql += ' AND pays_bureau = ?';
      params.push(req.query.pays_bureau);
    }
    if (req.query.date_debut) {
      sql += ' AND DATE(created_at) >= ?';
      params.push(req.query.date_debut);
    }
    if (req.query.date_fin) {
      sql += ' AND DATE(created_at) <= ?';
      params.push(req.query.date_fin);
    }
    sql += " ORDER BY (statut = 'nouveau') DESC, created_at DESC";
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    if (String(err.message || '').includes('no such table') || String(err.code) === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.patch('/demandes-orientation/:id', [
  param('id').isInt(),
  body('statut').optional().isIn(DO_STATUTS),
  body('notes_internes').optional({ nullable: true }).isLength({ max: 8000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const id = Number(req.params.id);
    const { statut, notes_internes } = req.body || {};
    if (statut === undefined && notes_internes === undefined) {
      return res.status(400).json({ error: 'Rien à mettre à jour.' });
    }
    const sets = [];
    const params = [];
    if (statut !== undefined) {
      sets.push('statut = ?');
      params.push(statut);
    }
    if (notes_internes !== undefined) {
      sets.push('notes_internes = ?');
      params.push(notes_internes);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Rien à mettre à jour.' });
    params.push(id);
    const sqlite = process.env.DB_DRIVER === 'sqlite' || !process.env.DB_HOST;
    const finalSql = sqlite
      ? `UPDATE demandes_orientation SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`
      : `UPDATE demandes_orientation SET ${sets.join(', ')} WHERE id = ?`;
    const [r] = await db.query(finalSql, params);
    const affected = r.affectedRows ?? r.changes ?? 0;
    if (!affected) return res.status(404).json({ error: 'Demande introuvable.' });
    writeAudit('demande_orientation.updated', { id, statut, adminId: req.adminId });
    const [rows] = await db.query('SELECT * FROM demandes_orientation WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.patch('/rendez-vous/:id', [
  param('id').isInt(),
  body('statut').optional().isIn(RDV_STATUTS),
  body('notes_internes').optional({ nullable: true }).isLength({ max: 8000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const id = Number(req.params.id);
    const { statut, notes_internes } = req.body || {};
    if (statut === undefined && notes_internes === undefined) {
      return res.status(400).json({ error: 'Rien à mettre à jour.' });
    }
    const sets = [];
    const params = [];
    if (statut !== undefined) {
      sets.push('statut = ?');
      params.push(statut);
    }
    if (notes_internes !== undefined) {
      sets.push('notes_internes = ?');
      params.push(notes_internes);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Rien à mettre à jour.' });
    params.push(id);
    const sqlite = process.env.DB_DRIVER === 'sqlite' || !process.env.DB_HOST;
    const finalSql = sqlite
      ? `UPDATE rendez_vous SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`
      : `UPDATE rendez_vous SET ${sets.join(', ')} WHERE id = ?`;
    const [r] = await db.query(finalSql, params);
    const affected = r.affectedRows ?? r.changes ?? 0;
    if (!affected) return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    writeAudit('rendez_vous.updated', { id, statut, adminId: req.adminId });
    const [rows] = await db.query('SELECT * FROM rendez_vous WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// CRUD Universités
router.get('/universites', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nom, type, ville, description, logo, brochure FROM universites ORDER BY nom'
    );
    let ufRows = [];
    try {
      const [r] = await db.query(
        'SELECT universite_id, filiere_id, offre_filiere_entiere FROM universite_filieres'
      );
      ufRows = r || [];
    } catch (e) {
      const [r] = await db.query('SELECT universite_id, filiere_id FROM universite_filieres');
      ufRows = (r || []).map((row) => ({ ...row, offre_filiere_entiere: 1 }));
    }
    /** @type {Record<number, number[]>} */
    const filieresByUni = {};
    /** @type {Record<number, number[]>} */
    const filieresEntieresByUni = {};
    for (const row of ufRows || []) {
      const uid = Number(row.universite_id);
      const fid = Number(row.filiere_id);
      if (!Number.isInteger(uid) || !Number.isInteger(fid)) continue;
      if (!filieresByUni[uid]) filieresByUni[uid] = [];
      filieresByUni[uid].push(fid);
      const offreEntiere =
        row.offre_filiere_entiere === undefined || row.offre_filiere_entiere === null
          ? 1
          : Number(row.offre_filiere_entiere);
      if (offreEntiere === 1) {
        if (!filieresEntieresByUni[uid]) filieresEntieresByUni[uid] = [];
        filieresEntieresByUni[uid].push(fid);
      }
    }
    let sfRows = [];
    let slRows = [];
    try {
      const [a] = await db.query('SELECT universite_id, sous_filiere_id FROM universite_sous_filieres');
      sfRows = a || [];
    } catch (e) {
      /* table absente avant migration */
    }
    try {
      const [b] = await db.query('SELECT universite_id, filiere_id, libelle FROM universite_specialites_libelle');
      slRows = b || [];
    } catch (e) {
      /* table absente avant migration */
    }
    /** @type {Record<number, number[]>} */
    const sousByUni = {};
    for (const row of sfRows) {
      const uid = Number(row.universite_id);
      const sid = Number(row.sous_filiere_id);
      if (!Number.isInteger(uid) || !Number.isInteger(sid)) continue;
      if (!sousByUni[uid]) sousByUni[uid] = [];
      sousByUni[uid].push(sid);
    }
    /** @type {Record<number, { filiere_id: number, libelle: string }[]>} */
    const catByUni = {};
    for (const row of slRows) {
      const uid = Number(row.universite_id);
      const fid = Number(row.filiere_id);
      const libelle = String(row.libelle || '').trim();
      if (!Number.isInteger(uid) || !Number.isInteger(fid) || !libelle) continue;
      if (!catByUni[uid]) catByUni[uid] = [];
      catByUni[uid].push({ filiere_id: fid, libelle });
    }
    for (const u of rows) {
      const id = Number(u.id);
      u.filiere_ids = filieresByUni[id] ? [...filieresByUni[id]].sort((a, b) => a - b) : [];
      u.filieres_entieres = filieresEntieresByUni[id] ? [...filieresEntieresByUni[id]].sort((a, b) => a - b) : [];
      u.sous_filiere_ids = sousByUni[id] ? [...sousByUni[id]].sort((a, b) => a - b) : [];
      u.specialites_catalogue = catByUni[id] ? [...catByUni[id]] : [];
      if (u.logo) u.logoUrl = resolveLogoUrl(u.logo);
      if (u.brochure) u.brochureUrl = '/uploads/brochures/' + path.basename(u.brochure);
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/universites', [
  body('nom').trim().isLength({ min: 2, max: 255 }),
  body('type').isIn(['publique', 'privee']),
  body('ville').trim().isLength({ min: 2, max: 100 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body('logo').optional({ nullable: true }).trim().isLength({ max: 500 }).custom(isAllowedLogoRef),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const { nom, type, ville, description, logo } = req.body || {};
    if (!nom || !type || !ville) {
      return res.status(400).json({ error: 'Nom, type et ville requis.' });
    }
    const [r] = await db.query(
      'INSERT INTO universites (nom, type, ville, description, logo) VALUES (?, ?, ?, ?, ?)',
      [nom, type, ville, description || null, logo || null]
    );
    writeAudit('admin.universite.create', { adminId: req.adminId, universiteId: r.insertId, ip: getClientIp(req) });
    res.status(201).json({ id: r.insertId, nom, type, ville, description: description || null, logo: logo || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/universites/:id', [
  param('id').isInt(),
  body('nom').optional({ nullable: true }).trim().isLength({ min: 2, max: 255 }),
  body('type').optional({ nullable: true }).isIn(['publique', 'privee']),
  body('ville').optional({ nullable: true }).trim().isLength({ min: 2, max: 100 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body('logo').optional({ nullable: true }).trim().isLength({ max: 500 }).custom(isAllowedLogoRef),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const { nom, type, ville, description, logo } = req.body || {};
    const id = req.params.id;
    await db.query(
      'UPDATE universites SET nom = COALESCE(?, nom), type = COALESCE(?, type), ville = COALESCE(?, ville), description = COALESCE(?, description), logo = COALESCE(?, logo) WHERE id = ?',
      [nom, type, ville, description, logo, id]
    );
    const [rows] = await db.query('SELECT * FROM universites WHERE id = ?', [id]);
    writeAudit('admin.universite.update', { adminId: req.adminId, universiteId: Number(id), ip: getClientIp(req) });
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.delete('/universites/:id', [param('id').isInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    await db.query('DELETE FROM universites WHERE id = ?', [req.params.id]);
    writeAudit('admin.universite.delete', { adminId: req.adminId, universiteId: Number(req.params.id), ip: getClientIp(req) });
    res.json({ message: 'Université supprimée.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Upload logo pour une université
router.post('/universites/:id/logo', [param('id').isInt()], uploadLogo, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    if (!req.file) return res.status(400).json({ error: 'Fichier logo requis.' });
    const relPath = path.join(logosDir, req.file.filename);
    await db.query('UPDATE universites SET logo = ? WHERE id = ?', [relPath, req.params.id]);
    writeAudit('admin.universite.logo.upload', { adminId: req.adminId, universiteId: Number(req.params.id), ip: getClientIp(req) });
    res.json({ logoUrl: '/uploads/logos/' + req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur upload.' });
  }
});

// Upload brochure
router.post('/universites/:id/brochure', [param('id').isInt()], uploadBrochure, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    if (!req.file) return res.status(400).json({ error: 'Fichier PDF requis.' });
    const relPath = path.join(brochuresDir, req.file.filename);
    await db.query('UPDATE universites SET brochure = ? WHERE id = ?', [relPath, req.params.id]);
    writeAudit('admin.universite.brochure.upload', { adminId: req.adminId, universiteId: Number(req.params.id), ip: getClientIp(req) });
    res.json({ brochureUrl: '/uploads/brochures/' + req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur upload.' });
  }
});

// Upload photos et lier à l'université
router.post('/universites/:id/photos', [param('id').isInt()], uploadPhotos, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'Au moins une photo requise.' });
    const universite_id = req.params.id;
    for (let i = 0; i < req.files.length; i++) {
      const fichier = path.join(photosDir, req.files[i].filename);
      await db.query('INSERT INTO universite_photos (universite_id, fichier, ordre) VALUES (?, ?, ?)', [universite_id, fichier, i]);
    }
    writeAudit('admin.universite.photos.upload', { adminId: req.adminId, universiteId: Number(req.params.id), count: req.files.length, ip: getClientIp(req) });
    res.json({ message: 'Photos ajoutées.', count: req.files.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur upload.' });
  }
});

// Filières pour les select (admin)
router.get('/filieres', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nom, slug, actif, grand_groupe FROM filieres ORDER BY nom');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/** Route littérale avant /filieres/:id/... pour éviter toute ambiguïté de routage. */
router.post('/filieres/sync-referentiel-sous-all', async (req, res) => {
  try {
    const r = await ensureReferentielSousFilieresAll(db);
    writeAudit('admin.filieres.sync_referentiel_sous_all', {
      adminId: req.adminId,
      filieres: r.filieres,
      sousFilieresAdded: r.sousFilieresAdded,
      ip: getClientIp(req),
    });
    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/** Ajoute en base les spécialités du référentiel (onze domaines) comme sous-filières manquantes. */
router.post('/filieres/:id/sync-referentiel-sous', [param('id').isInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const id = Number(req.params.id);
    const r = await ensureReferentielSousFilieres(db, id);
    if (r.error) return res.status(404).json({ error: r.error });
    writeAudit('admin.filiere.sync_referentiel_sous', {
      adminId: req.adminId,
      filiereId: id,
      added: r.added,
      group: r.group,
      ip: getClientIp(req),
    });
    res.json({ filiere_id: id, added: r.added, grand_domaine: r.group });
  } catch (err) {
    if (String(err.code || '').includes('ER_DUP_ENTRY') || String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Conflit de slug sous-filière.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Filières + sous-filières pour gestion admin
router.get('/filieres/tree', async (req, res) => {
  try {
    const [filRows] = await db.query('SELECT id, nom, slug, actif, grand_groupe FROM filieres ORDER BY nom');
    const [sousRows] = await db.query('SELECT id, filiere_id, nom, slug FROM sous_filieres ORDER BY nom');
    const grouped = sousRows.reduce((acc, row) => {
      if (!acc[row.filiere_id]) acc[row.filiere_id] = [];
      acc[row.filiere_id].push(row);
      return acc;
    }, {});
    res.json(filRows.map((f) => ({ ...f, sous_filieres: grouped[f.id] || [] })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post(
  '/filieres',
  [body('nom').trim().isLength({ min: 2, max: 150 }), body('grand_groupe').optional({ nullable: true })],
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const nom = req.body.nom.trim();
    const slug = slugify(nom);
    if (!slug) return res.status(400).json({ error: 'Nom de filière invalide.' });
    const parsed = parseGrandGroupeFromBody(req.body.grand_groupe);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const grandGroupe = parsed.grand_groupe === undefined ? null : parsed.grand_groupe;
    const [r] = await db.query('INSERT INTO filieres (nom, slug, actif, grand_groupe) VALUES (?, ?, 1, ?)', [
      nom,
      slug,
      grandGroupe,
    ]);
    writeAudit('admin.filiere.create', { adminId: req.adminId, filiereId: r.insertId, ip: getClientIp(req) });
    let referentielSousAdded = 0;
    try {
      const sync = await ensureReferentielSousFilieres(db, r.insertId);
      referentielSousAdded = sync.added;
    } catch (syncErr) {
      console.error('ensureReferentielSousFilieres (create)', syncErr);
    }
    res.status(201).json({
      id: r.insertId,
      nom,
      slug,
      actif: 1,
      grand_groupe: grandGroupe,
      referentiel_sous_added: referentielSousAdded,
    });
  } catch (err) {
    if (String(err.code || '').includes('ER_DUP_ENTRY') || String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Filière déjà existante.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/filieres/:id', [param('id').isInt(), body('nom').trim().isLength({ min: 2, max: 150 })], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const id = Number(req.params.id);
    const nom = req.body.nom.trim();
    const slug = slugify(nom);
    await db.query('UPDATE filieres SET nom = ?, slug = ? WHERE id = ?', [nom, slug, id]);
    writeAudit('admin.filiere.update', { adminId: req.adminId, filiereId: id, ip: getClientIp(req) });
    res.json({ id, nom, slug });
  } catch (err) {
    if (String(err.code || '').includes('ER_DUP_ENTRY') || String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Filière déjà existante.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.patch('/filieres/:id/statut', [param('id').isInt(), body('actif').isBoolean()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const id = Number(req.params.id);
    const actif = req.body.actif ? 1 : 0;
    await db.query('UPDATE filieres SET actif = ? WHERE id = ?', [actif, id]);
    writeAudit('admin.filiere.status', { adminId: req.adminId, filiereId: id, actif, ip: getClientIp(req) });
    res.json({ id, actif });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.patch(
  '/filieres/:id/grand-groupe',
  [param('id').isInt(), body('grand_groupe').optional({ nullable: true })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
      const id = Number(req.params.id);
      const parsed = parseGrandGroupeFromBody(req.body.grand_groupe);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const grandGroupe = parsed.grand_groupe === undefined ? null : parsed.grand_groupe;
      await db.query('UPDATE filieres SET grand_groupe = ? WHERE id = ?', [grandGroupe, id]);
      writeAudit('admin.filiere.grand_groupe', { adminId: req.adminId, filiereId: id, grand_groupe: grandGroupe, ip: getClientIp(req) });
      let referentielSousAdded = 0;
      try {
        const sync = await ensureReferentielSousFilieres(db, id);
        referentielSousAdded = sync.added;
      } catch (syncErr) {
        console.error('ensureReferentielSousFilieres (grand-groupe)', syncErr);
      }
      res.json({ id, grand_groupe: grandGroupe, referentiel_sous_added: referentielSousAdded });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  }
);

router.delete('/filieres/:id', [param('id').isInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const id = Number(req.params.id);
    await db.query('DELETE FROM filieres WHERE id = ?', [id]);
    writeAudit('admin.filiere.delete', { adminId: req.adminId, filiereId: id, ip: getClientIp(req) });
    res.json({ message: 'Filière supprimée.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/filieres/:id/sous-filieres', [param('id').isInt(), body('nom').trim().isLength({ min: 2, max: 150 })], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const filiereId = Number(req.params.id);
    const nom = req.body.nom.trim();
    const slug = slugify(nom);
    const [r] = await db.query('INSERT INTO sous_filieres (filiere_id, nom, slug) VALUES (?, ?, ?)', [filiereId, nom, slug]);
    writeAudit('admin.sous_filiere.create', { adminId: req.adminId, filiereId, sousFiliereId: r.insertId, ip: getClientIp(req) });
    res.status(201).json({ id: r.insertId, filiere_id: filiereId, nom, slug });
  } catch (err) {
    if (String(err.code || '').includes('ER_DUP_ENTRY') || String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Sous-filière déjà existante pour cette filière.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/sous-filieres/:id', [param('id').isInt(), body('nom').trim().isLength({ min: 2, max: 150 })], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const id = Number(req.params.id);
    const nom = req.body.nom.trim();
    const slug = slugify(nom);
    await db.query('UPDATE sous_filieres SET nom = ?, slug = ? WHERE id = ?', [nom, slug, id]);
    writeAudit('admin.sous_filiere.update', { adminId: req.adminId, sousFiliereId: id, ip: getClientIp(req) });
    res.json({ id, nom, slug });
  } catch (err) {
    if (String(err.code || '').includes('ER_DUP_ENTRY') || String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Sous-filière déjà existante pour cette filière.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.delete('/sous-filieres/:id', [param('id').isInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const id = Number(req.params.id);
    await db.query('DELETE FROM sous_filieres WHERE id = ?', [id]);
    writeAudit('admin.sous_filiere.delete', { adminId: req.adminId, sousFiliereId: id, ip: getClientIp(req) });
    res.json({ message: 'Sous-filière supprimée.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Offres filières / spécialités (filière entière, sous-filières, libellés catalogue FIGS + référentiel)
router.put(
  '/universites/:id/filieres',
  [
    param('id').isInt(),
    body('filiere_ids').optional().isArray(),
    body('filieres_entieres').optional().isArray(),
    body('sous_filiere_ids').optional().isArray(),
    body('specialites_catalogue').optional().isArray(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
      const universite_id = Number(req.params.id);
      const body = req.body || {};

      const parseIds = (arr) =>
        Array.isArray(arr) ? arr.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0) : [];

      const hasNewShape =
        body.filieres_entieres !== undefined ||
        body.sous_filiere_ids !== undefined ||
        body.specialites_catalogue !== undefined;

      let filieres_entieres = parseIds(body.filieres_entieres);
      let sous_filiere_ids = parseIds(body.sous_filiere_ids);
      let specialites_catalogue = Array.isArray(body.specialites_catalogue)
        ? body.specialites_catalogue
            .map((x) => ({
              filiere_id: Number(x?.filiere_id),
              libelle: String(x?.libelle || '')
                .trim()
                .slice(0, 190),
            }))
            .filter(
              (x) =>
                Number.isInteger(x.filiere_id) &&
                x.filiere_id > 0 &&
                x.libelle.length >= 2 &&
                x.libelle.length <= 190
            )
        : [];

      if (!hasNewShape && Array.isArray(body.filiere_ids)) {
        filieres_entieres = parseIds(body.filiere_ids);
        sous_filiere_ids = [];
        specialites_catalogue = [];
      }

      const [allSous] = await db.query('SELECT id, filiere_id FROM sous_filieres');
      const sousToFiliere = new Map((allSous || []).map((r) => [Number(r.id), Number(r.filiere_id)]));
      sous_filiere_ids = sous_filiere_ids.filter((id) => sousToFiliere.has(id));

      const [allFil] = await db.query('SELECT id FROM filieres');
      const filiereOk = new Set((allFil || []).map((r) => Number(r.id)));
      specialites_catalogue = specialites_catalogue.filter((c) => filiereOk.has(c.filiere_id));
      filieres_entieres = filieres_entieres.filter((fid) => filiereOk.has(fid));

      const granularFiliereIds = new Set();
      for (const sid of sous_filiere_ids) {
        const p = sousToFiliere.get(sid);
        if (p) granularFiliereIds.add(p);
      }
      for (const c of specialites_catalogue) granularFiliereIds.add(c.filiere_id);

      filieres_entieres = filieres_entieres.filter((fid) => !granularFiliereIds.has(fid));

      const filiereSet = new Set([...filieres_entieres, ...granularFiliereIds]);

      await db.query('DELETE FROM universite_filieres WHERE universite_id = ?', [universite_id]);
      try {
        await db.query('DELETE FROM universite_sous_filieres WHERE universite_id = ?', [universite_id]);
      } catch (e) {
        /* */
      }
      try {
        await db.query('DELETE FROM universite_specialites_libelle WHERE universite_id = ?', [universite_id]);
      } catch (e) {
        /* */
      }

      for (const fid of filiereSet) {
        const offreEntiere = filieres_entieres.includes(fid) ? 1 : 0;
        await db.query(
          'INSERT INTO universite_filieres (universite_id, filiere_id, offre_filiere_entiere) VALUES (?, ?, ?)',
          [universite_id, fid, offreEntiere]
        );
      }
      for (const sid of sous_filiere_ids) {
        await db.query(
          'INSERT INTO universite_sous_filieres (universite_id, sous_filiere_id) VALUES (?, ?)',
          [universite_id, sid]
        );
      }
      for (const c of specialites_catalogue) {
        await db.query(
          'INSERT INTO universite_specialites_libelle (universite_id, filiere_id, libelle) VALUES (?, ?, ?)',
          [universite_id, c.filiere_id, c.libelle]
        );
      }

      writeAudit('admin.universite.filieres', {
        adminId: req.adminId,
        universiteId: universite_id,
        filieres: filiereSet.size,
        sous: sous_filiere_ids.length,
        catalogue: specialites_catalogue.length,
        ip: getClientIp(req),
      });
      res.json({ message: 'Offres filières / spécialités mises à jour.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  }
);

module.exports = router;
