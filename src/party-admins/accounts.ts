import type { DatabaseSync, SQLInputValue, SQLOutputValue } from 'node:sqlite';
import { hashPassword } from '../auth/hash-password';
import type { CreatePartyAdminInput, PartyAdminAccount, UpdatePartyAdminInput } from '../types/party-admin.interface';

const selectAccount = `
  SELECT id, party_id AS partyId, name, email, created_at AS createdAt, updated_at AS updatedAt
  FROM party_admins
`;

function rowToAccount(row: Record<string, SQLOutputValue>): PartyAdminAccount {
  const { id, partyId, name, email, createdAt, updatedAt } = row;

  if (typeof id !== 'number' || typeof partyId !== 'number' || typeof name !== 'string' || typeof email !== 'string'
    || typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    throw new Error('De database heeft een ongeldige partijbeheerder teruggegeven.');
  }

  return { id, partyId, name, email, createdAt, updatedAt };
}

export function listPartyAdmins(database: DatabaseSync, partyId: number): PartyAdminAccount[] {
  return database.prepare(`${selectAccount} WHERE party_id = ? ORDER BY id`).all(partyId).map(rowToAccount);
}

export function getPartyAdmin(database: DatabaseSync, id: number): PartyAdminAccount | undefined {
  const row = database.prepare(`${selectAccount} WHERE id = ?`).get(id);

  return row ? rowToAccount(row) : undefined;
}

// Een e-mailadres moet over beide accounttabellen uniek zijn, anders kan een van de twee nooit inloggen.
export function isEmailTaken(database: DatabaseSync, email: string, exceptPartyAdminId: number | null = null): boolean {
  const superadmin = database.prepare('SELECT 1 FROM superadmins WHERE lower(email) = ?').get(email);
  const partyAdmin = database.prepare('SELECT 1 FROM party_admins WHERE lower(email) = ? AND id IS NOT ?').get(email, exceptPartyAdminId);

  return superadmin !== undefined || partyAdmin !== undefined;
}

export function createPartyAdmin(database: DatabaseSync, partyId: number, input: CreatePartyAdminInput): number {
  const result = database.prepare('INSERT INTO party_admins (party_id, name, email, password_hash) VALUES (?, ?, ?, ?)')
    .run(partyId, input.name, input.email, hashPassword(input.password));

  return Number(result.lastInsertRowid);
}

function endSessions(database: DatabaseSync, id: number): void {
  database.prepare('DELETE FROM auth_sessions WHERE role = \'party-admin\' AND user_id = ?').run(id);
}

// Een nieuw wachtwoord logt de partijbeheerder overal uit.
export function updatePartyAdmin(database: DatabaseSync, id: number, input: UpdatePartyAdminInput): void {
  const assignments: string[] = [];
  const values: SQLInputValue[] = [];

  if (input.name !== undefined) {
    assignments.push('name = ?');
    values.push(input.name);
  }

  if (input.email !== undefined) {
    assignments.push('email = ?');
    values.push(input.email);
  }

  if (input.password !== undefined) {
    assignments.push('password_hash = ?');
    values.push(hashPassword(input.password));
  }

  database.prepare(`UPDATE party_admins SET ${assignments.join(', ')} WHERE id = ?`).run(...values, id);

  if (input.password !== undefined) {
    endSessions(database, id);
  }
}

export function deletePartyAdmin(database: DatabaseSync, id: number): boolean {
  const result = database.prepare('DELETE FROM party_admins WHERE id = ?').run(id);

  endSessions(database, id);

  return Number(result.changes) > 0;
}
