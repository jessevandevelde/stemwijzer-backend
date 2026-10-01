import { parseArgs } from 'node:util';
import { hashPassword } from '../auth/hash-password';
import { validateLoginCredentials } from '../auth/validation';
import type { LoginCredentials } from '../types/auth.interface';
import { openDatabase } from './index';

const maximumNameLength = 100;
const usage = 'Gebruik: npm run db:add-admin -- --name "Naam" --email naam@example.com --password Wachtwoord1!';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
  },
});

const name = values.name?.trim() ?? '';

if (name.length === 0 || Array.from(name).length > maximumNameLength) {
  console.error('name is verplicht en mag maximaal 100 tekens bevatten.');
  console.error(usage);
  process.exit(1);
}

function readCredentials(): LoginCredentials {
  try {
    return validateLoginCredentials({ email: values.email, password: values.password });
  }
  catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    console.error(usage);

    return process.exit(1);
  }
}

const credentials = readCredentials();

const database = openDatabase();

try {
  const result = database.prepare('INSERT INTO superadmins (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, credentials.email, hashPassword(credentials.password));

  process.stdout.write(`Superadmin ${credentials.email} aangemaakt met id ${String(result.lastInsertRowid)}.\n`);
}
catch (error: unknown) {
  if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
    console.error(`Er bestaat al een superadmin met e-mailadres ${credentials.email}.`);
  }
  else {
    console.error('Superadmin aanmaken mislukt:', error);
  }

  process.exitCode = 1;
}
finally {
  database.close();
}
