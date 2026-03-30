require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shoolapp',
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
