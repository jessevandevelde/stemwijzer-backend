import type { DatabaseSync } from 'node:sqlite';
import type { AuthenticatedSuperadmin, AuthenticatedUser } from '../types/auth.interface';
import { verifyPassword } from './hash-password';

export function authenticateSuperadmin(database: DatabaseSync, email: string, password: string): AuthenticatedSuperadmin | null {
  const row = database.prepare('SELECT id, name, email, password_hash AS passwordHash FROM superadmins WHERE email = ?').get(email);

  if (!row || typeof row['id'] !== 'number' || typeof row['name'] !== 'string' || typeof row['email'] !== 'string' || typeof row['passwordHash'] !== 'string') {
    return null;
  }

  if (!verifyPassword(password, row['passwordHash'])) {
    return null;
  }

  return { id: row['id'], name: row['name'], email: row['email'] };
}

export function authenticatePartyAdmin(database: DatabaseSync, email: string, password: string): AuthenticatedUser | null {
  const row = database.prepare(`
    SELECT party_admins.id, party_admins.name, party_admins.email, party_admins.password_hash AS passwordHash,
           parties.id AS partyId, parties.name AS partyName
    FROM party_admins
    JOIN parties ON parties.id = party_admins.party_id
    WHERE lower(party_admins.email) = lower(?)
  `).get(email);

  if (!row || typeof row['id'] !== 'number' || typeof row['name'] !== 'string' || typeof row['email'] !== 'string'
    || typeof row['passwordHash'] !== 'string' || typeof row['partyId'] !== 'number' || typeof row['partyName'] !== 'string') {
    return null;
  }

  if (!verifyPassword(password, row['passwordHash'])) {
    return null;
  }

  return { id: row['id'], name: row['name'], email: row['email'], role: 'party-admin', partyId: row['partyId'], partyName: row['partyName'] };
}

// Superadmins gaan voor: een e-mailadres dat in beide tabellen voorkomt logt als superadmin in.
export function authenticateUser(database: DatabaseSync, email: string, password: string): AuthenticatedUser | null {
  const superadmin = authenticateSuperadmin(database, email, password);

  if (superadmin) {
    return { ...superadmin, role: 'superadmin', partyId: null, partyName: null };
  }

  return authenticatePartyAdmin(database, email, password);
}
