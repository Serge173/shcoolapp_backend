const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getAvailableNiveauxForFiliere } = require('../utils/figsParcoursMatch');

// Liste des filières (pour un type public/privé optionnel) + sous-filières rattachées
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT f.id, f.nom, f.slug, f.actif, f.grand_groupe,
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
    const [sousRows] = await db.query(
      'SELECT id, filiere_id, nom, slug FROM sous_filieres ORDER BY nom'
    );
    const sousByFiliere = {};
    for (const s of sousRows || []) {
      const fid = s.filiere_id;
      if (!sousByFiliere[fid]) sousByFiliere[fid] = [];
      sousByFiliere[fid].push({ id: s.id, nom: s.nom, slug: s.slug });
    }
    let filieres = rows.map((f) => ({
      ...f,
      sous_filieres: sousByFiliere[f.id] || [],
    }));
    if (req.query.type) {
      const type = req.query.type === 'privee' ? 'privee' : 'publique';
      filieres = filieres.filter((f) => (type === 'privee' ? f.nb_privees > 0 : f.nb_publiques > 0));
    }
    res.json(filieres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Niveaux (BTS, M1, …) réellement présents dans FIGS pour cette filière + écoles privées du réseau
router.get('/:id/niveaux-disponibles', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Identifiant de filière invalide.' });
    }
    const [rows] = await db.query('SELECT id, nom, slug, actif, grand_groupe FROM filieres WHERE id = ? AND actif = 1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Filière introuvable.' });
    const filiere = rows[0];
    const [uniRows] = await db.query(
      `SELECT u.id, u.nom FROM universites u
       INNER JOIN universite_filieres uf ON uf.universite_id = u.id
       WHERE uf.filiere_id = ? AND u.type = 'privee'
       ORDER BY u.nom`,
      [id]
    );
    const niveaux = getAvailableNiveauxForFiliere(filiere, uniRows || []);
    res.json({ niveaux });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Détail d'une filière
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nom, slug, actif, grand_groupe FROM filieres WHERE id = ? AND actif = 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Filière introuvable.' });
    const [sousRows] = await db.query(
      'SELECT id, nom, slug FROM sous_filieres WHERE filiere_id = ? ORDER BY nom',
      [req.params.id]
    );
    res.json({ ...rows[0], sous_filieres: sousRows || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
