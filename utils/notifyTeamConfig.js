/**
 * Destinataires « équipe FIGS » : e-mails et WhatsApp pour inscriptions, RDV, demandes d’orientation.
 *
 * Déploiement (recommandé) :
 *   NOTIFY_TEAM_EMAILS=admissions.abidjan@figs-education.com,info.abidjan@figs-education.com
 *   WHATSAPP_TEAM_TO=2250757688519,2250777552815
 *
 * Priorités e-mail :
 *   1) NOTIFY_EMAIL_RDV uniquement pour les alertes **rendez-vous** (si défini)
 *   2) NOTIFY_TEAM_EMAILS pour tout le reste (inscriptions, orientation…)
 *   3) NOTIFY_EMAIL_TO (ancien, une ou plusieurs adresses)
 *   4) défaut FIGS Abidjan (deux boîtes)
 *
 * Priorités WhatsApp :
 *   1) WHATSAPP_RDV_TO pour les alertes **RDV** uniquement (si défini)
 *   2) WHATSAPP_TEAM_TO pour tout le reste
 *   3) WHATSAPP_TO (un seul numéro, compatibilité)
 *   4) défaut : deux lignes conseillers
 */

const DEFAULT_TEAM_EMAILS = ['admissions.abidjan@figs-education.com', 'info.abidjan@figs-education.com'];
const DEFAULT_TEAM_WHATSAPP = ['2250757688519', '2250777552815'];

function parseCsv(raw) {
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripPlusPhone(s) {
  return String(s || '')
    .trim()
    .replace(/^\+/, '')
    .replace(/\s/g, '');
}

/**
 * @param {{ preferRdvEmailOverride?: boolean }} [opts] preferRdvEmailOverride : true = flux RDV uniquement
 */
function getTeamEmailRecipients(opts = {}) {
  if (opts.preferRdvEmailOverride) {
    const rdv = parseCsv(process.env.NOTIFY_EMAIL_RDV);
    if (rdv.length) return rdv;
  }
  const team = parseCsv(process.env.NOTIFY_TEAM_EMAILS);
  if (team.length) return team;
  const legacy = parseCsv(process.env.NOTIFY_EMAIL_TO);
  if (legacy.length) return legacy;
  return [...DEFAULT_TEAM_EMAILS];
}

/**
 * @param {{ preferRdvWaOverride?: boolean }} [opts] preferRdvWaOverride : true = flux RDV uniquement
 */
function getTeamWhatsappRecipients(opts = {}) {
  if (opts.preferRdvWaOverride) {
    const rdv = parseCsv(process.env.WHATSAPP_RDV_TO)
      .map(stripPlusPhone)
      .filter(Boolean);
    if (rdv.length) return rdv;
  }
  const team = parseCsv(process.env.WHATSAPP_TEAM_TO)
    .map(stripPlusPhone)
    .filter(Boolean);
  if (team.length) return team;
  const legacy = stripPlusPhone(process.env.WHATSAPP_TO);
  if (legacy) return [legacy];
  return [...DEFAULT_TEAM_WHATSAPP];
}

module.exports = {
  parseCsv,
  getTeamEmailRecipients,
  getTeamWhatsappRecipients,
  DEFAULT_TEAM_EMAILS,
  DEFAULT_TEAM_WHATSAPP,
};
