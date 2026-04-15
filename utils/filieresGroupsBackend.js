/**
 * Aligné sur frontend/src/data/filieresGroupsConfig.js (classage filière / programme FIGS).
 * À maintenir en cohérence en cas de changement des groupes ou mots-clés.
 */
'use strict';

const GROUPS = [
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

const GROUP_KEYWORDS = {
  'Agri agro management': [
    'agri',
    'agro',
    'agricole',
    'rural',
    'economie agricole',
    'filiere agricole',
    'agroalimentaire',
    'ihedrea',
    'culture agricole',
  ],
  Communication: [
    'communication',
    'journal',
    'media',
    'charge de communication',
    'bts communication',
    'strategie marketing',
    'manager de la strategie marketing',
  ],
  'Comptabilite - gestion': [
    'compta',
    'comptabilite',
    'gestion comptable',
    'collaborateur en gestion',
    'expert financier',
    'licence',
    'diplome de comptabilite',
    'aftec',
    'igefi',
    'igs',
    'controle de gestion',
  ],
  Design: ['design', 'architecture', 'interieur', 'espace', 'esail', 'portfolio'],
  Environnement: [
    'environnement',
    'ecologie',
    'genie civil',
    'qse',
    'qhse',
    'qualite securite',
    'impact social',
    'impact environnemental',
    'coordinateur de projets',
    'biodiversite',
    'naturaliste',
    'rse',
    'economie circulaire',
    'developpement durable',
    'ccit portes',
    'normes 9001',
    '45001',
    '14001',
  ],
  Finance: [
    'finance',
    'banque',
    'economie',
    'achats',
    'supply chain',
    'manager des achats',
    'assurance',
    'hesca',
    'icl',
  ],
  Informatique: [
    'informatique',
    'data',
    'cyber',
    'cybersecurite',
    'developpement',
    'developpeur',
    'intelligence artificielle',
    'simplon',
    'administrateur systeme',
    'reseaux',
    'bases de donnees',
    'bts sio',
    'services informatiques',
    'epsi',
    'ynov',
    'afinum',
    'expert en informatique',
    'igenisia',
    'digital',
    'numerique',
    'web',
    'wis',
  ],
  Management: [
    'management',
    'gestion',
    'business',
    'manager de commerce',
    'manager de la strategie',
    'manager de projets nationaux',
    'manager qualite',
    'expert-conseil en strategie',
    'strategie commerciale',
    'ifag',
    'aipf',
    'aptil',
    'centre de profit',
    'responsable du developpement commercial',
    'ingenieur',
    'grade de master',
    'bac+5',
    'mba',
    'ecole',
    'medecine',
    'psychologie',
    'sante',
  ],
  Marketing: [
    'marketing',
    'commerce',
    'commercial',
    'idrac',
    'developpement commercial',
    'vente',
    'business development',
  ],
  'Relations internationales': [
    'relations internationales',
    'international',
    'diplomatique',
    'intelligence economique',
    'geopolitique',
    'ileri',
    'expert analyste',
    'master droit international',
    'droit',
    'jurid',
    'conseiller en droit',
  ],
  Tourisme: ['tourisme', 'hospitalite', 'bts tourisme', 'agence', 'ieft', 'afmge', 'vivamundi', 'hotel'],
};

const GROUP_SCORE_ORDER = [
  'Tourisme',
  'Informatique',
  'Relations internationales',
  'Environnement',
  'Comptabilite - gestion',
  'Communication',
  'Marketing',
  'Design',
  'Agri agro management',
  'Finance',
  'Management',
];

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function assignFiliereToGroup(filiere) {
  const blob = normalize([filiere.nom, filiere.slug].filter(Boolean).join(' '));

  const scores = {};
  for (const group of GROUPS) {
    const kws = GROUP_KEYWORDS[group] || [];
    let score = 0;
    for (const k of kws) {
      const nk = normalize(k);
      if (nk && blob.includes(nk)) score += Math.min(nk.length, 24);
    }
    scores[group] = score;
  }

  let best = 'Management';
  let bestScore = 0;
  for (const group of GROUP_SCORE_ORDER) {
    const s = scores[group] || 0;
    if (s > bestScore) {
      bestScore = s;
      best = group;
    }
  }

  if (bestScore === 0) {
    if (blob.includes('droit') || blob.includes('jurid')) return 'Relations internationales';
    if (blob.includes('medecine') || blob.includes('sante')) return 'Management';
    if (blob.includes('psychologie')) return 'Management';
    if (blob.includes('genie')) return 'Environnement';
  }

  return best;
}

function assignProgramToGroup(program) {
  const blob = normalize(
    [
      program.titreVisaGrade,
      program.certificateur,
      program.commentaires,
      program.prerequis,
      program.repartitionCoursEntreprise,
    ].join(' ')
  );

  const scores = {};
  for (const group of GROUPS) {
    const kws = GROUP_KEYWORDS[group] || [];
    let score = 0;
    for (const k of kws) {
      const nk = normalize(k);
      if (nk && blob.includes(nk)) score += Math.min(nk.length, 24);
    }
    scores[group] = score;
  }

  let best = 'Management';
  let bestScore = 0;
  for (const group of GROUP_SCORE_ORDER) {
    const s = scores[group] || 0;
    if (s > bestScore) {
      bestScore = s;
      best = group;
    }
  }

  if (bestScore === 0) {
    if (blob.includes('tourisme') || blob.includes('agence')) return 'Tourisme';
    if (blob.includes('informatique') || blob.includes('numerique') || blob.includes('cyber')) return 'Informatique';
    if (blob.includes('international') || blob.includes('diplomatique')) return 'Relations internationales';
    if (blob.includes('droit') || blob.includes('jurid')) return 'Relations internationales';
  }

  return best;
}

module.exports = {
  GROUPS,
  GROUP_KEYWORDS,
  GROUP_SCORE_ORDER,
  normalize,
  assignFiliereToGroup,
  assignProgramToGroup,
};

