const express = require('express');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const dataFile = path.join(__dirname, '..', 'data', 'contact-messages.json');

const validations = [
  body('nom').trim().notEmpty().withMessage('Le nom est requis').isLength({ max: 120 }),
  body('email').trim().isEmail().withMessage('Email invalide').normalizeEmail(),
  body('message').trim().notEmpty().withMessage('Le message est requis').isLength({ max: 5000 }),
  body().custom((value) => {
    const allowed = ['nom', 'email', 'message'];
    const extra = Object.keys(value || {}).filter((k) => !allowed.includes(k));
    if (extra.length) throw new Error('Champs non autorisés.');
    return true;
  }),
];

router.post('/', validations, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    const { nom, email, message } = req.body;
    const entry = {
      nom,
      email,
      message,
      created_at: new Date().toISOString(),
    };
    let list = [];
    try {
      if (fs.existsSync(dataFile)) {
        list = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        if (!Array.isArray(list)) list = [];
      }
    } catch {
      list = [];
    }
    list.push(entry);
    fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), 'utf8');
    res.status(201).json({ message: 'Message envoyé.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
