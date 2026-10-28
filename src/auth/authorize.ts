import { StatusCodes } from 'http-status-codes';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import type { AuthenticatedUser, UserRole } from '../types/auth.interface';
import { findSessionUser } from './sessions';

const bearerPattern = /^Bearer ([0-9a-f]{64})$/u;

// Schrijft zelf 401 of 403 naar de response wanneer de aanvraag niet van een ingelogde gebruiker met deze rol komt.
export function authorize(database: DatabaseSync, request: IncomingMessage, response: ServerResponse, role: UserRole): AuthenticatedUser | undefined {
  const token = bearerPattern.exec(request.headers.authorization ?? '')?.[1];
  const user = token === undefined ? null : findSessionUser(database, token);

  if (!user) {
    request.resume();
    response.writeHead(StatusCodes.UNAUTHORIZED);
    response.end(JSON.stringify({ error: 'Log in om deze actie uit te voeren.' }));

    return undefined;
  }

  if (user.role !== role) {
    request.resume();
    response.writeHead(StatusCodes.FORBIDDEN);
    response.end(JSON.stringify({ error: 'Je hebt geen toegang tot deze actie.' }));

    return undefined;
  }

  return user;
}
