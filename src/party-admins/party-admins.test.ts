import { StatusCodes } from 'http-status-codes';
import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { once } from 'node:events';
import { it } from 'node:test';
import { hashPassword } from '../auth/hash-password';
import { createSession } from '../auth/sessions';
import { openDatabase } from '../database';
import { createApp } from '../server';

const nonExistentId = 999;

function isAccount(value: unknown): value is { id: number, partyId: number, name: string, email: string } {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'number' && 'email' in value;
}

void it('lets superadmins manage the login accounts of parties', async (context) => {
  const database = openDatabase(':memory:');
  const server = createApp(database);

  try {
    database.exec(`
      INSERT INTO parties (id, name) VALUES (1, 'Partij A'), (2, 'Partij B');
    `);
    database.prepare('INSERT INTO superadmins (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
      .run(1, 'Super', 'super@example.test', hashPassword('Test1234!'));

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;
    const superadminToken = createSession(database, 'superadmin', 1);

    async function request(method: string, path: string, token: string | null, body?: unknown): Promise<Response> {
      const headers: [string, string][] = [['content-type', 'application/json']];

      if (token !== null) {
        headers.push(['authorization', `Bearer ${token}`]);
      }

      return fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    }

    async function login(email: string, password: string): Promise<number> {
      const response = await request('POST', '/auth/login', null, { email, password });

      await response.text();

      return response.status;
    }

    let accountId = 0;

    await context.test('creates a login for a party without returning the password', async () => {
      const response = await request('POST', '/parties/1/admins', superadminToken, { name: ' Jan ', email: 'Jan@Example.test', password: 'Geheim123!' });
      const body: unknown = await response.json();

      strictEqual(response.status, StatusCodes.CREATED);
      ok(isAccount(body));
      accountId = body.id;
      deepStrictEqual({ partyId: body.partyId, name: body.name, email: body.email }, { partyId: 1, name: 'Jan', email: 'jan@example.test' });
      strictEqual('password' in body || 'passwordHash' in body, false);
      strictEqual(await login('jan@example.test', 'Geheim123!'), StatusCodes.OK);
      strictEqual(await login('JAN@example.test', 'Geheim123!'), StatusCodes.OK);
    });

    await context.test('lists the logins of one party', async () => {
      const response = await request('GET', '/parties/1/admins', superadminToken);
      const body: unknown = await response.json();

      strictEqual(response.status, StatusCodes.OK);
      ok(Array.isArray(body) && body.length === 1 && isAccount(body[0]) && body[0].email === 'jan@example.test');

      const other = await request('GET', '/parties/2/admins', superadminToken);

      deepStrictEqual(await other.json(), []);
    });

    await context.test('changes name, email and password and logs the party admin out', async () => {
      const partyAdminToken = createSession(database, 'party-admin', accountId);
      const response = await request('PATCH', `/party-admins/${String(accountId)}`, superadminToken, { email: 'jan.nieuw@example.test', password: 'Nieuw1234!' });
      const body: unknown = await response.json();

      strictEqual(response.status, StatusCodes.OK);
      ok(isAccount(body) && body.email === 'jan.nieuw@example.test' && body.name === 'Jan');
      strictEqual(await login('jan@example.test', 'Geheim123!'), StatusCodes.UNAUTHORIZED);
      strictEqual(await login('jan.nieuw@example.test', 'Geheim123!'), StatusCodes.UNAUTHORIZED);
      strictEqual(await login('jan.nieuw@example.test', 'Nieuw1234!'), StatusCodes.OK);

      const oldSession = await request('GET', '/party-admin/statements', partyAdminToken);

      strictEqual(oldSession.status, StatusCodes.UNAUTHORIZED);
      await oldSession.text();
    });

    await context.test('rejects duplicate emails, invalid input and unknown ids', async () => {
      const cases: [Promise<Response>, number][] = [
        [request('POST', '/parties/2/admins', superadminToken, { name: 'Dubbel', email: 'jan.nieuw@example.test', password: 'Test1234!' }), StatusCodes.CONFLICT],
        [request('POST', '/parties/2/admins', superadminToken, { name: 'Super', email: 'SUPER@example.test', password: 'Test1234!' }), StatusCodes.CONFLICT],
        [request('POST', '/parties/2/admins', superadminToken, { name: 'Kort', email: 'kort@example.test', password: 'kort' }), StatusCodes.BAD_REQUEST],
        [request('POST', '/parties/2/admins', superadminToken, { name: 'Geen email', email: 'geen-email', password: 'Test1234!' }), StatusCodes.BAD_REQUEST],
        [request('POST', '/parties/2/admins', superadminToken, { name: '', email: 'leeg@example.test', password: 'Test1234!' }), StatusCodes.BAD_REQUEST],
        [request('POST', '/parties/2/admins', superadminToken, { name: 'X', email: 'x@example.test', password: 'Test1234!', partyId: 1 }), StatusCodes.BAD_REQUEST],
        [request('POST', `/parties/${String(nonExistentId)}/admins`, superadminToken, { name: 'X', email: 'x@example.test', password: 'Test1234!' }), StatusCodes.NOT_FOUND],
        [request('PATCH', `/party-admins/${String(accountId)}`, superadminToken, {}), StatusCodes.BAD_REQUEST],
        [request('PATCH', `/party-admins/${String(nonExistentId)}`, superadminToken, { name: 'X' }), StatusCodes.NOT_FOUND],
        [request('DELETE', `/party-admins/${String(nonExistentId)}`, superadminToken), StatusCodes.NOT_FOUND],
        [request('GET', `/party-admins/${String(accountId)}`, superadminToken), StatusCodes.METHOD_NOT_ALLOWED],
        [request('GET', '/parties/abc/admins', superadminToken), StatusCodes.BAD_REQUEST],
      ];

      for (const [pending, status] of cases) {
        const response = await pending;

        strictEqual(response.status, status);
        await response.text();
      }
    });

    await context.test('only lets superadmins manage logins', async () => {
      const partyAdminToken = createSession(database, 'party-admin', accountId);

      const cases: [Promise<Response>, number][] = [
        [request('GET', '/parties/1/admins', null), StatusCodes.UNAUTHORIZED],
        [request('GET', '/parties/1/admins', partyAdminToken), StatusCodes.FORBIDDEN],
        [request('POST', '/parties/2/admins', partyAdminToken, { name: 'X', email: 'x@example.test', password: 'Test1234!' }), StatusCodes.FORBIDDEN],
        [request('PATCH', `/party-admins/${String(accountId)}`, partyAdminToken, { password: 'Overgenomen1!' }), StatusCodes.FORBIDDEN],
        [request('DELETE', `/party-admins/${String(accountId)}`, partyAdminToken), StatusCodes.FORBIDDEN],
      ];

      for (const [pending, status] of cases) {
        const response = await pending;

        strictEqual(response.status, status);
        await response.text();
      }
    });

    await context.test('deletes a login so it can no longer be used', async () => {
      const response = await request('DELETE', `/party-admins/${String(accountId)}`, superadminToken);

      strictEqual(response.status, StatusCodes.NO_CONTENT);
      await response.text();
      strictEqual(await login('jan.nieuw@example.test', 'Nieuw1234!'), StatusCodes.UNAUTHORIZED);
      strictEqual(database.prepare('SELECT COUNT(*) AS count FROM auth_sessions WHERE role = \'party-admin\'').get()?.['count'], 0);
    });
  }
  finally {
    server.close();
    database.close();
  }
});
