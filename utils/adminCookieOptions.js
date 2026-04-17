/**
 * Options cookie session admin — alignées sur le déploiement (frontend Vercel + API Render).
 * En prod : SameSite=None + Secure pour que le navigateur envoie le JWT sur l’API en cross-origin.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-attributes
 */

const isProd = process.env.NODE_ENV === 'production';

/** Durée session (alignée sur JWT_EXPIRES_IN par défaut 12h). */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function adminSessionCookieBase() {
  if (!isProd) {
    return { httpOnly: true, secure: false, sameSite: 'lax', path: '/' };
  }
  const mode = (process.env.ADMIN_COOKIE_SAMESITE || 'none').toLowerCase();
  const sameSite = mode === 'lax' ? 'lax' : 'none';
  return { httpOnly: true, secure: true, sameSite, path: '/' };
}

module.exports = {
  adminSessionCookieBase,
  MAX_AGE_MS,
};
