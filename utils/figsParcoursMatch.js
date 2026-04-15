/**
 * Filtre les établissements à partir du catalogue FIGS (fichier partagé figs-programmes.json) :
 * — spécialité = surtout titreVisaGrade (ligne diploma du tableau FIGS) + texte pédagogique ;
 * — niveau = doit correspondre au diplôme affiché (BTS/BUT sur le titre ; cycles sup. titre + prérequis) ;
 * — école = certificateur relié au nom d’établissement (règles MLA + cas MESR / ministère).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const {
  normalize,
  assignFiliereToGroup,
  assignProgramToGroup,
  GROUP_KEYWORDS,
} = require('./filieresGroupsBackend');

const FILIERE_STOPWORDS = new Set([
  'filiere',
  'filieres',
  'etude',
  'etudes',
  'formation',
  'parcours',
  'diplome',
  'superieur',
  'universite',
  'ecole',
]);

let programsCache = null;
let programsMtime = 0;

function getPrograms() {
  const p = path.join(__dirname, '..', 'data', 'figs-programmes.json');
  const stat = fs.statSync(p);
  if (!programsCache || stat.mtimeMs !== programsMtime) {
    programsMtime = stat.mtimeMs;
    const raw = fs.readFileSync(p, 'utf8');
    programsCache = JSON.parse(raw).programs || [];
  }
  return programsCache;
}

/** Même logique que frontend/src/utils/figsProgramToUniversite.js */
function resolveUniversiteIdForProgram(program, universites) {
  const cert = String(program.certificateur || '');
  const rows = universites.map((u) => ({ id: u.id, n: normalize(u.nom) }));

  const pick = (pred) => rows.find((r) => pred(r.n))?.id ?? null;

  if (/idrac/i.test(cert)) return pick((n) => n.includes('idrac'));
  if (/aptim|aptil|aipf-aptim/i.test(cert)) return pick((n) => n.includes('3a'));
  if (/^aipf$|ifag/i.test(cert.trim())) return pick((n) => n.includes('ifag'));
  if (/supdecom|sup de com/i.test(cert)) return pick((n) => n.includes('sup') && n.includes('com'));
  if (/ileri/i.test(cert)) return pick((n) => n.includes('ileri'));
  if (/iet\b|ccit portes/i.test(cert)) return pick((n) => n === 'iet' || n.startsWith('iet '));
  if (/ieft|afmge/i.test(cert)) return pick((n) => n.includes('ieft'));
  if (/vivamundi/i.test(cert)) return pick((n) => n.includes('vivamundi'));
  if (/igefi|aftec/i.test(cert)) return pick((n) => n.includes('igefi'));
  if (/epsi|afinum|igensia/i.test(cert)) return pick((n) => n.includes('epsi'));
  if (/ynov/i.test(cert)) return pick((n) => n.includes('epsi'));
  if (/simplon/i.test(cert)) return pick((n) => n.includes('wis'));
  if (/esail/i.test(cert)) return pick((n) => n.includes('esail'));
  if (/ihedrea/i.test(cert)) return pick((n) => n.includes('ihedrea'));
  if (/hesca/i.test(cert)) return pick((n) => n.includes('hesca'));
  if (/icl\b/i.test(cert)) return pick((n) => n.includes('icl'));
  if (/cefam/i.test(cert)) return pick((n) => n.includes('cefam'));

  const blob = normalize(cert);
  const first = blob.split(/\s+/).filter(Boolean)[0];
  if (first && first.length > 2) {
    const loose = rows.find((r) => r.n.includes(first));
    if (loose) return loose.id;
  }

  return null;
}

function mesrSchoolMatch(program, universite) {
  const n = normalize(universite.nom);
  const t = normalize(program.titreVisaGrade || '');
  if (t.includes('bts') && t.includes('tourisme')) {
    return n.includes('ieft') || n.includes('vivamundi');
  }
  if (t.includes('bts') && t.includes('communication')) {
    return n.includes('ifag') || n.includes('idrac') || (n.includes('sup') && n.includes('com'));
  }
  if (t.includes('comptabilite') || t.includes('compta') || t.includes('diplome de comptabilite')) {
    return n.includes('igefi') || n.includes('igs') || n.includes('epsi');
  }
  if (t.includes('bts') && (t.includes('services informatiques') || t.includes('sio'))) {
    return n.includes('epsi') || n.includes('wis') || n.includes('ynov');
  }
  return false;
}

function programMatchesSchool(program, universite, allUniversites) {
  const id = resolveUniversiteIdForProgram(program, allUniversites);
  if (id != null) return Number(id) === Number(universite.id);

  const certRaw = String(program.certificateur || '').trim();
  const cert = normalize(certRaw);
  if (cert === 'mesr' || /^mesr$/i.test(certRaw)) {
    return mesrSchoolMatch(program, universite);
  }
  if (cert.includes('ministere') || cert.includes('enseignement superieur')) {
    return mesrSchoolMatch(program, universite);
  }
  return false;
}

function programMatchesNiveau(program, niveau) {
  if (!niveau || niveau === 'Autre') return true;

  const titre = String(program.titreVisaGrade || '');
  const blob = normalize([titre, program.prerequis, program.commentaires].join(' '));

  switch (niveau) {
    case 'BTS':
      return /\bbts\b/i.test(titre);
    case 'BUT':
      return /\bbut\b/i.test(titre);
    case 'B1':
      return (
        /(bachelor.*\b1\b|1re année|première année|\bl1\b|bac\s*\+\s*1|\bb1\b)/i.test(blob) ||
        /licence\s*1/i.test(blob)
      );
    case 'B2':
      return (
        /(bachelor.*\b2\b|2e année|deuxième année|\bl2\b|bac\s*\+\s*2|\bb2\b)/i.test(blob) ||
        /licence\s*2/i.test(blob)
      );
    case 'B3':
      return (
        /(bachelor.*\b3\b|3e année|\bl3\b|bac\s*\+\s*3|bac\+3|grade de licence|diplôme visé bac\+3)/i.test(
          blob
        ) || /licence\s*3/i.test(blob)
      );
    case 'M1':
      return (
        /(master\s*1|\bm1\b|1re année.*master|grade de master)/i.test(blob) ||
        /master.*1re/i.test(titre)
      );
    case 'M2':
      return /(master\s*2|\bm2\b|msc\b|2e année.*master)/i.test(blob);
    case 'MBA':
      return /\bmba\b/i.test(titre + String(program.commentaires || ''));
    case 'Doctorat':
      return /(doctorat|thèse|these|\bphd\b)/i.test(blob);
    default:
      return true;
  }
}

function filiereSearchTerms(filiere) {
  const terms = new Set();
  const add = (s) => {
    normalize(String(s || ''))
      .split(/[^a-z0-9]+/)
      .forEach((w) => {
        if (w.length >= 4 && !FILIERE_STOPWORDS.has(w)) terms.add(w);
      });
  };
  add(filiere.nom);
  add(String(filiere.slug || '').replace(/-/g, ' '));
  if (normalize(filiere.nom).length >= 3) terms.add(normalize(filiere.nom));
  return Array.from(terms);
}

function programSpecialtyBlob(program) {
  return normalize(
    [
      program.titreVisaGrade,
      program.prerequis,
      program.commentaires,
      program.repartitionCoursEntreprise,
    ].join(' ')
  );
}

/** La filière choisie apparaît dans les champs FIGS (spécialité / prérequis / modalités). */
function programMentionsFiliereTerms(program, filiere) {
  const blob = programSpecialtyBlob(program);
  const terms = filiereSearchTerms(filiere);
  if (terms.some((t) => t.length >= 3 && blob.includes(t))) return true;
  const slugCompact = normalize(String(filiere.slug || '').replace(/-/g, ''));
  if (slugCompact.length >= 5 && blob.includes(slugCompact)) return true;
  return false;
}

/** Mot-clé métier du grand groupe présent dans le titre du diplôme FIGS (ligne « titre / visa »). */
function titreContainsGroupKeyword(program, filiereGroup) {
  const titre = normalize(program.titreVisaGrade || '');
  const kws = (GROUP_KEYWORDS[filiereGroup] || [])
    .map((k) => normalize(k))
    .filter((k) => k.length >= 4);
  return kws.some((k) => titre.includes(k));
}

function filiereNomSlugBlob(filiere) {
  return normalize(`${filiere.nom || ''} ${filiere.slug || ''}`.replace(/-/g, ' '));
}

/**
 * Diplômes MESR / ministère : intitulés exacts du fichier FIGS (ex. « BTS - Tourisme »).
 * On ne les associe à une filière que si le nom/slug de la filière (ou le groupe exact) correspond
 * à cette spécialité — pas « Marketing » pour « BTS Communication ».
 */
function mesrNationalSpecialtyBridge(program, filiere) {
  const c = normalize(String(program.certificateur || ''));
  if (c !== 'mesr' && !c.includes('ministere') && !c.includes('enseignement superieur')) return false;

  const titreRaw = program.titreVisaGrade || '';
  const t = normalize(titreRaw);
  const g = assignFiliereToGroup(filiere);
  const fn = filiereNomSlugBlob(filiere);

  if (/\bbts\b/i.test(titreRaw) && t.includes('tourisme')) {
    return g === 'Tourisme' || fn.includes('tourisme') || fn.includes('tourism') || fn.includes('hotel');
  }
  if (/\bbts\b/i.test(titreRaw) && t.includes('communication')) {
    return g === 'Communication' || fn.includes('communication') || fn.includes('journal') || fn.includes('media');
  }
  if (/\bbts\b/i.test(titreRaw) && (t.includes('services informatiques') || t.includes('sio'))) {
    return g === 'Informatique' || fn.includes('informatique') || fn.includes('numerique') || fn.includes('digital');
  }
  if (t.includes('comptabilite') || t.includes('compta') || t.includes('diplome de comptabilite')) {
    return (
      g === 'Comptabilite - gestion' ||
      g === 'Finance' ||
      fn.includes('compta') ||
      fn.includes('comptabilite') ||
      fn.includes('gestion') ||
      fn.includes('finance')
    );
  }
  return false;
}

function programMatchesFiliere(program, filiere) {
  if (mesrNationalSpecialtyBridge(program, filiere)) {
    return true;
  }

  /** Termes du nom / slug de la filière présents dans le fichier FIGS → priorité sur le seul classement par groupe. */
  if (programMentionsFiliereTerms(program, filiere)) {
    return true;
  }

  const gProg = assignProgramToGroup(program);
  const gFil = assignFiliereToGroup(filiere);
  if (gProg !== gFil) return false;

  return titreContainsGroupKeyword(program, gFil);
}

/**
 * @param {Array<{id:number,nom:string}>} universites - déjà filtrées par filière + type
 * @param {{id:number,nom:string,slug:string}} filiere
 * @param {string} niveau - valeur NIVEAUX_PARCOURS
 */
function filterUniversitesByFiliereNiveauFigs(universites, filiere, niveau) {
  if (!niveau || !filiere || !universites.length) return universites;

  const programs = getPrograms();

  return universites.filter((u) =>
    programs.some(
      (p) =>
        programMatchesSchool(p, u, universites) &&
        programMatchesNiveau(p, niveau) &&
        programMatchesFiliere(p, filiere)
    )
  );
}

/** Ordre d’affichage — garder aligné avec frontend/src/data/niveauxParcours.js */
const NIVEAUX_PARCOURS_ORDER = ['BTS', 'BUT', 'B1', 'B2', 'B3', 'M1', 'M2', 'MBA', 'Doctorat', 'Autre'];

/**
 * Niveaux pour lesquels une fiche FIGS correspond à la filière ET une école privée du réseau porte ce programme.
 * @param {{id:number,nom:string,slug:string}} filiere
 * @param {Array<{id:number,nom:string}>} universitesPrivees — écoles liées à cette filière (type privé)
 */
function getAvailableNiveauxForFiliere(filiere, universitesPrivees) {
  if (!filiere || !universitesPrivees || universitesPrivees.length === 0) {
    return [];
  }

  const programs = getPrograms();
  const universites = universitesPrivees;
  const matched = new Set();

  for (const p of programs) {
    if (!programMatchesFiliere(p, filiere)) continue;
    const hasSchool = universites.some((u) => programMatchesSchool(p, u, universites));
    if (!hasSchool) continue;
    for (const n of NIVEAUX_PARCOURS_ORDER) {
      if (n === 'Autre') continue;
      if (programMatchesNiveau(p, n)) matched.add(n);
    }
  }

  const ordered = NIVEAUX_PARCOURS_ORDER.filter((n) => n !== 'Autre' && matched.has(n));
  if (ordered.length > 0) {
    ordered.push('Autre');
  }
  return ordered;
}

module.exports = {
  filterUniversitesByFiliereNiveauFigs,
  getAvailableNiveauxForFiliere,
  getPrograms,
  programMatchesNiveau,
  programMatchesFiliere,
  programMatchesSchool,
  programMentionsFiliereTerms,
};
