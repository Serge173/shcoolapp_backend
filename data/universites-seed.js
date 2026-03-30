/**
 * Données communes : universités de démo (5 publiques + 17 écoles réseau MLA)
 * et liaisons filières (ids 1–22). Utilisé par init-db.js (SQLite) et seed-universites.js (MySQL).
 */

function faviconLogo(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`;
}

/** Fichiers dans frontend/public/images/ecoles/ (servis à /images/ecoles/...) */
function ecoleLogo(filename) {
  return `images/ecoles/${filename}`;
}

const universites = [
  { nom: 'Sorbonne Université', type: 'publique', ville: 'Paris', description: 'Université pluridisciplinaire : sciences, lettres et médecine, au cœur de Paris.', logo: null },
  { nom: 'Université Paris-Saclay', type: 'publique', ville: 'Gif-sur-Yvette', description: 'Grand pôle scientifique et technologique (ingénierie, sciences, santé).', logo: null },
  { nom: 'Université de Strasbourg', type: 'publique', ville: 'Strasbourg', description: 'Université européenne : sciences, droit, économie et lettres.', logo: null },
  { nom: 'Université de Lille', type: 'publique', ville: 'Lille', description: 'Offre de formation large : santé, sciences, droit et gestion.', logo: null },
  { nom: 'Aix-Marseille Université', type: 'publique', ville: 'Marseille', description: 'Université majeure en France : droit, économie, sciences et santé.', logo: null },
  {
    nom: '3A',
    type: 'privee',
    ville: 'France',
    description:
      'Réseau MLA — 6 campus · 4 formations. École de commerce internationale, management responsable et développement durable (ecole3a.edu).',
    logo: ecoleLogo('medium_LOGO_3_A_and_GRIS_CMJN_2596bcbdf1_657a5eab8f.jpg'),
  },
  {
    nom: 'CEFAM',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 2 formations. Centre d’études franco-américain de management (cefam.fr).',
    logo: ecoleLogo('medium_CEFAM_RVB_c2f531b12a.jpg'),
  },
  {
    nom: 'EPSI',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 11 campus · 10 formations. École d’ingénieurs informatique et cybersécurité (epsi.fr).',
    logo: ecoleLogo('medium_LOGO_EPSI_and_RVB_1_6d626ce03d_dd2487977b.png'),
  },
  {
    nom: 'ESAIL',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 2 campus · 2 formations. École d’architecture intérieure et design (esail.fr).',
    logo: ecoleLogo('medium_LOGO_ESAIL_and_RVB_2_5605366d43_fc3ccf1fa5.png'),
  },
  {
    nom: 'ESMD',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA. École supérieure (esmd.fr).',
    logo: ecoleLogo('medium_ESMD_88ab6b12d7.png'),
  },
  {
    nom: 'HESCA',
    type: 'privee',
    ville: 'Puteaux',
    description: 'Réseau MLA — 4 formations. Stratégies commerciales et assurance (hesca.fr).',
    logo: ecoleLogo('Logo_Hesca_2025_66788c9a0c.png'),
  },
  {
    nom: 'ICL',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 6 campus · 2 formations. École des business developers (icl.fr).',
    logo: ecoleLogo('medium_LOGO_ICL_and_RVB_NOIR_vf_f8b2f7ce8e.png'),
  },
  {
    nom: 'IDRAC Business School',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 10 campus · 9 formations. Management, marketing et business development (idrac.com).',
    logo: ecoleLogo('medium_IDRAC_logo_cdc71d3614.png'),
  },
  {
    nom: 'IEFT',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 6 campus · 4 formations. École du management du tourisme (ieftourisme.com).',
    logo: ecoleLogo('medium_LOGO_IEFT_and_RVB_1_29eaf3f17c_22c1a58275.png'),
  },
  {
    nom: 'IET',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 8 campus · 4 formations. École de l’environnement et de la transition (iet.fr).',
    logo: ecoleLogo('medium_LOGO_IET_and_RVB_a65724f649_b8d12a0cb4.png'),
  },
  {
    nom: 'IFAG',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 13 campus · 2 formations. Entreprendre et management (ifag.fr).',
    logo: ecoleLogo('IFAG_Bloc_Marque_rouge_2c8f4a0025.png'),
  },
  {
    nom: 'IGEFI',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 6 campus · 3 formations. Finance d’entreprise et expertise comptable (igefi.net).',
    logo: ecoleLogo('medium_LOGO_IGEFI_SIGN_BAS_and_CMJN_e91be09e87.jpg'),
  },
  {
    nom: 'IHEDREA',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 3 campus · 3 formations. Agri-management et filières agricoles (ihedrea.org).',
    logo: ecoleLogo('small_LOGO_IHEDREA_and_RVB_1_0e1efcec2b_7c5d354b79.png'),
  },
  {
    nom: 'ILERI',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 5 campus · 6 formations. Relations internationales et géopolitique (ileri.fr).',
    logo: ecoleLogo('medium_LOGO_ILERI_and_RVB_1_624b35dd3b_949aaaf49f.png'),
  },
  {
    nom: "SUP'DE COM",
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 13 campus · 3 formations. Communication et médias (supdecom.fr).',
    logo: ecoleLogo('medium_LOGO_SUPDECOM_and_RVB_1_3cfa6e6ffd_3b38beca52.png'),
  },
  {
    nom: 'VIVAMUNDI',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 15 campus · 21 formations. Réseau d’écoles et de formations (vivamundi.fr).',
    logo: ecoleLogo('medium_VIVA_MUNDI_LOGO_RVB_3_bf48a63bb2_a4fb51bc01.png'),
  },
  {
    nom: 'WIS',
    type: 'privee',
    ville: 'France',
    description: 'Réseau MLA — 9 campus. École web et digital (wis.fr).',
    logo: ecoleLogo('medium_LOGO_WIS_and_RVB_2025_WIS_VECTORISE_NOIR_4fb2d87bde.png'),
  },
];

const filieresParUniversite = {
  1: [1, 2, 3, 4, 7],
  2: [2, 4, 5, 6, 7],
  3: [2, 4, 6, 8],
  4: [2, 6, 9],
  5: [1, 2, 3, 10],
  6: [2, 3, 4, 5, 7, 8],
  7: [2, 3, 4, 5, 7, 8],
  8: [2, 3, 4, 5, 7, 8],
  9: [2, 3, 4, 5, 7, 8],
  10: [2, 3, 4, 5, 7, 8],
  11: [2, 3, 4, 5, 7, 8],
  12: [2, 3, 4, 5, 7, 8],
  13: [2, 3, 4, 5, 7, 8],
  14: [2, 3, 4, 5, 7, 8],
  15: [2, 3, 4, 5, 7, 8],
  16: [2, 3, 4, 5, 7, 8],
  17: [2, 3, 4, 5, 7, 8],
  18: [2, 3, 4, 5, 7, 8],
  19: [2, 3, 4, 5, 7, 8],
  20: [2, 3, 4, 5, 7, 8],
  21: [2, 3, 4, 5, 7, 8],
  22: [2, 3, 4, 5, 7, 8],
};

module.exports = { faviconLogo, ecoleLogo, universites, filieresParUniversite };
