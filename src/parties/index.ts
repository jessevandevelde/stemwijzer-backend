import { StatusCodes } from 'http-status-codes';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { readJsonBody } from '../http/read-json-body';
import { RequestError } from '../http/request-error';
import { createParty } from './create-party';
import { listParties } from './list-parties';
import { getPartyById } from './get-party';
import { updateParty } from './update-party';
import { deleteParty } from './delete-party';
import { validateParty, validateUpdateParty } from './validation';

function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ERR_SQLITE_ERROR' && error.message.includes('FOREIGN KEY constraint failed');
}

function writePartyNotFound(response: ServerResponse): void {
  response.writeHead(StatusCodes.NOT_FOUND);
  response.end(JSON.stringify({ error: 'Geen partij gevonden met dit id.' }));
}

export async function handleCreatePartyRequest(database: DatabaseSync, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await readJsonBody(request);
    const input = validateParty(body);
    const party = createParty(database, input);

    response.writeHead(StatusCodes.CREATED);
    response.end(JSON.stringify(party));
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

    console.error('Partij aanmaken mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De partij kon niet worden aangemaakt.' }));
  }
}

export function handleListPartiesRequest(database: DatabaseSync, response: ServerResponse): void {
  try {
    const parties = listParties(database);

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(parties));
  }
  catch (error: unknown) {
    console.error('Partijen ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De partijen konden niet worden opgehaald.' }));
  }
}

export function handleGetPartyByIdRequest(database: DatabaseSync, id: number, response: ServerResponse): void {
  try {
    const party = getPartyById(database, id);

    if (!party) {
      writePartyNotFound(response);

      return;
    }

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(party));
  }
  catch (error: unknown) {
    console.error('Partij ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De partij kon niet worden opgehaald.' }));
  }
}

export async function handleUpdatePartyRequest(database: DatabaseSync, id: number, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await readJsonBody(request);
    const input = validateUpdateParty(body);
    const updated = updateParty(database, id, input);

    if (!updated) {
      writePartyNotFound(response);

      return;
    }

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(getPartyById(database, id)));
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

    console.error('Partij wijzigen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De partij kon niet worden gewijzigd.' }));
  }
}

export function handleDeletePartyRequest(database: DatabaseSync, id: number, response: ServerResponse): void {
  try {
    const deleted = deleteParty(database, id);

    if (!deleted) {
      writePartyNotFound(response);

      return;
    }

    response.writeHead(StatusCodes.NO_CONTENT);
    response.end();
  }
  catch (error: unknown) {
    if (isForeignKeyViolation(error)) {
      response.writeHead(StatusCodes.CONFLICT);
      response.end(JSON.stringify({ error: 'Deze partij heeft nog partijantwoorden en kan niet worden verwijderd.' }));

      return;
    }

    console.error('Partij verwijderen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De partij kon niet worden verwijderd.' }));
  }
}
