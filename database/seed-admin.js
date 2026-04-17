require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { getMysqlClientOptions } = require('../utils/mysqlEnvOptions');

async function seed() {
  const conn = await mysql.createConnection({
    ...getMysqlClientOptions(),
  });
  const hash = await bcrypt.hash('admin123', 10);
  await conn.execute(
    'INSERT INTO admins (email, password, nom) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password = ?',
    ['admin@shoolapp.com', hash, 'Administrateur', hash]
  );
  console.log('Admin créé: admin@shoolapp.com / admin123');
  await conn.end();
}
seed().catch(console.error);
