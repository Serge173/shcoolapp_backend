# Incident Runbook (ShoolApp)

## 1. Détection
- Vérifier erreurs 5xx et pics de `401/429`.
- Vérifier `backend/logs/audit.log` (login, CRUD admin, uploads).

## 2. Contention immédiate
- Bloquer trafic suspect via reverse proxy (IP rate limit / denylist).
- Si fuite de session suspectée, redéployer avec nouveau `JWT_SECRET`.
- Désactiver temporairement upload si abus.

## 3. Analyse
- Identifier endpoint cible, heure, IP, volume.
- Corréler avec les actions admin (create/update/delete/upload).

## 4. Restauration
- Si corruption data, restaurer la dernière sauvegarde saine.
- Rejouer les écritures manquantes validées.

## 5. Communication
- Notifier l’équipe produit + ops.
- Préparer un résumé incident (cause, impact, remédiation).

## 6. Post-mortem
- Ajouter règle de détection manquante.
- Ajouter test de non-régression sécurité.
- Mettre à jour checklist go-live.

