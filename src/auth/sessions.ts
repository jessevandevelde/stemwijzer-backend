import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { AuthenticatedUser, UserRole } from '../types/auth.interface';

const tokenBytes = 32;
const sessionLifetime = '+7 days';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(database: DatabaseSync, role: UserRole, userId: number): string {
  const token = randomBytes(tokenBytes).toString('hex');

  database.prepare('DELETE FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();
  database.prepare('INSERT INTO auth_sessions (token_hash, role, user_id, expires_at) VALUES (?, ?, ?, datetime(\'now\', ?))')
    .run(hashToken(token), role, userId, sessionLifetime);

  return token;
}

// Zoekt de gebruiker opnieuw op, zodat een verwijderd account of een verwijderde partij de sessie direct ongeldig maakt.
export function findSessionUser(database: DatabaseSync, token: string): AuthenticatedUser | null {
  const session = database.prepare('SELECT role, user_id AS userId FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP')
    .get(hashToken(token));

  if (!session || typeof session['userId'] !== 'number') {
    return null;
  }

  if (session['role'] === 'superadmin') {
    const row = database.prepare('SELECT id, name, email FROM superadmins WHERE id = ?').get(session['userId']);

    if (!row || typeof row['id'] !== 'number' || typeof row['name'] !== 'string' || typeof row['email'] !== 'string') {
      return null;
    }

    return { id: row['id'], name: row['name'], email: row['email'], role: 'superadmin', partyId: null, partyName: null };
  }

  const row = database.prepare(`
    SELECT party_admins.id, party_admins.name, party_admins.email, parties.id AS partyId, parties.name AS partyName
    FROM party_admins
    JOIN parties ON parties.id = party_admins.party_id
    WHERE party_admins.id = ?
  `).get(session['userId']);

  if (!row || typeof row['id'] !== 'number' || typeof row['name'] !== 'string' || typeof row['email'] !== 'string'
    || typeof row['partyId'] !== 'number' || typeof row['partyName'] !== 'string') {
    return null;
  }

  return { id: row['id'], name: row['name'], email: row['email'], role: 'party-admin', partyId: row['partyId'], partyName: row['partyName'] };
}
