/**
 * Lit un export TSV FIGS (séparateur TAB) et produit figs-programmes.json dédupliqué.
 * Usage: node scripts/parse-figs-tsv.mjs [chemin.tsv]
 * Défaut: ../data/figs-programmes.tsv
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const defaultTsv = path.join(root, 'data', 'figs-programmes.tsv');
const outJson = path.join(root, 'data', 'figs-programmes.json');

const tsvPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultTsv;

const HEADER_TO_CAMEL = {
  'classe_dediee_figs': 'classeDedieeFigs',
  rythme: 'rythme',
  repartition_coursentreprise: 'repartitionCoursEntreprise',
  duree_du_stage: 'dureeStage',
  online_offline: 'onlineOffline',
  code_rncp: 'codeRncp',
  date_de_validite_titre_rncp: 'dateValiditeRncp',
  titre_visa_grade: 'titreVisaGrade',
  certificateur: 'certificateur',
  rentree_administrative: 'rentreeAdmin',
  debut_des_cours: 'debutCours',
  retard_autorise_jusqua: 'retardJusqua',
  prix_figs_n: 'prixFigs',
  price_after_scholarship: 'priceAfterScholarship',
  prix_n1_titre_indicatif: 'prixNPlus1',
  commentaires_etou_profil_candidat: 'commentaires',
  prerequis_pour_integrer_la_formation: 'prerequis',
};

function slugHeader(h) {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function parseLine(line) {
  const cols = line.split('\t');
  return cols.map((c) => (c == null ? '' : String(c).trim()));
}

function isJunkRow(obj) {
  const code = (obj.code_rncp || '').trim();
  const titre = (obj.titre_visa_grade || '').trim();
  if (!titre && !code) return true;
  if (titre.length < 6 && !/^\d+$/.test(code) && code !== 'Diplôme école') return true;
  return false;
}

function mergePrefer(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) {
    const va = (a[k] || '').trim();
    const vb = (b[k] || '').trim();
    if (!va) out[k] = vb;
    else if (vb && vb !== va && vb.length > va.length) out[k] = vb;
    else if (vb && vb !== va && /#########/.test(va) && !/#########/.test(vb)) out[k] = vb;
  }
  return out;
}

const raw = fs.readFileSync(tsvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter((l) => l.trim());

if (lines.length < 2) {
  console.error('TSV vide ou une seule ligne:', tsvPath);
  process.exit(1);
}

const headerCells = parseLine(lines[0]);
const keys = headerCells.map(slugHeader);

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cells = parseLine(lines[i]);
  if (cells.length < keys.length - 2) continue;
  const o = {};
  keys.forEach((k, j) => {
    o[k] = cells[j] ?? '';
  });
  if (isJunkRow(o)) continue;
  rows.push(o);
}

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toCamel(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = HEADER_TO_CAMEL[k] || snakeToCamel(k);
    out[camel] = v;
  }
  return out;
}

const dedupeKey = (r) =>
  [
    r.code_rncp || '',
    (r.titre_visa_grade || '').slice(0, 120),
    r.rythme || '',
    r.certificateur || '',
    r.repartition_coursentreprise || '',
    r.prix_figs_n || '',
  ].join('|');

const map = new Map();
for (const r of rows) {
  const k = dedupeKey(r);
  if (!map.has(k)) map.set(k, { ...r, _occurrences: 1 });
  else {
    const prev = map.get(k);
    map.set(k, mergePrefer(prev, r));
    map.get(k)._occurrences = (prev._occurrences || 1) + 1;
  }
}

const programs = [...map.values()].map((r, idx) => {
  const { _occurrences, ...rest } = r;
  const camel = toCamel(rest);
  return {
    id: idx + 1,
    ...camel,
    occurrencesSource: _occurrences,
  };
});

programs.sort((a, b) => {
  const ca = String(a.certificateur || '').localeCompare(String(b.certificateur || ''), 'fr');
  if (ca !== 0) return ca;
  return String(a.titreVisaGrade || '').localeCompare(String(b.titreVisaGrade || ''), 'fr');
});

fs.writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), total: programs.length, programs }, null, 2), 'utf8');
console.log('Écrit', outJson, '—', programs.length, 'programmes (dédupliqués),', rows.length, 'lignes brutes');
