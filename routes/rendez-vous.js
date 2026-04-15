const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { notifyNewRendezVous } = require('../utils/notifications');
const { writeAudit } = require('../utils/auditLog');

const TYPE_RDV = ['orientation', 'inscription', 'suivi', 'renseignements', 'autre'];
const CRENEAUX = ['matin', 'apres_midi', 'flexible'];

const validations = [
  body('nom').trim().notEmpty().isLength({ max: 100 }),
  body('prenom').trim().notEmpty().isLength({ max: 100 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('telephone').trim().notEmpty().isLength({ max: 40 }),
  body('pays_bureau').isIn(['CI', 'BF']),
  body('type_rdv').isIn(TYPE_RDV),
  body('date_souhaitee').isISO8601(),
  body('creneau').isIn(CRENEAUX),
  body('message').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body().custom((value) => {
    const allowed = ['nom', 'prenom', 'email', 'telephone', 'pays_bureau', 'type_rdv', 'date_souhaitee', 'creneau', 'message'];
    const extra = Object.keys(value || {}).filter((k) => !allowed.includes(k));
    if (extra.length) throw new Error('Champs non autorisés.');
    return true;
  }),
  body().custom((value) => {
    const d = new Date(String(value.date_souhaitee).slice(0, 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) throw new Error('La date souhaitée doit être aujourd’hui ou dans le futur.');
    const max = new Date();
    max.setMonth(max.getMonth() + 6);
    if (d > max) throw new Error('La date ne peut pas dépasser 6 mois.');
    return true;
  }),
];

router.post('/', validations, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const e = errors.array()[0];
      return res.status(400).json({ error: e.msg || 'Données invalides', errors: errors.array() });
    }
    const {
      nom, prenom, email, telephone, pays_bureau, type_rdv, date_souhaitee, creneau, message,
    } = req.body;

    const dateStr = typeof date_souhaitee === 'string'
      ? date_souhaitee.slice(0, 10)
      : new Date(date_souhaitee).toISOString().slice(0, 10);

    await db.query(
      `INSERT INTO rendez_vous (nom, prenom, email, telephone, pays_bureau, type_rdv, date_souhaitee, creneau, message, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'nouveau')`,
      [nom, prenom, email, telephone, pays_bureau, type_rdv, dateStr, creneau, message || null]
    );

    const payload = {
      nom, prenom, email, telephone, pays_bureau, type_rdv, date_souhaitee: dateStr, creneau, message,
    };
    notifyNewRendezVous(payload).catch((e) => console.error('Notification RDV:', e.message));
    writeAudit('rendez_vous.created', { email, pays_bureau, type_rdv, date_souhaitee: dateStr });

    res.status(201).json({ message: 'Votre demande de rendez-vous a bien été enregistrée. Nous vous recontacterons rapidement.' });
  } catch (err) {
    console.error(err);
    if (String(err.message || '').includes('no such table') || String(err.code) === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Service temporairement indisponible. Réessayez plus tard.' });
    }
    res.status(500).json({ error: 'Erreur lors de l’enregistrement.' });
  }
});

module.exports = router;
