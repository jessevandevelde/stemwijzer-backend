import { StatusCodes } from 'http-status-codes';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { readJsonBody } from '../http/read-json-body';
import { RequestError } from '../http/request-error';
import { getPartyById } from '../parties/get-party';
import { getPartyAnswer, listPartyAnswers } from './list-party-answers';
import { setPartyAnswer } from './set-party-answer';
import { validatePartyAnswer } from './validation';

function writePartyNotFound(response: ServerResponse): void {
  response.writeHead(StatusCodes.NOT_FOUND);
  response.end(JSON.stringify({ error: 'Geen partij gevonden met dit id.' }));
}

export function handleListPartyAnswersRequest(database: DatabaseSync, partyId: number, response: ServerResponse): void {
  try {
    if (!getPartyById(database, partyId)) {
      writePartyNotFound(response);

      return;
    }

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(listPartyAnswers(database, partyId)));
  }
  catch (error: unknown) {
    console.error('Partijantwoorden ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De partijantwoorden konden niet worden opgehaald.' }));
  }
}

export async function handleSetPartyAnswerRequest(
  database: DatabaseSync,
  partyId: number,
  statementId: number,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const body = await readJsonBody(request);
    const answer = validatePartyAnswer(body);

    if (!getPartyById(database, partyId)) {
      writePartyNotFound(response);

      return;
    }

    if (!getPartyAnswer(database, partyId, statementId)) {
      response.writeHead(StatusCodes.NOT_FOUND);
      response.end(JSON.stringify({ error: 'Geen stelling gevonden met dit id.' }));

      return;
    }

    setPartyAnswer(database, partyId, statementId, answer);

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(getPartyAnswer(database, partyId, statementId)));
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

    console.error('Partijantwoord opslaan mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'Het partijantwoord kon niet worden opgeslagen.' }));
  }
}
