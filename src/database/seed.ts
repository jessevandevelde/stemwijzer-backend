import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword } from '../auth/hash-password';
import { openDatabase } from './index';

const projectRoot = resolve(__dirname, '../..');
const seedFiles = ['seed-statements.sql', 'seed-parties.sql', 'seed-party-answers.sql'];

const testAdminEmail = 'beheerder@stemwijzer.test';
const testAdminPassword = 'Test1234!';
const maximumNameLength = 100;

const database = openDatabase();

for (const fileName of seedFiles) {
  database.exec(readFileSync(resolve(projectRoot, 'database', fileName), 'utf8'));
}

database.prepare(`
  INSERT INTO superadmins (name, email, password_hash)
  SELECT 'Testbeheerder', ?, ?
  WHERE NOT EXISTS (SELECT 1 FROM superadmins WHERE email = ?)
`).run(testAdminEmail, hashPassword(testAdminPassword), testAdminEmail);

// Eén testpartijbeheerder per partij: partij1@stemwijzer.test voor partij 1, enzovoort.
const insertPartyAdmin = database.prepare(`
  INSERT INTO party_admins (party_id, name, email, password_hash)
  SELECT ?, ?, ?, ?
  WHERE NOT EXISTS (SELECT 1 FROM party_admins WHERE email = ?)
`);

for (const party of database.prepare('SELECT id, name FROM parties ORDER BY id').all()) {
  const email = `partij${String(party['id'])}@stemwijzer.test`;

  insertPartyAdmin.run(party['id'], `Beheerder ${String(party['name'])}`.slice(0, maximumNameLength), email, hashPassword(testAdminPassword), email);
}

database.close();
