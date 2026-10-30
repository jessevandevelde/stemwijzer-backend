import { StatusCodes } from 'http-status-codes';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { readJsonBody } from '../http/read-json-body';
import { RequestError } from '../http/request-error';
import { getPartyById } from '../parties/get-party';
import { createPartyAdmin, deletePartyAdmin, getPartyAdmin, isEmailTaken, listPartyAdmins, updatePartyAdmin } from './accounts';
import { validateCreatePartyAdmin, validateUpdatePartyAdmin } from './validation';

const emailTakenMessage = 'Er bestaat al een account met dit e-mailadres.';

function writeError(response: ServerResponse, error: unknown, logMessage: string, publicMessage: string): void {
  if (response.destroyed) {
    return;
  }

  if (error instanceof RequestError) {
    response.writeHead(error.status);
    response.end(JSON.stringify({ error: error.message }));

    return;
  }

  console.error(logMessage, error);
  response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
  response.end(JSON.stringify({ error: publicMessage }));
}

function writeNotFound(response: ServerResponse, message: string): void {
  response.writeHead(StatusCodes.NOT_FOUND);
  response.end(JSON.stringify({ error: message }));
}

export function handleListPartyAdminsRequest(database: DatabaseSync, partyId: number, response: ServerResponse): void {
  try {
    if (!getPartyById(database, partyId)) {
      writeNotFound(response, 'Geen partij gevonden met dit id.');

      return;
    }

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(listPartyAdmins(database, partyId)));
  }
  catch (error: unknown) {
    writeError(response, error, 'Partijbeheerders ophalen mislukt:', 'De partijbeheerders konden niet worden opgehaald.');
  }
}

export async function handleCreatePartyAdminRequest(database: DatabaseSync, partyId: number, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const input = validateCreatePartyAdmin(await readJsonBody(request));

    if (!getPartyById(database, partyId)) {
      writeNotFound(response, 'Geen partij gevonden met dit id.');

      return;
    }

    if (isEmailTaken(database, input.email)) {
      throw new RequestError(emailTakenMessage, StatusCodes.CONFLICT);
    }

    const id = createPartyAdmin(database, partyId, input);

    response.writeHead(StatusCodes.CREATED);
    response.end(JSON.stringify(getPartyAdmin(database, id)));
  }
  catch (error: unknown) {
    writeError(response, error, 'Partijbeheerder aanmaken mislukt:', 'De partijbeheerder kon niet worden aangemaakt.');
  }
}

export async function handleUpdatePartyAdminRequest(database: DatabaseSync, id: number, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const input = validateUpdatePartyAdmin(await readJsonBody(request));

    if (!getPartyAdmin(database, id)) {
      writeNotFound(response, 'Geen partijbeheerder gevonden met dit id.');

      return;
    }

    if (input.email !== undefined && isEmailTaken(database, input.email, id)) {
      throw new RequestError(emailTakenMessage, StatusCodes.CONFLICT);
    }

    updatePartyAdmin(database, id, input);

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(getPartyAdmin(database, id)));
  }
  catch (error: unknown) {
    writeError(response, error, 'Partijbeheerder wijzigen mislukt:', 'De partijbeheerder kon niet worden gewijzigd.');
  }
}

export function handleDeletePartyAdminRequest(database: DatabaseSync, id: number, response: ServerResponse): void {
  try {
    if (!deletePartyAdmin(database, id)) {
      writeNotFound(response, 'Geen partijbeheerder gevonden met dit id.');

      return;
    }

    response.writeHead(StatusCodes.NO_CONTENT);
    response.end();
  }
  catch (error: unknown) {
    writeError(response, error, 'Partijbeheerder verwijderen mislukt:', 'De partijbeheerder kon niet worden verwijderd.');
  }
}
