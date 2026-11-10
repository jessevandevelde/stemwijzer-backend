import { StatusCodes } from 'http-status-codes';
import { deepStrictEqual, ok, strictEqual } from 'node:assert';
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
const updatedSeats = 12;
const tooLongExplanation = 1001;
const secondPartyId = 2;

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
          { statementId: 1, text: 'Stelling een', answer: 'oneens', explanation: null },
          { statementId: 3, text: 'Stelling drie', answer: null, explanation: null },
        ],
      });
    });

    await context.test('saves an answer for the own party without touching other parties', async () => {
      const updated = await request('PUT', '/party-admin/statements/1', partyAdmin.token, { answer: 'eens' });

      strictEqual(updated.status, StatusCodes.OK);
      deepStrictEqual(await updated.json(), { statementId: 1, text: 'Stelling een', answer: 'eens', explanation: null });

      const created = await request('PUT', '/party-admin/statements/3', partyAdmin.token, { answer: 'neutraal' });

      strictEqual(created.status, StatusCodes.OK);
      deepStrictEqual(await created.json(), { statementId: 3, text: 'Stelling drie', answer: 'neutraal', explanation: null });
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

    await context.test('stores an explanation with the answer and keeps it when only the answer changes', async () => {
      const withExplanation = await request('PUT', '/party-admin/statements/1', partyAdmin.token, { answer: 'eens', explanation: '  Omdat het eerlijker is.  ' });

      strictEqual(withExplanation.status, StatusCodes.OK);
      deepStrictEqual(await withExplanation.json(), { statementId: 1, text: 'Stelling een', answer: 'eens', explanation: 'Omdat het eerlijker is.' });

      const answerOnly = await request('PUT', '/party-admin/statements/1', partyAdmin.token, { answer: 'neutraal' });

      deepStrictEqual(await answerOnly.json(), { statementId: 1, text: 'Stelling een', answer: 'neutraal', explanation: 'Omdat het eerlijker is.' });

      const publicStatement = await fetch(`${baseUrl}/statements?index=0`);
      const publicBody: unknown = await publicStatement.json();

      ok(typeof publicBody === 'object' && publicBody !== null && 'partyAnswers' in publicBody && Array.isArray(publicBody.partyAnswers));
      deepStrictEqual(publicBody.partyAnswers[0], { partyId: 1, partyName: 'Partij A', abbreviation: null, color: null, answer: 'neutraal', explanation: 'Omdat het eerlijker is.' });

      const cleared = await request('PUT', '/party-admin/statements/1', partyAdmin.token, { answer: 'eens', explanation: '' });

      deepStrictEqual(await cleared.json(), { statementId: 1, text: 'Stelling een', answer: 'eens', explanation: null });

      for (const body of [{ answer: null, explanation: 'Zonder standpunt' }, { answer: 'eens', explanation: 'x'.repeat(tooLongExplanation) }, { answer: 'eens', explanation: 5 }]) {
        const response = await request('PUT', '/party-admin/statements/1', partyAdmin.token, body);

        strictEqual(response.status, StatusCodes.BAD_REQUEST, JSON.stringify(body));
        await response.text();
      }
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

    await context.test('lets a party admin edit the details of the own party, except whether it is active', async () => {
      const read = await request('GET', '/party-admin/party', partyAdmin.token);
      const readBody: unknown = await read.json();

      strictEqual(read.status, StatusCodes.OK);
      strictEqual(typeof readBody === 'object' && readBody !== null && 'name' in readBody ? readBody.name : undefined, 'Partij A');

      const updated = await request('PATCH', '/party-admin/party', partyAdmin.token, {
        name: '  Partij A Nieuw  ', description: 'Nieuwe omschrijving', abbreviation: 'PAN', color: '#aabbcc',
        seats: updatedSeats, leader: 'Lijsttrekker A', imageUrl: 'https://example.test/logo.png',
      });

      const updatedBody: unknown = await updated.json();

      strictEqual(updated.status, StatusCodes.OK);
      strictEqual(typeof updatedBody === 'object' && updatedBody !== null && 'name' in updatedBody ? updatedBody.name : undefined, 'Partij A Nieuw');
      deepStrictEqual(
        { ...database.prepare('SELECT name, description, abbreviation, color, seats, leader, image_url AS imageUrl, is_active AS isActive FROM parties WHERE id = 1').get() },
        {
          name: 'Partij A Nieuw', description: 'Nieuwe omschrijving', abbreviation: 'PAN', color: '#AABBCC',
          seats: updatedSeats, leader: 'Lijsttrekker A', imageUrl: 'https://example.test/logo.png', isActive: 1,
        },
      );
      strictEqual(database.prepare('SELECT name FROM parties WHERE id = 2').get()?.['name'], 'Partij B');

      const statements = await request('GET', '/party-admin/statements', partyAdmin.token);
      const statementsBody: unknown = await statements.json();

      deepStrictEqual(typeof statementsBody === 'object' && statementsBody !== null && 'party' in statementsBody ? statementsBody.party : undefined, { id: 1, name: 'Partij A Nieuw' });

      for (const body of [{}, { name: '' }, { color: 'rood' }, { seats: -1 }, { name: 'X', id: 2 }, { description: 'x\0y' }, []]) {
        const response = await request('PATCH', '/party-admin/party', partyAdmin.token, body);

        strictEqual(response.status, StatusCodes.BAD_REQUEST, JSON.stringify(body));
        await response.text();
      }

      const cases: [Promise<Response>, number][] = [
        [request('PATCH', '/party-admin/party', null, { name: 'Zonder login' }), StatusCodes.UNAUTHORIZED],
        [request('PATCH', '/party-admin/party', superadmin.token, { name: 'Superadmin' }), StatusCodes.FORBIDDEN],
        [request('DELETE', '/party-admin/party', partyAdmin.token), StatusCodes.METHOD_NOT_ALLOWED],
        [request('PATCH', '/party-admin/party', partyAdmin.token, { isActive: false }), StatusCodes.FORBIDDEN],
        [request('PATCH', '/party-admin/party', partyAdmin.token, { name: 'X', isActive: true }), StatusCodes.FORBIDDEN],
      ];

      for (const [pending, status] of cases) {
        const response = await pending;

        strictEqual(response.status, status);
        await response.text();
      }

      strictEqual(database.prepare('SELECT name FROM parties WHERE id = 1').get()?.['name'], 'Partij A Nieuw');
    });

    await context.test('lets a party admin change only their own password', async () => {
      database.prepare('INSERT INTO party_admins (id, party_id, name, email, password_hash) VALUES (?, ?, ?, ?, ?)')
        .run(secondPartyId, secondPartyId, 'Beheerder B', 'b@example.test', hashPassword('Test1234!'));

      const partyAdminB = await login('b@example.test');

      for (const body of [
        {},
        [],
        { newPassword: 'Nieuw12345' },
        { currentPassword: 'Test1234!' },
        { currentPassword: 'Test1234!', newPassword: 'kort' },
        { currentPassword: 'fout-wachtwoord', newPassword: 'Nieuw12345' },
        { currentPassword: 'Test1234!', newPassword: 'Nieuw12345', email: 'ander@example.test' },
      ]) {
        const response = await request('PATCH', '/party-admin/password', partyAdminB.token, body);

        strictEqual(response.status, StatusCodes.BAD_REQUEST, JSON.stringify(body));
        await response.text();
      }

      const cases: [Promise<Response>, number][] = [
        [request('PATCH', '/party-admin/password', null, { currentPassword: 'Test1234!', newPassword: 'Nieuw12345' }), StatusCodes.UNAUTHORIZED],
        [request('PATCH', '/party-admin/password', superadmin.token, { currentPassword: 'Test1234!', newPassword: 'Nieuw12345' }), StatusCodes.FORBIDDEN],
        [request('GET', '/party-admin/password', partyAdminB.token), StatusCodes.METHOD_NOT_ALLOWED],
      ];

      for (const [pending, status] of cases) {
        const response = await pending;

        strictEqual(response.status, status);
        await response.text();
      }

      const changed = await request('PATCH', '/party-admin/password', partyAdminB.token, { currentPassword: 'Test1234!', newPassword: 'Nieuw12345' });

      strictEqual(changed.status, StatusCodes.NO_CONTENT);
      await changed.text();

      const oldSession = await request('GET', '/party-admin/statements', partyAdminB.token);

      strictEqual(oldSession.status, StatusCodes.UNAUTHORIZED);
      await oldSession.text();

      for (const [password, status] of [['Test1234!', StatusCodes.UNAUTHORIZED], ['Nieuw12345', StatusCodes.OK]] as const) {
        const response = await request('POST', '/auth/login', null, { email: 'b@example.test', password });

        strictEqual(response.status, status, password);
        await response.text();
      }

      const otherAdmin = await request('GET', '/party-admin/statements', partyAdmin.token);

      strictEqual(otherAdmin.status, StatusCodes.OK);
      await otherAdmin.text();
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
