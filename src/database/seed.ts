import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword } from '../auth/hash-password';
import { openDatabase } from './index';

const projectRoot = resolve(__dirname, '../..');
const seedFiles = ['seed-statements.sql', 'seed-parties.sql', 'seed-party-answers.sql'];

const testAdminEmail = 'beheerder@stemwijzer.test';
const testAdminPassword = 'Test1234!';

const database = openDatabase();

for (const fileName of seedFiles) {
  database.exec(readFileSync(resolve(projectRoot, 'database', fileName), 'utf8'));
}

database.prepare(`
  INSERT INTO superadmins (name, email, password_hash)
  SELECT 'Testbeheerder', ?, ?
  WHERE NOT EXISTS (SELECT 1 FROM superadmins WHERE email = ?)
`).run(testAdminEmail, hashPassword(testAdminPassword), testAdminEmail);

database.close();
