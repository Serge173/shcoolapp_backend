/**
 * Initialise la base SQLite : schéma + 10 filières + admin + 22 universités (5 publiques + 17 MLA).
 * Usage: node data/init-db.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { universites, filieresParUniversite } = require('./universites-seed');
const { campusesRowsForUniversite } = require('./campuses-seed');
const { computeNewSousFilieres } = require('../utils/filiereReferentielSync');

const dataDir = path.join(__dirname);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'shoolapp.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Création des tables...');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nom TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS filieres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    actif INTEGER NOT NULL DEFAULT 1,
    grand_groupe TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sous_filieres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filiere_id INTEGER NOT NULL REFERENCES filieres(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(filiere_id, slug)
  );

  CREATE TABLE IF NOT EXISTS universites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('publique', 'privee')),
    ville TEXT NOT NULL,
    description TEXT,
    logo TEXT,
    brochure TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS universite_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    universite_id INTEGER NOT NULL REFERENCES universites(id) ON DELETE CASCADE,
    fichier TEXT NOT NULL,
    ordre INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS universite_filieres (
    universite_id INTEGER NOT NULL REFERENCES universites(id) ON DELETE CASCADE,
    filiere_id INTEGER NOT NULL REFERENCES filieres(id) ON DELETE CASCADE,
    offre_filiere_entiere INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (universite_id, filiere_id)
  );

  CREATE TABLE IF NOT EXISTS universite_sous_filieres (
    universite_id INTEGER NOT NULL REFERENCES universites(id) ON DELETE CASCADE,
    sous_filiere_id INTEGER NOT NULL REFERENCES sous_filieres(id) ON DELETE CASCADE,
    PRIMARY KEY (universite_id, sous_filiere_id)
  );

  CREATE TABLE IF NOT EXISTS universite_specialites_libelle (
    universite_id INTEGER NOT NULL REFERENCES universites(id) ON DELETE CASCADE,
    filiere_id INTEGER NOT NULL REFERENCES filieres(id) ON DELETE CASCADE,
    libelle TEXT NOT NULL,
    PRIMARY KEY (universite_id, filiere_id, libelle)
  );

  CREATE TABLE IF NOT EXISTS campuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    universite_id INTEGER NOT NULL REFERENCES universites(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    ville TEXT NOT NULL,
    adresse TEXT,
    latitude REAL,
    longitude REAL,
    ordre INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    date_naissance TEXT NOT NULL,
    sexe TEXT NOT NULL CHECK(sexe IN ('M', 'F')),
    telephone TEXT NOT NULL,
    email TEXT NOT NULL,
    ville TEXT NOT NULL,
    niveau_etude TEXT,
    serie_bac TEXT,
    annee_bac TEXT,
    filiere_id INTEGER REFERENCES filieres(id),
    filiere_autre TEXT,
    universite_id INTEGER NOT NULL REFERENCES universites(id),
    type_universite TEXT NOT NULL CHECK(type_universite IN ('publique', 'privee')),
    pays_bureau TEXT NOT NULL DEFAULT 'CI' CHECK(pays_bureau IN ('CI', 'BF')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rendez_vous (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT NOT NULL,
    telephone TEXT NOT NULL,
    pays_bureau TEXT NOT NULL DEFAULT 'CI' CHECK(pays_bureau IN ('CI', 'BF')),
    type_rdv TEXT NOT NULL,
    date_souhaitee TEXT NOT NULL,
    creneau TEXT NOT NULL,
    message TEXT,
    statut TEXT NOT NULL DEFAULT 'nouveau' CHECK(statut IN ('nouveau', 'a_confirmer', 'confirme', 'annule', 'termine')),
    notes_internes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS demandes_orientation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT NOT NULL,
    telephone TEXT NOT NULL,
    pays_bureau TEXT NOT NULL DEFAULT 'CI' CHECK(pays_bureau IN ('CI', 'BF')),
    grande_filiere TEXT NOT NULL,
    specialite TEXT NOT NULL,
    besoin_orientation INTEGER NOT NULL DEFAULT 1 CHECK(besoin_orientation IN (0, 1)),
    message TEXT,
    statut TEXT NOT NULL DEFAULT 'nouveau' CHECK(statut IN ('nouveau', 'validee', 'traitee', 'annulee')),
    notes_internes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
  try {
    db.exec(`ALTER TABLE inscriptions ADD COLUMN pays_bureau TEXT NOT NULL DEFAULT 'CI';`);
  } catch (e) {
    if (!String(e.message || '').includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE filieres ADD COLUMN grand_groupe TEXT;');
  } catch (e) {
    if (!String(e.message || '').includes('duplicate column')) throw e;
  }

const filieres = [
  ['Médecine', 'medecine'],
  ['Informatique', 'informatique'],
  ['Droit', 'droit'],
  ['Gestion', 'gestion'],
  ['Marketing', 'marketing'],
  ['Génie civil', 'genie-civil'],
  ['Finance', 'finance'],
  ['Communication', 'communication'],
  ['Architecture', 'architecture'],
  ['Psychologie', 'psychologie'],
];

const insertFiliere = db.prepare('INSERT OR IGNORE INTO filieres (nom, slug) VALUES (?, ?)');
filieres.forEach(([nom, slug]) => insertFiliere.run(nom, slug));
console.log('10 filières insérées.');

const insertSousRef = db.prepare('INSERT OR IGNORE INTO sous_filieres (filiere_id, nom, slug) VALUES (?, ?, ?)');
const allFilRows = db.prepare('SELECT id, nom, slug, grand_groupe FROM filieres').all();
for (const f of allFilRows) {
  const existing = db.prepare('SELECT slug, nom FROM sous_filieres WHERE filiere_id = ?').all(f.id);
  const { toInsert } = computeNewSousFilieres(f, existing);
  for (const row of toInsert) {
    insertSousRef.run(f.id, row.nom, row.slug);
  }
}
console.log('Spécialités référentiel ajoutées comme sous-filières (sans doublon).');

const hash = bcrypt.hashSync('admin123', 10);
try {
  db.prepare('INSERT INTO admins (email, password, nom) VALUES (?, ?, ?)').run('admin@shoolapp.com', hash, 'Administrateur');
} catch (e) {
  if (e.code === 'SQLITE_CONSTRAINT') db.prepare('UPDATE admins SET password = ? WHERE email = ?').run(hash, 'admin@shoolapp.com');
}
console.log('Admin créé: admin@shoolapp.com / admin123');

const insertUni = db.prepare('INSERT INTO universites (nom, type, ville, description, logo) VALUES (?, ?, ?, ?, ?)');
const insertUF = db.prepare('INSERT INTO universite_filieres (universite_id, filiere_id) VALUES (?, ?)');
const updateUniLogo = db.prepare('UPDATE universites SET logo = ? WHERE id = ?');

// Réinitialisation des données de démo (ordre important à cause des clés étrangères)
db.exec('DELETE FROM universite_filieres;');
db.exec('DELETE FROM universite_photos;');
db.exec('DELETE FROM inscriptions;');
db.exec('DELETE FROM universites;');
const uniIds = [];
universites.forEach((u) => {
  const info = insertUni.run(u.nom, u.type, u.ville, u.description, u.logo ?? null);
  uniIds.push(Number(info.lastInsertRowid));
});

// Génération de logos SVG pour affichage dans les cartes (frontend)
const uploadsDir = path.join(__dirname, '..', 'uploads');
const logosDir = path.join(uploadsDir, 'logos');
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

const safeFile = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'logo';

const initials = (name) => {
  const parts = name
    .replace(/['()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !['université', 'universite', 'de', 'du', 'des', 'la', 'le', 'les', 'd', 'aix-marseille'].includes(p.toLowerCase()));
  const pick = (parts.length ? parts : name.split(/\s+/)).slice(0, 2);
  return pick.map((p) => p[0]).join('').toUpperCase().slice(0, 3);
};

const palette = [
  ['#0ea5e9', '#1d4ed8'],
  ['#a855f7', '#6366f1'],
  ['#f97316', '#ef4444'],
  ['#10b981', '#14b8a6'],
  ['#f59e0b', '#d97706'],
  ['#22c55e', '#16a34a'],
  ['#ec4899', '#db2777'],
  ['#64748b', '#0f172a'],
  ['#06b6d4', '#0ea5e9'],
  ['#8b5cf6', '#4f46e5'],
];

for (let idx = 0; idx < uniIds.length; idx++) {
  const id = uniIds[idx];
  const u = universites[idx];
  if (u.logo && (/^https?:\/\//i.test(u.logo) || /^images\//i.test(String(u.logo).trim()))) continue;
  const [c1, c2] = palette[idx % palette.length];
  const fileName = `logo-${safeFile(u.nom)}.svg`;
  const filePath = path.join(logosDir, fileName);
  const text = initials(u.nom);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect x="18" y="18" width="220" height="220" rx="42" fill="url(#g)" filter="url(#s)"/>
  <circle cx="206" cy="56" r="14" fill="rgba(255,255,255,0.25)"/>
  <circle cx="188" cy="74" r="8" fill="rgba(255,255,255,0.18)"/>
  <text x="128" y="148" text-anchor="middle" font-family="Outfit, system-ui, -apple-system, Segoe UI, Arial" font-size="86" font-weight="700" fill="#ffffff">${text}</text>
</svg>`;

  fs.writeFileSync(filePath, svg, 'utf8');
  updateUniLogo.run(filePath, id);
}

for (let idx = 0; idx < uniIds.length; idx++) {
  const universiteId = uniIds[idx];
  const fids = filieresParUniversite[idx + 1] || [1, 2];
  fids.forEach((fid) => insertUF.run(universiteId, fid));
}

const insertCampus = db.prepare(
  'INSERT INTO campuses (universite_id, nom, ville, adresse, latitude, longitude, ordre) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const allUnis = db.prepare('SELECT id, nom, ville FROM universites ORDER BY id').all();
for (const row of allUnis) {
  const campusRows = campusesRowsForUniversite(row.nom, row.ville);
  for (const c of campusRows) {
    insertCampus.run(row.id, c.nom, c.ville, c.adresse, c.latitude, c.longitude, c.ordre);
  }
}
console.log('22 universités, liaisons filières et campus créés.');

db.close();
console.log('Base initialisée: data/shoolapp.db');
process.exit(0);
