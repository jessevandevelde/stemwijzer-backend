import { StatusCodes } from 'http-status-codes';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { once } from 'node:events';
import { it } from 'node:test';
import { createSession } from '../auth/sessions';
import { openDatabase } from '../database';
import { createApp } from '../server';

const nonExistentId = 999;
const inactiveStatementId = 2;

void it('reads and sets party answers over HTTP', async (context) => {
  const database = openDatabase(':memory:');
  const server = createApp(database);

  try {
    database.exec(`
      INSERT INTO superadmins (id, name, email, password_hash) VALUES (1, 'Admin', 'admin@example.test', 'hash');
      INSERT INTO statements (id, text, created_by, is_active) VALUES (1, 'Stelling een', 1, 1), (2, 'Stelling twee', 1, 0);
      INSERT INTO parties (id, name) VALUES (1, 'Partij A'), (2, 'Partij B');
      INSERT INTO party_answers (party_id, statement_id, answer) VALUES (1, 1, 'oneens'), (2, 1, 'eens');
    `);

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;
    const authorization: [string, string] = ['authorization', `Bearer ${createSession(database, 'superadmin', 1)}`];

    async function put(path: string, body: unknown): Promise<Response> {
      return fetch(`${baseUrl}${path}`, { method: 'PUT', headers: [['content-type', 'application/json'], authorization], body: JSON.stringify(body) });
    }

    function answerCount(partyId: number, statementId: number): unknown {
      return database.prepare('SELECT COUNT(*) AS count FROM party_answers WHERE party_id = ? AND statement_id = ?').get(partyId, statementId)?.['count'];
    }

    await context.test('lists every statement with the answer of the party', async () => {
      const response = await fetch(`${baseUrl}/parties/1/answers`);

      strictEqual(response.status, StatusCodes.OK);
      deepStrictEqual(await response.json(), [
        { statementId: 1, statementText: 'Stelling een', statementIsActive: true, answer: 'oneens' },
        { statementId: 2, statementText: 'Stelling twee', statementIsActive: false, answer: null },
      ]);
    });

    await context.test('updates an existing answer without creating duplicates', async () => {
      const response = await put('/parties/1/answers/1', { answer: 'neutraal' });

      strictEqual(response.status, StatusCodes.OK);
      deepStrictEqual(await response.json(), { statementId: 1, statementText: 'Stelling een', statementIsActive: true, answer: 'neutraal' });
      strictEqual(answerCount(1, 1), 1);
      strictEqual(database.prepare('SELECT answer FROM party_answers WHERE party_id = 2').get()?.['answer'], 'eens');
    });

    await context.test('inserts a new answer and clears it with null', async () => {
      const expected = { statementId: inactiveStatementId, statementText: 'Stelling twee', statementIsActive: false };
      const created = await put(`/parties/1/answers/${String(inactiveStatementId)}`, { answer: 'eens' });

      strictEqual(created.status, StatusCodes.OK);
      deepStrictEqual(await created.json(), { ...expected, answer: 'eens' });
      strictEqual(answerCount(1, inactiveStatementId), 1);

      const cleared = await put(`/parties/1/answers/${String(inactiveStatementId)}`, { answer: null });

      strictEqual(cleared.status, StatusCodes.OK);
      deepStrictEqual(await cleared.json(), { ...expected, answer: null });
      strictEqual(answerCount(1, inactiveStatementId), 0);
    });

    await context.test('rejects invalid bodies, ids and methods', async () => {
      for (const body of [null, [], {}, { answer: 'misschien' }, { answer: 'eens', extra: true }]) {
        const response = await put('/parties/1/answers/1', body);

        strictEqual(response.status, StatusCodes.BAD_REQUEST);
        await response.text();
      }

      const cases: [Promise<Response>, number][] = [
        [fetch(`${baseUrl}/parties/abc/answers`), StatusCodes.BAD_REQUEST],
        [put('/parties/1/answers/0', { answer: 'eens' }), StatusCodes.BAD_REQUEST],
        [fetch(`${baseUrl}/parties/${String(nonExistentId)}/answers`), StatusCodes.NOT_FOUND],
        [put(`/parties/${String(nonExistentId)}/answers/1`, { answer: 'eens' }), StatusCodes.NOT_FOUND],
        [put(`/parties/1/answers/${String(nonExistentId)}`, { answer: 'eens' }), StatusCodes.NOT_FOUND],
        [fetch(`${baseUrl}/parties/1/answers`, { method: 'POST' }), StatusCodes.METHOD_NOT_ALLOWED],
        [fetch(`${baseUrl}/parties/1/answers/1`), StatusCodes.METHOD_NOT_ALLOWED],
      ];

      for (const [request, status] of cases) {
        const response = await request;

        strictEqual(response.status, status);
        await response.text();
      }

      strictEqual(database.prepare('SELECT answer FROM party_answers WHERE party_id = 1 AND statement_id = 1').get()?.['answer'], 'neutraal');
    });
  }
  finally {
    server.close();
    database.close();
  }
});
