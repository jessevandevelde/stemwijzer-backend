import { parseArgs } from 'node:util';
import { hashPassword } from '../auth/hash-password';
import { validateLoginCredentials } from '../auth/validation';
import { parseId } from '../http/parse-id';
import type { LoginCredentials } from '../types/auth.interface';
import { openDatabase } from './index';

const maximumNameLength = 100;
const usage = 'Gebruik: npm run db:add-party-admin -- --party 1 --name "Naam" --email naam@example.com --password Wachtwoord1!';

const { values } = parseArgs({
  options: {
    party: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
  },
});

const partyId = parseId(values.party ?? '');
const name = values.name?.trim() ?? '';

if (partyId === undefined) {
  console.error('party is verplicht en moet een positief geheel getal zijn.');
  console.error(usage);
  process.exit(1);
}

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
  const party = database.prepare('SELECT name FROM parties WHERE id = ?').get(partyId);

  if (!party) {
    console.error(`Er bestaat geen partij met id ${String(partyId)}.`);
    process.exitCode = 1;
  }
  else {
    const result = database.prepare('INSERT INTO party_admins (party_id, name, email, password_hash) VALUES (?, ?, ?, ?)')
      .run(partyId, name, credentials.email, hashPassword(credentials.password));

    process.stdout.write(`Partijbeheerder ${credentials.email} voor ${String(party['name'])} aangemaakt met id ${String(result.lastInsertRowid)}.\n`);
  }
}
catch (error: unknown) {
  if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
    console.error(`Er bestaat al een partijbeheerder met e-mailadres ${credentials.email}.`);
  }
  else {
    console.error('Partijbeheerder aanmaken mislukt:', error);
  }

  process.exitCode = 1;
}
finally {
  database.close();
}
