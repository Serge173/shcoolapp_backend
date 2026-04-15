const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { notifyNewDemandeOrientation } = require('../utils/notifications');
const { writeAudit } = require('../utils/auditLog');

const validations = [
  body('nom').trim().notEmpty().isLength({ max: 100 }),
  body('prenom').trim().notEmpty().isLength({ max: 100 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('telephone').trim().notEmpty().isLength({ max: 40 }),
  body('pays_bureau').isIn(['CI', 'BF']),
  body('grande_filiere').trim().notEmpty().isLength({ max: 200 }),
  body('specialite').trim().notEmpty().isLength({ max: 400 }),
  body('besoin_orientation').isBoolean(),
  body('message').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body().custom((value) => {
    const allowed = [
      'nom',
      'prenom',
      'email',
      'telephone',
      'pays_bureau',
      'grande_filiere',
      'specialite',
      'besoin_orientation',
      'message',
    ];
    const extra = Object.keys(value || {}).filter((k) => !allowed.includes(k));
    if (extra.length) throw new Error('Champs non autorisés.');
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
      nom,
      prenom,
      email,
      telephone,
      pays_bureau,
      grande_filiere,
      specialite,
      besoin_orientation,
      message,
    } = req.body;

    const besoin = besoin_orientation ? 1 : 0;

    await db.query(
      `INSERT INTO demandes_orientation (
        nom, prenom, email, telephone, pays_bureau,
        grande_filiere, specialite, besoin_orientation, message, statut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'nouveau')`,
      [
        nom,
        prenom,
        email,
        telephone,
        pays_bureau,
        grande_filiere,
        specialite,
        besoin,
        message || null,
      ]
    );

    const payload = {
      nom,
      prenom,
      email,
      telephone,
      pays_bureau,
      grande_filiere,
      specialite,
      besoin_orientation: Boolean(besoin),
      message: message || null,
    };
    notifyNewDemandeOrientation(payload).catch((e) => console.error('Notification demande orientation:', e.message));
    writeAudit('demande_orientation.created', { email, pays_bureau, grande_filiere, specialite });

    res.status(201).json({
      message:
        'Votre demande a bien été enregistrée. Notre équipe vous recontactera (e-mail / téléphone / WhatsApp selon vos coordonnées). Vous pouvez aussi prendre rendez-vous pour poursuivre votre parcours.',
    });
  } catch (err) {
    console.error(err);
    if (String(err.message || '').includes('no such table') || String(err.code) === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Service temporairement indisponible. Réessayez plus tard.' });
    }
    res.status(500).json({ error: 'Erreur lors de l’enregistrement.' });
  }
});

module.exports = router;
