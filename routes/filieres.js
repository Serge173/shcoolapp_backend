const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Liste des filières (pour un type public/privé optionnel)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT f.id, f.nom, f.slug, f.actif,
        (SELECT COUNT(DISTINCT u.id) FROM universites u
         INNER JOIN universite_filieres uf ON u.id = uf.universite_id
         WHERE uf.filiere_id = f.id AND u.type = ?) AS nb_publiques,
        (SELECT COUNT(DISTINCT u.id) FROM universites u
         INNER JOIN universite_filieres uf ON u.id = uf.universite_id
         WHERE uf.filiere_id = f.id AND u.type = ?) AS nb_privees
       FROM filieres f
      WHERE f.actif = 1
       ORDER BY f.nom`,
      [req.query.type === 'publique' ? 'publique' : 'publique', req.query.type === 'privee' ? 'privee' : 'privee']
    );
    let filieres = rows;
    if (req.query.type) {
      const type = req.query.type === 'privee' ? 'privee' : 'publique';
      filieres = rows.filter(f => (type === 'privee' ? f.nb_privees > 0 : f.nb_publiques > 0));
    }
    res.json(filieres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Détail d'une filière
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nom, slug, actif FROM filieres WHERE id = ? AND actif = 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Filière introuvable.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
