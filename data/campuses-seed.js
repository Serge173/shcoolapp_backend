/**
 * Villes avec coordonnées (centre-ville approximatif) pour cartes OSM.
 * Clé = nom d'université (identique à universites-seed.js).
 * Valeur = liste de villes (un campus par ville).
 */
const CITY_COORDS = {
  Paris: [48.8566, 2.3522],
  Lyon: [45.764, 4.8357],
  Marseille: [43.2965, 5.3698],
  Toulouse: [43.6047, 1.4442],
  Nice: [43.7102, 7.262],
  Nantes: [47.2184, -1.5536],
  Strasbourg: [48.5734, 7.7521],
  Montpellier: [43.6108, 3.8767],
  Bordeaux: [44.8378, -0.5792],
  Lille: [50.6292, 3.0573],
  Rennes: [48.1173, -1.6778],
  Reims: [49.2583, 4.0317],
  Grenoble: [45.1885, 5.7245],
  Dijon: [47.322, 5.0415],
  Angers: [47.4739, -0.5517],
  Tours: [47.3941, 0.6848],
  'Saint-Étienne': [45.4397, 4.3872],
  Toulon: [43.1242, 5.928],
  Amiens: [49.8941, 2.2958],
  Perpignan: [42.6886, 2.8948],
  Caen: [49.1829, -0.3707],
  Mulhouse: [47.7508, 7.3359],
  Besançon: [47.238, 6.0243],
  Rouen: [49.4431, 1.0993],
  Nancy: [48.6921, 6.1844],
  Orléans: [47.9029, 1.9093],
  Metz: [49.1193, 6.1757],
  Brest: [48.3905, -4.4861],
  Limoges: [45.8354, 1.2611],
  Poitiers: [46.5802, 0.3404],
  Annecy: [45.8992, 6.1294],
  'La Rochelle': [46.1603, -1.1511],
  Avignon: [43.9493, 4.8055],
  Pau: [43.2951, -0.3708],
  Puteaux: [48.8835, 2.2389],
  Courbevoie: [48.8969, 2.2564],
  'Gif-sur-Yvette': [48.7018, 2.1342],
  'Le Kremlin-Bicêtre': [48.81, 2.3587],
  Villejuif: [48.787, 2.3594],
  'Le Mans': [48.0077, 0.1984],
};

function ll(ville) {
  const c = CITY_COORDS[ville];
  if (c) return { latitude: c[0], longitude: c[1] };
  const paris = CITY_COORDS.Paris;
  return { latitude: paris[0], longitude: paris[1] };
}

/** Listes de campus par école (nombre = villes = campus) */
const CAMPUSES_BY_UNIVERSITE = {
  'Sorbonne Université': ['Paris'],
  'Université Paris-Saclay': ['Gif-sur-Yvette'],
  'Université de Strasbourg': ['Strasbourg'],
  'Université de Lille': ['Lille'],
  'Aix-Marseille Université': ['Marseille'],
  '3A': ['Lyon', 'Paris', 'Bordeaux', 'Nantes', 'Montpellier', 'Toulouse'],
  CEFAM: ['Lyon', 'Saint-Étienne'],
  EPSI: ['Paris', 'Lyon', 'Nantes', 'Bordeaux', 'Lille', 'Toulouse', 'Montpellier', 'Rennes', 'Strasbourg', 'Nice', 'Marseille'],
  ESAIL: ['Lyon', 'Bordeaux'],
  ESMD: ['Lille'],
  HESCA: ['Puteaux'],
  ICL: ['Lille', 'Lyon', 'Nantes', 'Montpellier', 'Grenoble', 'Paris'],
  'IDRAC Business School': ['Lyon', 'Paris', 'Toulouse', 'Nantes', 'Bordeaux', 'Lille', 'Montpellier', 'Nice', 'Strasbourg', 'Marseille'],
  IEFT: ['Paris', 'Lyon', 'Nantes', 'Montpellier', 'Bordeaux', 'Le Mans'],
  IET: ['Paris', 'Lyon', 'Nantes', 'Montpellier', 'Bordeaux', 'Toulouse', 'Grenoble', 'Lille'],
  IFAG: ['Paris', 'Lyon', 'Lille', 'Nantes', 'Bordeaux', 'Toulouse', 'Montpellier', 'Rennes', 'Strasbourg', 'Nice', 'Marseille', 'Grenoble', 'Angers'],
  IGEFI: ['Paris', 'Lyon', 'Lille', 'Nantes', 'Bordeaux', 'Nice'],
  IHEDREA: ['Paris', 'Rennes', 'Toulouse'],
  ILERI: ['Paris', 'Lyon', 'Nantes', 'Bordeaux', 'Lille'],
  "SUP'DE COM": ['Paris', 'Lyon', 'Lille', 'Nantes', 'Bordeaux', 'Toulouse', 'Montpellier', 'Rennes', 'Strasbourg', 'Nice', 'Marseille', 'Grenoble', 'Angers'],
  VIVAMUNDI: ['Paris', 'Lyon', 'Lille', 'Nantes', 'Bordeaux', 'Toulouse', 'Montpellier', 'Rennes', 'Strasbourg', 'Nice', 'Marseille', 'Grenoble', 'Angers', 'Dijon', 'Reims'],
  WIS: ['Paris', 'Lyon', 'Lille', 'Nantes', 'Bordeaux', 'Toulouse', 'Montpellier', 'Rennes', 'Strasbourg'],
};

function campusesRowsForUniversite(nomUniversite, villeSiege) {
  const villes = CAMPUSES_BY_UNIVERSITE[nomUniversite];
  const list = villes && villes.length > 0 ? villes : [villeSiege || 'Paris'];
  return list.map((ville, ordre) => {
    const { latitude, longitude } = ll(ville);
    return {
      nom: `Campus ${ville}`,
      ville,
      adresse: `Situation géographique : ${ville}, France`,
      latitude,
      longitude,
      ordre,
    };
  });
}

module.exports = { campusesRowsForUniversite, CAMPUSES_BY_UNIVERSITE, CITY_COORDS };
