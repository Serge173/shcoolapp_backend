const path = require('path');

/**
 * Logo : URL absolue, fichier statique frontend (public/images/...), ou upload admin (uploads/logos).
 */
function resolveLogoUrl(logo) {
  if (!logo) return null;
  const s = String(logo).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^images\//i.test(s)) return '/' + s.replace(/^\/+/, '');
  if (/^\/images\//i.test(s)) return s;
  return '/uploads/logos/' + path.basename(s);
}

module.exports = { resolveLogoUrl };
