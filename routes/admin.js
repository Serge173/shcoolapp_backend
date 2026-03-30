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
    res.json({
      total: total[0].total,
      byType: byType.reduce((acc, r) => ({ ...acc, [r.type]: r.count }), { publique: 0, privee: 0 }),
      byFiliere,
      byUniversite,
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
  query('date_debut').optional().isISO8601(),
  query('date_fin').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    let sql = `
      SELECT i.id, i.nom, i.prenom, i.telephone, i.email, i.created_at, i.type_universite,
             COALESCE(f.nom, i.filiere_autre) AS filiere_nom, u.nom AS universite_nom
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

// CRUD Universités
router.get('/universites', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nom, type, ville, description, logo, brochure FROM universites ORDER BY nom'
    );
    for (const u of rows) {
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
    const [rows] = await db.query('SELECT id, nom, slug, actif FROM filieres ORDER BY nom');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Filières + sous-filières pour gestion admin
router.get('/filieres/tree', async (req, res) => {
  try {
    const [filRows] = await db.query('SELECT id, nom, slug, actif FROM filieres ORDER BY nom');
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

router.post('/filieres', [body('nom').trim().isLength({ min: 2, max: 150 })], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const nom = req.body.nom.trim();
    const slug = slugify(nom);
    if (!slug) return res.status(400).json({ error: 'Nom de filière invalide.' });
    const [r] = await db.query('INSERT INTO filieres (nom, slug, actif) VALUES (?, ?, 1)', [nom, slug]);
    writeAudit('admin.filiere.create', { adminId: req.adminId, filiereId: r.insertId, ip: getClientIp(req) });
    res.status(201).json({ id: r.insertId, nom, slug, actif: 1 });
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

// Associer/dissocier filières à une université
router.put('/universites/:id/filieres', [param('id').isInt(), body('filiere_ids').isArray()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const universite_id = req.params.id;
    const filiere_ids = Array.isArray(req.body.filiere_ids) ? req.body.filiere_ids.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0) : [];
    await db.query('DELETE FROM universite_filieres WHERE universite_id = ?', [universite_id]);
    for (const filiere_id of filiere_ids) {
      await db.query('INSERT INTO universite_filieres (universite_id, filiere_id) VALUES (?, ?)', [universite_id, filiere_id]);
    }
    res.json({ message: 'Filières mises à jour.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
