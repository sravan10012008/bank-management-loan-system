const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'bank_management.sqlite');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const username = process.env.DEMO_USERNAME || 'admin';
const password = process.env.DEMO_PASSWORD || 'Bank@123';
const existing = db.prepare('SELECT user_id FROM USERS WHERE username = ?').get(username);

if (!existing) {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO USERS (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`Created demo user: ${username}`);
} else {
  console.log(`Demo user already exists: ${username}`);
}
db.close();
console.log(`Database initialized at: ${dbPath}`);
