import { StatusCodes } from 'http-status-codes';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { readJsonBody } from '../http/read-json-body';
import { RequestError } from '../http/request-error';
import { authenticateUser } from './login';
import { createSession } from './sessions';
import { validateLoginCredentials } from './validation';

const invalidCredentialsMessage = 'Onjuiste combinatie van e-mailadres en wachtwoord.';

export async function handleLoginRequest(database: DatabaseSync, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await readJsonBody(request);
    const credentials = validateLoginCredentials(body);
    const user = authenticateUser(database, credentials.email, credentials.password);

    if (!user) {
      response.writeHead(StatusCodes.UNAUTHORIZED);
      response.end(JSON.stringify({ error: invalidCredentialsMessage }));

      return;
    }

    const token = createSession(database, user.role, user.id);
    const party = user.role === 'party-admin' ? { partyId: user.partyId, partyName: user.partyName } : {};

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, ...party },
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
