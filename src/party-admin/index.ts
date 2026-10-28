import { StatusCodes } from 'http-status-codes';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { readJsonBody } from '../http/read-json-body';
import { RequestError } from '../http/request-error';
import { getPartyById } from '../parties/get-party';
import { updateParty } from '../parties/update-party';
import { validatePartyAdminUpdate } from '../parties/validation';
import { getPartyAnswer, listPartyAnswers } from '../party-answers/list-party-answers';
import { setPartyAnswer } from '../party-answers/set-party-answer';
import { validatePartyAnswer } from '../party-answers/validation';
import type { AuthenticatedUser } from '../types/auth.interface';
import type { PartyAnswerRecord } from '../types/party-answer.interface';

function toPartyStatement(record: PartyAnswerRecord): { statementId: number, text: string, answer: PartyAnswerRecord['answer'] } {
  return { statementId: record.statementId, text: record.statementText, answer: record.answer };
}

// De partij komt altijd uit de sessie, nooit uit de URL: een partijbeheerder kan zo alleen zijn eigen partij wijzigen.
export function handleListPartyAdminStatementsRequest(database: DatabaseSync, user: AuthenticatedUser, response: ServerResponse): void {
  try {
    const partyId = Number(user.partyId);
    const statements = listPartyAnswers(database, partyId).filter(record => record.statementIsActive).map(toPartyStatement);

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify({ party: { id: partyId, name: user.partyName }, statements }));
  }
  catch (error: unknown) {
    console.error('Stellingen voor partijbeheerder ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De stellingen konden niet worden opgehaald.' }));
  }
}

export async function handleSetPartyAdminAnswerRequest(
  database: DatabaseSync,
  user: AuthenticatedUser,
  statementId: number,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const partyId = Number(user.partyId);
    const body = await readJsonBody(request);
    const answer = validatePartyAnswer(body);

    if (!getPartyAnswer(database, partyId, statementId)?.statementIsActive) {
      response.writeHead(StatusCodes.NOT_FOUND);
      response.end(JSON.stringify({ error: 'Geen actieve stelling gevonden met dit id.' }));

      return;
    }

    setPartyAnswer(database, partyId, statementId, answer);

    const saved = getPartyAnswer(database, partyId, statementId);

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(saved ? toPartyStatement(saved) : null));
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

    console.error('Standpunt van partijbeheerder opslaan mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'Het standpunt kon niet worden opgeslagen.' }));
  }
}

export function handleGetPartyAdminPartyRequest(database: DatabaseSync, user: AuthenticatedUser, response: ServerResponse): void {
  try {
    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(getPartyById(database, Number(user.partyId))));
  }
  catch (error: unknown) {
    console.error('Partij voor partijbeheerder ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De partijgegevens konden niet worden opgehaald.' }));
  }
}

export async function handleUpdatePartyAdminPartyRequest(
  database: DatabaseSync,
  user: AuthenticatedUser,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const partyId = Number(user.partyId);
    const body = await readJsonBody(request);

    updateParty(database, partyId, validatePartyAdminUpdate(body));

    response.writeHead(StatusCodes.OK);
    response.end(JSON.stringify(getPartyById(database, partyId)));
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

    console.error('Partijgegevens van partijbeheerder opslaan mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De partijgegevens konden niet worden opgeslagen.' }));
  }
}
