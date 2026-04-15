'use strict';

/**
 * Synchronise les spécialités du référentiel (frontend filieresGroupsConfig) en sous-filières en base.
 * Données : backend/data/referentiel.json
 * Régénérer après modification des listes côté frontend :
 *   cd frontend && node --input-type=module -e "import fs from 'fs'; import { GROUPS, GROUP_SOUS_FILIERES, GROUP_KEYWORDS, GROUP_SCORE_ORDER } from './src/data/filieresGroupsConfig.js'; fs.writeFileSync('../backend/data/referentiel.json', JSON.stringify({ groups: GROUPS, sousFilieres: GROUP_SOUS_FILIERES, keywords: GROUP_KEYWORDS, scoreOrder: GROUP_SCORE_ORDER }, null, 2));"
 */

const ref = require('../data/referentiel.json');

const GROUPS = ref.groups;
const GROUP_SOUS_FILIERES = ref.sousFilieres;
const GROUP_KEYWORDS = ref.keywords;
const GROUP_SCORE_ORDER = ref.scoreOrder;

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
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

function resolveFiliereGrandGroupe(filiere) {
  const g = filiere?.grand_groupe;
  if (g && GROUPS.includes(g)) return g;
  return assignFiliereToGroup(filiere);
}

/**
 * @param {object} filiereRow - { nom, slug, grand_groupe }
 * @param {Array<{slug:string,nom:string}>} existingList
 * @returns {{ group: string, toInsert: Array<{nom:string,slug:string}> }}
 */
function computeNewSousFilieres(filiereRow, existingList) {
  const group = resolveFiliereGrandGroupe(filiereRow);
  const labels = GROUP_SOUS_FILIERES[group] || [];
  const existingSlugs = new Set((existingList || []).map((e) => e.slug));
  const existingNomsNorm = new Set((existingList || []).map((e) => normalize(e.nom)));
  const toInsert = [];

  for (const label of labels) {
    const n = String(label).trim();
    if (n.length < 2) continue;
    if (existingNomsNorm.has(normalize(n))) continue;
    let slug = slugify(n);
    if (!slug) continue;
    let finalSlug = slug;
    let suffix = 1;
    while (existingSlugs.has(finalSlug)) {
      suffix += 1;
      finalSlug = `${slug}-${suffix}`;
    }
    existingSlugs.add(finalSlug);
    existingNomsNorm.add(normalize(n));
    toInsert.push({ nom: n, slug: finalSlug });
  }

  return { group, toInsert };
}

async function ensureReferentielSousFilieres(db, filiereId) {
  const id = Number(filiereId);
  const [rows] = await db.query('SELECT id, nom, slug, grand_groupe FROM filieres WHERE id = ?', [id]);
  if (!rows.length) return { added: 0, group: null, error: 'Filière introuvable.' };
  const f = rows[0];
  const [existing] = await db.query('SELECT slug, nom FROM sous_filieres WHERE filiere_id = ?', [id]);
  const { group, toInsert } = computeNewSousFilieres(f, existing || []);
  for (const row of toInsert) {
    await db.query('INSERT INTO sous_filieres (filiere_id, nom, slug) VALUES (?, ?, ?)', [id, row.nom, row.slug]);
  }
  return { added: toInsert.length, group };
}

async function ensureReferentielSousFilieresAll(db) {
  const [all] = await db.query('SELECT id FROM filieres ORDER BY id');
  let totalAdded = 0;
  const details = [];
  for (const row of all || []) {
    const r = await ensureReferentielSousFilieres(db, row.id);
    totalAdded += r.added;
    if (r.added > 0) details.push({ filiereId: row.id, added: r.added, group: r.group });
  }
  return { filieres: (all || []).length, sousFilieresAdded: totalAdded, details };
}

module.exports = {
  normalize,
  resolveFiliereGrandGroupe,
  assignFiliereToGroup,
  computeNewSousFilieres,
  ensureReferentielSousFilieres,
  ensureReferentielSousFilieresAll,
};
