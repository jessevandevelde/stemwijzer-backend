import { StatusCodes } from 'http-status-codes';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { once } from 'node:events';
import { it } from 'node:test';
import { hashPassword } from '../auth/hash-password';
import { openDatabase } from '../database';
import { createApp } from '../server';

const inactiveStatementId = 2;
const nonExistentId = 999;
const partyCount = 2;
const superadminId = 2;
const tokenLength = 64;

function hasToken(value: unknown): value is { token: string, user: unknown } {
  return typeof value === 'object' && value !== null && 'token' in value && typeof value.token === 'string' && 'user' in value;
}

void it('lets party admins manage only the answers of their own party', async (context) => {
  const database = openDatabase(':memory:');
  const server = createApp(database);

  try {
    database.exec(`
      INSERT INTO superadmins (id, name, email, password_hash) VALUES (1, 'Admin', 'admin@example.test', '!disabled');
      INSERT INTO statements (id, text, created_by, is_active) VALUES (1, 'Stelling een', 1, 1), (2, 'Stelling twee', 1, 0), (3, 'Stelling drie', 1, 1);
      INSERT INTO parties (id, name) VALUES (1, 'Partij A'), (2, 'Partij B');
      INSERT INTO party_answers (party_id, statement_id, answer) VALUES (1, 1, 'oneens'), (2, 1, 'eens');
    `);
    database.prepare('INSERT INTO party_admins (id, party_id, name, email, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run(1, 1, 'Beheerder A', 'a@example.test', hashPassword('Test1234!'));
    database.prepare('INSERT INTO superadmins (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
      .run(superadminId, 'Super', 'super@example.test', hashPassword('Test1234!'));

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    async function login(email: string): Promise<{ token: string, user: unknown }> {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: [['content-type', 'application/json']],
        body: JSON.stringify({ email, password: 'Test1234!' }),
      });

      const body: unknown = await response.json();

      if (!hasToken(body)) {
        throw new Error('Expected a login response');
      }

      return body;
    }

    async function request(method: string, path: string, token: string | null, body?: unknown): Promise<Response> {
      const headers: [string, string][] = [['content-type', 'application/json']];

      if (token !== null) {
        headers.push(['authorization', `Bearer ${token}`]);
      }

      return fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    }

    const partyAdmin = await login('a@example.test');
    const superadmin = await login('super@example.test');

    await context.test('returns the role and party on login', () => {
      deepStrictEqual(partyAdmin.user, { id: 1, name: 'Beheerder A', email: 'a@example.test', role: 'party-admin', partyId: 1, partyName: 'Partij A' });
    });

    await context.test('lists the active statements with the answers of the own party', async () => {
      const response = await request('GET', '/party-admin/statements', partyAdmin.token);

      strictEqual(response.status, StatusCodes.OK);
      deepStrictEqual(await response.json(), {
        party: { id: 1, name: 'Partij A' },
        statements: [
          { statementId: 1, text: 'Stelling een', answer: 'oneens' },
          { statementId: 3, text: 'Stelling drie', answer: null },
        ],
      });
    });

    await context.test('saves an answer for the own party without touching other parties', async () => {
      const updated = await request('PUT', '/party-admin/statements/1', partyAdmin.token, { answer: 'eens' });

      strictEqual(updated.status, StatusCodes.OK);
      deepStrictEqual(await updated.json(), { statementId: 1, text: 'Stelling een', answer: 'eens' });

      const created = await request('PUT', '/party-admin/statements/3', partyAdmin.token, { answer: 'neutraal' });

      strictEqual(created.status, StatusCodes.OK);
      deepStrictEqual(await created.json(), { statementId: 3, text: 'Stelling drie', answer: 'neutraal' });
      deepStrictEqual(
        database.prepare('SELECT party_id AS partyId, statement_id AS statementId, answer FROM party_answers ORDER BY party_id, statement_id').all()
          .map(row => ({ ...row })),
        [
          { partyId: 1, statementId: 1, answer: 'eens' },
          { partyId: 1, statementId: 3, answer: 'neutraal' },
          { partyId: 2, statementId: 1, answer: 'eens' },
        ],
      );
    });

    await context.test('rejects inactive or unknown statements and invalid answers', async () => {
      const cases: [Promise<Response>, number][] = [
        [request('PUT', `/party-admin/statements/${String(inactiveStatementId)}`, partyAdmin.token, { answer: 'eens' }), StatusCodes.NOT_FOUND],
        [request('PUT', `/party-admin/statements/${String(nonExistentId)}`, partyAdmin.token, { answer: 'eens' }), StatusCodes.NOT_FOUND],
        [request('PUT', '/party-admin/statements/1', partyAdmin.token, { answer: 'misschien' }), StatusCodes.BAD_REQUEST],
        [request('PUT', '/party-admin/statements/1', partyAdmin.token, { answer: 'eens', partyId: 2 }), StatusCodes.BAD_REQUEST],
        [request('PUT', '/party-admin/statements/abc', partyAdmin.token, { answer: 'eens' }), StatusCodes.BAD_REQUEST],
        [request('POST', '/party-admin/statements', partyAdmin.token, {}), StatusCodes.METHOD_NOT_ALLOWED],
      ];

      for (const [pending, status] of cases) {
        const response = await pending;

        strictEqual(response.status, status);
        await response.text();
      }
    });

    await context.test('requires a valid party admin session', async () => {
      const cases: [Promise<Response>, number][] = [
        [request('GET', '/party-admin/statements', null), StatusCodes.UNAUTHORIZED],
        [request('GET', '/party-admin/statements', 'f'.repeat(tokenLength)), StatusCodes.UNAUTHORIZED],
        [request('PUT', '/party-admin/statements/1', null, { answer: 'oneens' }), StatusCodes.UNAUTHORIZED],
        [request('GET', '/party-admin/statements', superadmin.token), StatusCodes.FORBIDDEN],
      ];

      for (const [pending, status] of cases) {
        const response = await pending;

        strictEqual(response.status, status);
        await response.text();
      }
    });

    await context.test('blocks party admins from superadmin routes, including editing their own party', async () => {
      const cases: Promise<Response>[] = [
        request('PATCH', '/parties/1', partyAdmin.token, { name: 'Nieuwe naam' }),
        request('DELETE', '/parties/1', partyAdmin.token),
        request('POST', '/parties', partyAdmin.token, { name: 'Extra partij' }),
        request('PUT', '/parties/2/answers/1', partyAdmin.token, { answer: 'oneens' }),
        request('POST', '/statements', partyAdmin.token, { text: 'Nieuwe stelling' }),
        request('PATCH', '/statements/1', partyAdmin.token, { text: 'Gewijzigd' }),
      ];

      for (const pending of cases) {
        const response = await pending;

        strictEqual(response.status, StatusCodes.FORBIDDEN);
        await response.text();
      }

      strictEqual(database.prepare('SELECT name FROM parties WHERE id = 1').get()?.['name'], 'Partij A');
      strictEqual(database.prepare('SELECT COUNT(*) AS count FROM parties').get()?.['count'], partyCount);
      strictEqual(database.prepare('SELECT answer FROM party_answers WHERE party_id = 2 AND statement_id = 1').get()?.['answer'], 'eens');
    });

    await context.test('ends the session when the party admin is removed', async () => {
      database.exec('DELETE FROM party_admins WHERE id = 1');

      const response = await request('GET', '/party-admin/statements', partyAdmin.token);

      strictEqual(response.status, StatusCodes.UNAUTHORIZED);
      await response.text();
    });
  }
  finally {
    server.close();
    database.close();
  }
});
