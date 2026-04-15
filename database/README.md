# Base de données FigsApp-Côte d'Ivoire

## Ordre d'exécution

1. **Démarrer MySQL** (service Windows ou `mysql` en ligne de commande).

2. **Créer la base et les tables** (une seule fois) :
   ```bash
   mysql -u root -p < database/schema.sql
   ```

3. **Créer l'admin** (email: admin@shoolapp.com, mot de passe: admin123) :
   ```bash
   node database/seed-admin.js
   ```

4. **Ajouter les 10 filières + 10 universités de démo** (5 publiques, 5 privées) :
   ```bash
   node database/seed-universites.js
   ```

Ensuite, redémarrez le backend si besoin et testez le parcours sur http://localhost:3001.
