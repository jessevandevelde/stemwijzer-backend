import { StatusCodes } from 'http-status-codes';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { once } from 'node:events';
import { it } from 'node:test';
import { openDatabase } from '../database';
import { createApp } from '../server';
import { hashPassword } from './hash-password';

function isLoginResponse(value: unknown): value is { token: string, user: unknown } {
  return typeof value === 'object' && value !== null && 'token' in value && typeof value.token === 'string' && 'user' in value;
}

void it('logs superadmins in over HTTP', async (context) => {
  const database = openDatabase(':memory:');
  const server = createApp(database);

  try {
    database.prepare('INSERT INTO superadmins (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
      .run(1, 'Beheerder', 'beheerder@example.test', hashPassword('Test1234!'));
    database.exec(`
      INSERT INTO superadmins (name, email, password_hash)
      VALUES ('Import', 'import@example.test', '!disabled:statement-import')
    `);

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    async function login(email: string, password: string): Promise<Response> {
      return fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: [['content-type', 'application/json']],
        body: JSON.stringify({ email, password }),
      });
    }

    await context.test('returns a token for correct credentials', async () => {
      const response = await login('beheerder@example.test', 'Test1234!');

      strictEqual(response.status, StatusCodes.OK);
      strictEqual(response.headers.get('content-type'), 'application/json; charset=utf-8');

      const body: unknown = await response.json();

      strictEqual(isLoginResponse(body), true);

      if (isLoginResponse(body)) {
        strictEqual(body.token.length > 0, true);
        deepStrictEqual(body.user, { id: 1, name: 'Beheerder', email: 'beheerder@example.test' });
      }
    });

    await context.test('rejects a wrong password', async () => {
      const response = await login('beheerder@example.test', 'wrong-password');

      strictEqual(response.status, StatusCodes.UNAUTHORIZED);
      deepStrictEqual(await response.json(), { error: 'Onjuiste combinatie van e-mailadres en wachtwoord.' });
    });

    await context.test('rejects an unknown email address', async () => {
      const response = await login('unknown@example.test', 'Test1234!');

      strictEqual(response.status, StatusCodes.UNAUTHORIZED);
    });

    await context.test('rejects the disabled technical import account', async () => {
      const response = await login('import@example.test', '!disabled:statement-import');

      strictEqual(response.status, StatusCodes.UNAUTHORIZED);
    });

    await context.test('rejects missing fields', async () => {
      const response = await login('beheerder@example.test', '');

      strictEqual(response.status, StatusCodes.BAD_REQUEST);
    });

    await context.test('only allows POST requests on /auth/login', async () => {
      const response = await fetch(`${baseUrl}/auth/login`, { method: 'GET' });

      strictEqual(response.status, StatusCodes.METHOD_NOT_ALLOWED);
      strictEqual(response.headers.get('allow'), 'POST');
      await response.text();
    });
  }
  finally {
    server.close();
    database.close();
  }
});
