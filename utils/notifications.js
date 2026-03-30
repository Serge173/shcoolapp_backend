const nodemailer = require('nodemailer');

function buildInscriptionMessage(payload) {
  const lines = [
    'Nouvelle demande d\'inscription',
    `Nom: ${payload.prenom || ''} ${payload.nom || ''}`.trim(),
    `Email: ${payload.email || '-'}`,
    `Téléphone: ${payload.telephone || '-'}`,
    `Ville choisie: ${payload.ville || '-'}`,
    `Niveau: ${payload.niveau_etude || '-'}`,
    `Filière: ${payload.filiere_nom || payload.filiere_autre || '-'}`,
    `Université: ${payload.universite_nom || '-'}`,
    `Type université: ${payload.type_universite || '-'}`,
    `Date: ${new Date().toLocaleString('fr-FR')}`,
  ];
  return lines.join('\n');
}

async function sendInscriptionEmail(payload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.NOTIFY_EMAIL_TO;

  if (!host || !user || !pass || !to) return { skipped: true, reason: 'smtp_not_configured' };

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const from = process.env.NOTIFY_EMAIL_FROM || user;
  const subject = `[ShoolApp] Nouvelle inscription - ${payload.prenom || ''} ${payload.nom || ''}`.trim();
  const text = buildInscriptionMessage(payload);

  await transporter.sendMail({ from, to, subject, text });
  return { sent: true };
}

async function sendInscriptionWhatsapp(payload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_TO;
  if (!token || !phoneNumberId || !to) return { skipped: true, reason: 'whatsapp_not_configured' };

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: buildInscriptionMessage(payload) },
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
    throw new Error(`WhatsApp API error: ${res.status} ${errText}`);
  }
  return { sent: true };
}

async function notifyNewInscription(payload) {
  const [emailResult, whatsappResult] = await Promise.allSettled([
    sendInscriptionEmail(payload),
    sendInscriptionWhatsapp(payload),
  ]);
  return { emailResult, whatsappResult };
}

module.exports = { notifyNewInscription };

