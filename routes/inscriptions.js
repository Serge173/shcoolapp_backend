const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { notifyNewInscription } = require('../utils/notifications');
const { writeAudit } = require('../utils/auditLog');

const validations = [
  body('nom').trim().notEmpty().withMessage('Le nom est requis').isLength({ max: 100 }),
  body('prenom').trim().notEmpty().withMessage('Le prénom est requis').isLength({ max: 100 }),
  body('date_naissance').isDate().withMessage('Date de naissance invalide'),
  body('sexe').isIn(['M', 'F']).withMessage('Sexe invalide'),
  body('telephone').trim().notEmpty().withMessage('Le téléphone est requis').isLength({ max: 20 }),
  body('email').trim().isEmail().withMessage('Email invalide').normalizeEmail(),
  body('ville').trim().notEmpty().withMessage('La ville est requise').isLength({ max: 100 }),
  body('niveau_etude').optional().trim().isLength({ max: 100 }),
  body('serie_bac').optional().trim().isLength({ max: 50 }),
  body('annee_bac').optional().trim().isLength({ max: 10 }),
  body('filiere_id').optional({ nullable: true }).isInt().withMessage('Filière invalide'),
  body('filiere_autre').optional().trim().isLength({ max: 150 }).withMessage('Filière autre invalide'),
  body().custom((value) => {
    const hasFiliereId = value.filiere_id !== undefined && value.filiere_id !== null && String(value.filiere_id).trim() !== '';
    const hasFiliereAutre = value.filiere_autre && String(value.filiere_autre).trim().length > 0;
    if (!hasFiliereId && !hasFiliereAutre) throw new Error('Filière requise');
    return true;
  }),
  body('universite_id').isInt().withMessage('Université requise'),
  body('type_universite').isIn(['publique', 'privee']).withMessage('Type université invalide'),
  body('pays_bureau').isIn(['CI', 'BF']).withMessage('Bureau d’origine invalide (CI ou BF).'),
  body().custom((value) => {
    const allowed = [
      'nom', 'prenom', 'date_naissance', 'sexe', 'telephone', 'email', 'ville',
      'niveau_etude', 'serie_bac', 'annee_bac', 'filiere_id', 'filiere_autre',
      'universite_id', 'type_universite', 'pays_bureau',
    ];
    const extra = Object.keys(value || {}).filter((k) => !allowed.includes(k));
    if (extra.length) throw new Error('Champs non autorisés dans la requête.');
    return true;
  }),
];

router.post('/', validations, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const {
      nom, prenom, date_naissance, sexe, telephone, email, ville,
      niveau_etude, serie_bac, annee_bac, filiere_id, filiere_autre, universite_id, type_universite, pays_bureau,
    } = req.body;
    const [uRows] = await db.query('SELECT id, nom, type, ville FROM universites WHERE id = ?', [universite_id]);
    if (!uRows.length) return res.status(400).json({ error: 'Université invalide.' });
    const [campusRows] = await db.query('SELECT ville FROM campuses WHERE universite_id = ?', [universite_id]);
    const validCities = new Set(campusRows.map((c) => String(c.ville || '').trim().toLowerCase()).filter(Boolean));
    if (!validCities.size) validCities.add(String(uRows[0].ville || '').trim().toLowerCase());
    if (!validCities.has(String(ville).trim().toLowerCase())) {
      return res.status(400).json({ error: 'Ville choisie non valide pour cette université.' });
    }

    const [insertMeta] = await db.query(
      `INSERT INTO inscriptions (nom, prenom, date_naissance, sexe, telephone, email, ville, niveau_etude, serie_bac, annee_bac, filiere_id, filiere_autre, universite_id, type_universite, pays_bureau)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        prenom,
        date_naissance,
        sexe,
        telephone,
        email,
        ville,
        niveau_etude || null,
        serie_bac || null,
        annee_bac || null,
        filiere_id || null,
        filiere_autre || null,
        universite_id,
        type_universite,
        pays_bureau,
      ]
    );
    const inscriptionId = insertMeta && insertMeta.insertId != null ? Number(insertMeta.insertId) : null;
    const [fRows] = filiere_id
      ? await db.query('SELECT nom FROM filieres WHERE id = ?', [filiere_id])
      : [[]];
    notifyNewInscription({
      inscription_id: inscriptionId,
      nom,
      prenom,
      date_naissance,
      sexe,
      email,
      telephone,
      ville,
      niveau_etude,
      serie_bac,
      annee_bac,
      filiere_id: filiere_id || null,
      filiere_autre: filiere_autre || null,
      filiere_nom: fRows?.[0]?.nom || null,
      universite_id,
      universite_nom: uRows?.[0]?.nom || null,
      type_universite,
      pays_bureau,
    }).catch((e) => {
      console.error('[inscriptions] Notification error (dossier quand même enregistré):', e.message);
    });
    writeAudit('inscription.created', {
      inscriptionId,
      universiteId: Number(universite_id),
      type_universite,
      pays_bureau,
      email,
    });

    res.status(201).json({ message: 'Demande d\'inscription enregistrée avec succès.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement.' });
  }
});

module.exports = router;
