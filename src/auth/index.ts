import { StatusCodes } from 'http-status-codes';
import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { readJsonBody } from '../http/read-json-body';
import { RequestError } from '../http/request-error';
import { authenticateSuperadmin } from './login';
import { validateLoginCredentials } from './validation';

const tokenBytes = 32;
const invalidCredentialsMessage = 'Onjuiste combinatie van e-mailadres en wachtwoord.';

export async function handleLoginRequest(database: DatabaseSync, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await readJsonBody(request);
    const credentials = validateLoginCredentials(body);
    const superadmin = authenticateSuperadmin(database, credentials.email, credentials.password);

    if (!superadmin) {
      response.writeHead(StatusCodes.UNAUTHORIZED);
      response.end(JSON.stringify({ error: invalidCredentialsMessage }));

      return;
    }

    const token = randomBytes(tokenBytes).toString('hex');

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify({
      token,
      user: { id: superadmin.id, name: superadmin.name, email: superadmin.email },
    }));
  }
  catch (error: unknown) {
    if (response.destroyed) {
      return;
    }

    if (error instanceof RequestError) {
      response.writeHead(error.status);
      response.end(JSON.stringify({ error: error.message }));

      return;
    }

    console.error('Inloggen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'Er kon niet worden ingelogd.' }));
  }
}
