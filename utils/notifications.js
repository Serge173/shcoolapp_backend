const nodemailer = require('nodemailer');
const {
  getTeamEmailRecipients,
  getTeamWhatsappRecipients,
} = require('./notifyTeamConfig');

function logSettled(tag, results, labels) {
  results.forEach((r, i) => {
    const lab = labels[i] || String(i);
    if (r.status === 'fulfilled') {
      const v = r.value;
      if (v && v.skipped) console.warn(`[notify:${tag}:${lab}] skipped:`, v.reason);
      else console.info(`[notify:${tag}:${lab}] ok`, v && (v.to || v.recipients) ? JSON.stringify(v.to || v.recipients) : '');
    } else {
      console.error(`[notify:${tag}:${lab}]`, r.reason && r.reason.message ? r.reason.message : r.reason);
    }
  });
}

function sexeLabel(v) {
  if (v === 'F') return 'Femme';
  if (v === 'M') return 'Homme';
  return v || '—';
}

function buildInscriptionMessage(payload) {
  const lines = [
    '📝 Nouvelle demande d’INSCRIPTION (FigsApp-Côte d’Ivoire)',
    payload.inscription_id ? `Réf. dossier (admin): n°${payload.inscription_id}` : null,
    `Nom: ${payload.prenom || ''} ${payload.nom || ''}`.trim(),
    `Date de naissance: ${payload.date_naissance || '-'}`,
    `Sexe: ${sexeLabel(payload.sexe)}`,
    `Email du candidat: ${payload.email || '-'}`,
    `Téléphone du candidat: ${payload.telephone || '-'}`,
    `Ville (saisie): ${payload.ville || '-'}`,
    `Niveau d’étude visé: ${payload.niveau_etude || '-'}`,
    `Série du bac: ${payload.serie_bac || '-'}`,
    `Année du bac: ${payload.annee_bac || '-'}`,
    `Filière: ${payload.filiere_nom || payload.filiere_autre || '-'}`,
    `Université: ${payload.universite_nom || '-'}`,
    `Type d’établissement: ${payload.type_universite === 'publique' ? 'Publique' : payload.type_universite === 'privee' ? 'Privée' : payload.type_universite || '-'}`,
    `Bureau d’origine: ${payload.pays_bureau === 'BF' ? 'Burkina Faso' : 'Côte d’Ivoire (Abidjan)'}`,
    `Reçu le: ${new Date().toLocaleString('fr-FR')}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function buildInscriptionEmailBodyForTeam(payload) {
  const banner =
    '[FigsApp — notification interne]\n' +
    'Vous recevez ce message en tant qu’équipe FIGS : données du formulaire « Postuler / inscription ».\n' +
    'Le candidat ne reçoit pas cet e-mail automatiquement (réponse : « Répondre » vers l’e-mail du candidat ci-dessous).\n' +
    'Les mêmes données sont enregistrées dans l’admin : Inscriptions.\n\n';
  return `${banner}${buildInscriptionMessage(payload)}`;
}

async function sendInscriptionEmail(payload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  let teamRecipients = getTeamEmailRecipients({});
  const candidateEmail = (payload.email || '').trim().toLowerCase();
  teamRecipients = teamRecipients.filter((addr) => addr && addr.toLowerCase() !== candidateEmail);

  if (!host || !user || !pass) return { skipped: true, reason: 'smtp_not_configured' };
  if (!teamRecipients.length) return { skipped: true, reason: 'smtp_no_team_recipients' };

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const from = process.env.NOTIFY_EMAIL_FROM || user;
  const subject = `[FigsApp-Côte d'Ivoire] Nouvelle inscription — ${payload.prenom || ''} ${payload.nom || ''}`.trim();
  const text = buildInscriptionEmailBodyForTeam(payload);
  const replyTo = payload.email && String(payload.email).includes('@') ? payload.email : undefined;

  for (const to of teamRecipients) {
    await transporter.sendMail({
      from,
      to,
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
    });
  }
  return { sent: true, to: teamRecipients };
}

async function whatsappCloudApiSendText(toDigits, textBody) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error('whatsapp_not_configured');
  if (!toDigits) throw new Error('whatsapp_missing_recipient');

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: toDigits,
    type: 'text',
    text: { body: textBody },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp API error (${toDigits}): ${res.status} ${errText}`);
  }
  return { sent: true, to: toDigits };
}

async function sendInscriptionWhatsapp(payload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { skipped: true, reason: 'whatsapp_not_configured' };

  const textBody = buildInscriptionMessage(payload);
  const recipients = getTeamWhatsappRecipients({});
  if (!recipients.length) return { skipped: true, reason: 'whatsapp_no_recipients' };

  const results = await Promise.allSettled(recipients.map((to) => whatsappCloudApiSendText(to, textBody)));
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === results.length) throw failed[0].reason;
  return { sent: true, recipients, results };
}

async function notifyNewInscription(payload) {
  const results = await Promise.allSettled([sendInscriptionEmail(payload), sendInscriptionWhatsapp(payload)]);
  logSettled('inscription', results, ['email', 'whatsapp']);
  return { emailResult: results[0], whatsappResult: results[1] };
}

const TYPE_RDV_LABELS = {
  orientation: 'Orientation',
  inscription: 'Inscription / dossier',
  suivi: 'Suivi de candidature',
  renseignements: 'Renseignements généraux',
  autre: 'Autre',
};

const CRENEAU_LABELS = {
  matin: 'Matin (9h–12h)',
  apres_midi: 'Après-midi (14h–17h)',
  flexible: 'Flexible (à préciser par téléphone)',
};

function buildRendezVousMessage(payload) {
  const bureau = payload.pays_bureau === 'BF' ? 'Burkina Faso' : 'Côte d’Ivoire (Abidjan)';
  const type = TYPE_RDV_LABELS[payload.type_rdv] || payload.type_rdv;
  const creneau = CRENEAU_LABELS[payload.creneau] || payload.creneau;
  const lines = [
    "📅 Nouvelle demande de RENDEZ-VOUS (FigsApp-Côte d'Ivoire)",
    `Nom: ${payload.prenom || ''} ${payload.nom || ''}`.trim(),
    `Email du candidat: ${payload.email || '-'}`,
    `Téléphone du candidat: ${payload.telephone || '-'}`,
    `Bureau: ${bureau}`,
    `Type: ${type}`,
    `Date souhaitée: ${payload.date_souhaitee || '-'}`,
    `Créneau: ${creneau}`,
    payload.message ? `Message / précisions: ${payload.message}` : null,
    `Reçu le: ${new Date().toLocaleString('fr-FR')}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function buildRendezVousEmailBodyForTeam(payload) {
  const banner =
    '[FigsApp — notification interne]\n' +
    'Vous recevez ce message en tant qu’équipe FIGS : données du formulaire de rendez-vous.\n' +
    'Le candidat ne reçoit pas cet e-mail automatiquement (réponse : « Répondre »).\n' +
    'Données aussi visibles dans l’admin : Rendez-vous.\n\n';
  return `${banner}${buildRendezVousMessage(payload)}`;
}

async function sendRendezVousEmail(payload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  let teamRecipients = getTeamEmailRecipients({ preferRdvEmailOverride: true });
  const candidateEmail = (payload.email || '').trim().toLowerCase();
  teamRecipients = teamRecipients.filter((addr) => addr && addr.toLowerCase() !== candidateEmail);

  if (!host || !user || !pass) return { skipped: true, reason: 'smtp_not_configured' };
  if (!teamRecipients.length) return { skipped: true, reason: 'smtp_no_team_recipients' };

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const from = process.env.NOTIFY_EMAIL_FROM || user;
  const subject = `[FigsApp-Côte d'Ivoire] Nouveau RDV — ${payload.prenom || ''} ${payload.nom || ''}`.trim();
  const text = buildRendezVousEmailBodyForTeam(payload);
  const replyTo = payload.email && String(payload.email).includes('@') ? payload.email : undefined;

  for (const to of teamRecipients) {
    await transporter.sendMail({
      from,
      to,
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
    });
  }
  return { sent: true, to: teamRecipients };
}

async function sendRendezVousWhatsapp(payload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { skipped: true, reason: 'whatsapp_not_configured' };

  const textBody = buildRendezVousMessage(payload);
  const recipients = getTeamWhatsappRecipients({ preferRdvWaOverride: true });
  if (!recipients.length) return { skipped: true, reason: 'whatsapp_no_recipients' };

  const results = await Promise.allSettled(recipients.map((to) => whatsappCloudApiSendText(to, textBody)));
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === results.length) throw failed[0].reason;
  return { sent: true, recipients, results };
}

async function notifyNewRendezVous(payload) {
  const results = await Promise.allSettled([sendRendezVousEmail(payload), sendRendezVousWhatsapp(payload)]);
  logSettled('rdv', results, ['email', 'whatsapp']);
  return { emailResult: results[0], whatsappResult: results[1] };
}

function buildDemandeOrientationMessage(payload) {
  const bureau = payload.pays_bureau === 'BF' ? 'Burkina Faso' : 'Côte d’Ivoire (Abidjan)';
  const orientation = payload.besoin_orientation ? 'Oui' : 'Non';
  const lines = [
    '🎯 Nouvelle demande ORIENTATION / FILIÈRE (FigsApp-Côte d’Ivoire)',
    `Nom: ${payload.prenom || ''} ${payload.nom || ''}`.trim(),
    `Email du candidat: ${payload.email || '-'}`,
    `Téléphone du candidat: ${payload.telephone || '-'}`,
    `Bureau: ${bureau}`,
    `Domaine (grande filière): ${payload.grande_filiere || '-'}`,
    `Spécialité demandée: ${payload.specialite || '-'}`,
    `Besoin d’orientation: ${orientation}`,
    payload.message ? `Message: ${payload.message}` : null,
    `Reçu le: ${new Date().toLocaleString('fr-FR')}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function buildDemandeOrientationEmailBodyForTeam(payload) {
  const banner =
    '[FigsApp — notification interne]\n' +
    'Données du formulaire demande d’orientation / filière. Le candidat ne reçoit pas cet e-mail automatiquement.\n' +
    'Voir aussi l’admin : Demandes d’orientation.\n\n';
  return `${banner}${buildDemandeOrientationMessage(payload)}`;
}

async function sendDemandeOrientationEmail(payload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  let teamRecipients = getTeamEmailRecipients({});
  const candidateEmail = (payload.email || '').trim().toLowerCase();
  teamRecipients = teamRecipients.filter((addr) => addr && addr.toLowerCase() !== candidateEmail);

  if (!host || !user || !pass) return { skipped: true, reason: 'smtp_not_configured' };
  if (!teamRecipients.length) return { skipped: true, reason: 'smtp_no_team_recipients' };

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const from = process.env.NOTIFY_EMAIL_FROM || user;
  const subject = `[FigsApp-Côte d'Ivoire] Demande filière / orientation — ${payload.prenom || ''} ${payload.nom || ''}`.trim();
  const text = buildDemandeOrientationEmailBodyForTeam(payload);
  const replyTo = payload.email && String(payload.email).includes('@') ? payload.email : undefined;

  for (const to of teamRecipients) {
    await transporter.sendMail({
      from,
      to,
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
    });
  }
  return { sent: true, to: teamRecipients };
}

async function sendDemandeOrientationWhatsapp(payload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { skipped: true, reason: 'whatsapp_not_configured' };

  const textBody = buildDemandeOrientationMessage(payload);
  const recipients = getTeamWhatsappRecipients({});
  if (!recipients.length) return { skipped: true, reason: 'whatsapp_no_recipients' };

  const results = await Promise.allSettled(recipients.map((to) => whatsappCloudApiSendText(to, textBody)));
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === results.length) throw failed[0].reason;
  return { sent: true, recipients, results };
}

async function notifyNewDemandeOrientation(payload) {
  const results = await Promise.allSettled([sendDemandeOrientationEmail(payload), sendDemandeOrientationWhatsapp(payload)]);
  logSettled('orientation', results, ['email', 'whatsapp']);
  return { emailResult: results[0], whatsappResult: results[1] };
}

module.exports = { notifyNewInscription, notifyNewRendezVous, notifyNewDemandeOrientation };
