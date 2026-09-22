import type { DatabaseSync } from 'node:sqlite';
import type { AuthenticatedSuperadmin } from '../types/auth.interface';
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
