# Security Checklist (Go-Live)

## Secrets & Config
- [ ] `JWT_SECRET` fort (>= 32 chars, aléatoire) en production
- [ ] `CORS_ORIGIN` limité aux domaines front officiels
- [ ] `NODE_ENV=production` sur serveur
- [ ] Rotation périodique des secrets (JWT/SMTP/WhatsApp)

## API & Auth
- [ ] Headers sécurité actifs (Helmet + HSTS en prod)
- [ ] Auth admin par cookie `HttpOnly`/`Secure`/`SameSite`
- [ ] Rate limit login et lock temporaire sur échecs
- [ ] Validation stricte des entrées sensibles

## Uploads
- [ ] Types MIME + extension validés
- [ ] Tailles max appliquées par endpoint
- [ ] Fichiers servis avec `nosniff`
- [ ] Dossier upload sauvegardé régulièrement

## Database
- [ ] Utilisateur DB à privilèges minimaux
- [ ] Sauvegarde quotidienne (retenue >= 7 jours)
- [ ] Test de restauration réalisé
- [ ] Migration `2026-03-30-security-and-inscription.sql` appliquée

## Monitoring & Incident
- [ ] Surveillance des logs `backend/logs/audit.log`
- [ ] Alertes sur pics d’échecs login
- [ ] Plan rollback documenté
- [ ] Test smoke post-déploiement validé

