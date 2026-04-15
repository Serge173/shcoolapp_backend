const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../config/db');
const { uploadDir } = require('../middleware/upload');
const { resolveLogoUrl } = require('../utils/logoUrl');
const { filterUniversitesByFiliereNiveauFigs } = require('../utils/figsParcoursMatch');

// Liste des universités (option: par filière, par type)
router.get('/', async (req, res) => {
  try {
    let sql = `
      SELECT u.id, u.nom, u.type, u.ville, u.description, u.logo, u.brochure,
        (SELECT COUNT(*) FROM campuses c WHERE c.universite_id = u.id) AS nb_campus
      FROM universites u
      WHERE 1=1`;
    const params = [];
    if (req.query.filiere_id) {
      sql += ` AND EXISTS (SELECT 1 FROM universite_filieres uf WHERE uf.universite_id = u.id AND uf.filiere_id = ?)`;
      params.push(req.query.filiere_id);
    }
    if (req.query.type) {
      sql += ` AND u.type = ?`;
      params.push(req.query.type);
    }
    sql += ' ORDER BY u.nom';
    let [rows] = await db.query(sql, params);

    const niveau = (req.query.niveau || '').trim();
    const filiereId = req.query.filiere_id ? Number(req.query.filiere_id) : null;
    if (niveau && filiereId && Number.isInteger(filiereId) && filiereId > 0) {
      const [filRows] = await db.query('SELECT id, nom, slug FROM filieres WHERE id = ? AND actif = 1', [filiereId]);
      const filiere = filRows[0];
      if (filiere) {
        rows = filterUniversitesByFiliereNiveauFigs(rows, filiere, niveau);
      }
    }

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

// Détail d'une université (avec photos et filières)
router.get('/:id', async (req, res) => {
  try {
    const [universites] = await db.query(
      'SELECT id, nom, type, ville, description, logo, brochure FROM universites WHERE id = ?',
      [req.params.id]
    );
    if (!universites.length) return res.status(404).json({ error: 'Université introuvable.' });
    const u = universites[0];
    if (u.logo) u.logoUrl = resolveLogoUrl(u.logo);
    if (u.brochure) u.brochureUrl = '/uploads/brochures/' + path.basename(u.brochure);

    const [photos] = await db.query(
      'SELECT id, fichier FROM universite_photos WHERE universite_id = ? ORDER BY ordre, id',
      [req.params.id]
    );
    u.photos = photos.map(p => ({ ...p, url: '/uploads/photos/' + path.basename(p.fichier) }));

    const [filieres] = await db.query(
      `SELECT f.id, f.nom, f.slug FROM filieres f
       INNER JOIN universite_filieres uf ON uf.filiere_id = f.id
       WHERE uf.universite_id = ?`,
      [req.params.id]
    );
    u.filieres = filieres;

    const [campuses] = await db.query(
      `SELECT id, nom, ville, adresse, latitude, longitude, ordre
       FROM campuses WHERE universite_id = ? ORDER BY ordre, id`,
      [req.params.id]
    );
    u.campuses = campuses;
    res.json(u);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
