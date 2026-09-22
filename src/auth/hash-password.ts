import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const saltBytes = 16;
const keyBytes = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(saltBytes);
  const hash = scryptSync(password, salt, keyBytes);

  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');

  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');

  if (expected.length !== keyBytes) {
    return false;
  }

  const actual = scryptSync(password, salt, keyBytes);

  return timingSafeEqual(actual, expected);
}
