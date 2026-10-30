import { StatusCodes } from 'http-status-codes';
import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { createSession } from '../auth/sessions';
import { openDatabase } from '../database';
import { createApp } from '../server';

const pngBytes = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('rest of a tiny png')]);
const tooLargeBytes = 2_097_153;
const fileNameLength = 32;
const expectedUploadCount = 2;

function hasUrl(value: unknown): value is { url: string } {
  return typeof value === 'object' && value !== null && 'url' in value && typeof value.url === 'string';
}

void it('uploads party logos and serves them back', async (context) => {
  const uploadDir = await mkdtemp(join(tmpdir(), 'stemwijzer-uploads-'));
  const database = openDatabase(':memory:');
  const server = createApp(database, uploadDir);

  try {
    database.exec(`
      INSERT INTO superadmins (id, name, email, password_hash) VALUES (1, 'Super', 'super@example.test', '!disabled');
      INSERT INTO parties (id, name) VALUES (1, 'Partij A');
      INSERT INTO party_admins (id, party_id, name, email, password_hash) VALUES (1, 1, 'Beheerder', 'a@example.test', '!disabled');
    `);

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;
    const superadminToken = createSession(database, 'superadmin', 1);
    const partyAdminToken = createSession(database, 'party-admin', 1);

    async function upload(body: Buffer | string, contentType: string, token: string | null): Promise<Response> {
      const headers: [string, string][] = [['content-type', contentType]];

      if (token !== null) {
        headers.push(['authorization', `Bearer ${token}`]);
      }

      return fetch(`${baseUrl}/uploads`, { method: 'POST', headers, body: typeof body === 'string' ? body : new Uint8Array(body) });
    }

    let uploadedUrl = '';

    await context.test('stores an uploaded image under a random name and serves it', async () => {
      const response = await upload(pngBytes, 'image/png', superadminToken);
      const body: unknown = await response.json();

      strictEqual(response.status, StatusCodes.CREATED);
      ok(hasUrl(body) && /^\/uploads\/[0-9a-f]{32}\.png$/u.test(body.url));
      uploadedUrl = body.url;

      const served = await fetch(`${baseUrl}${uploadedUrl}`);

      strictEqual(served.status, StatusCodes.OK);
      strictEqual(served.headers.get('content-type'), 'image/png');
      strictEqual(served.headers.get('x-content-type-options'), 'nosniff');
      deepStrictEqual(Buffer.from(await served.arrayBuffer()), pngBytes);
    });

    await context.test('lets party admins upload as well', async () => {
      const response = await upload(pngBytes, 'image/png', partyAdminToken);

      strictEqual(response.status, StatusCodes.CREATED);
      await response.text();
    });

    await context.test('rejects missing logins, unsupported types, fake images and large files', async () => {
      const cases: [Promise<Response>, number][] = [
        [upload(pngBytes, 'image/png', null), StatusCodes.UNAUTHORIZED],
        [upload('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml', superadminToken), StatusCodes.UNSUPPORTED_MEDIA_TYPE],
        [upload('{"geen":"afbeelding"}', 'application/json', superadminToken), StatusCodes.UNSUPPORTED_MEDIA_TYPE],
        [upload('<html>niet echt een png</html>', 'image/png', superadminToken), StatusCodes.BAD_REQUEST],
        [upload(Buffer.concat([pngBytes, Buffer.alloc(tooLargeBytes)]), 'image/png', superadminToken), StatusCodes.REQUEST_TOO_LONG],
        [fetch(`${baseUrl}/uploads`), StatusCodes.METHOD_NOT_ALLOWED],
        [fetch(`${baseUrl}/uploads/${'0'.repeat(fileNameLength)}.png`), StatusCodes.NOT_FOUND],
        [fetch(`${baseUrl}/uploads/..%2F..%2Fpackage.json`), StatusCodes.NOT_FOUND],
      ];

      for (const [pending, status] of cases) {
        const response = await pending;

        strictEqual(response.status, status);
        await response.text();
      }

      strictEqual((await readdir(uploadDir)).length, expectedUploadCount);
    });

    await context.test('accepts an uploaded logo as imageUrl of a party', async () => {
      const patch = async (imageUrl: string): Promise<Response> => fetch(`${baseUrl}/party-admin/party`, {
        method: 'PATCH',
        headers: [['content-type', 'application/json'], ['authorization', `Bearer ${partyAdminToken}`]],
        body: JSON.stringify({ imageUrl }),
      });

      const accepted = await patch(uploadedUrl);

      strictEqual(accepted.status, StatusCodes.OK);
      await accepted.text();
      strictEqual(database.prepare('SELECT image_url AS imageUrl FROM parties WHERE id = 1').get()?.['imageUrl'], uploadedUrl);

      for (const imageUrl of ['/uploads/logo.svg', '/elders/logo.png', '/uploads/../server.ts']) {
        const rejected = await patch(imageUrl);

        strictEqual(rejected.status, StatusCodes.BAD_REQUEST, imageUrl);
        await rejected.text();
      }
    });
  }
  finally {
    server.close();
    database.close();
    await rm(uploadDir, { recursive: true, force: true });
  }
});
