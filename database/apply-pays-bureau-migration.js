/**

 * Exécute la migration pays_bureau sur MySQL (une fois, manuellement).

 * Usage : node database/apply-pays-bureau-migration.js

 */

require('dotenv').config();

const { runPaysBureauMigrationMysql } = require('./migratePaysBureauMysql');



async function main() {

  if (!process.env.DB_HOST) {

    console.error('DB_HOST manquant — cette migration est pour MySQL (Render / prod).');

    process.exit(1);

  }

  const r = await runPaysBureauMigrationMysql();

  if (r.skipped) {

    console.error(r.reason);

    process.exit(1);

  }

  console.log('Migration pays_bureau terminée.');

}



main().catch((e) => {

  console.error(e);

  process.exit(1);

});


