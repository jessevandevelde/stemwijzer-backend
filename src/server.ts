import { StatusCodes } from 'http-status-codes';
import type { Server } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import {
  handleStatementRequest,
  handleCreateStatementRequest,
  handleListStatementsRequest,
  handleGetStatementByIdRequest,
  handleUpdateStatementRequest,
  handleDeleteStatementRequest,
} from './statements';
import { handleMatchingRequest } from './matching';
import { handleLoginRequest } from './auth';
import { authorize } from './auth/authorize';
import {
  handleCreatePartyRequest,
  handleListPartiesRequest,
  handleGetPartyByIdRequest,
  handleUpdatePartyRequest,
  handleDeletePartyRequest,
} from './parties';
import { handleListPartyAnswersRequest, handleSetPartyAnswerRequest } from './party-answers';
import {
  handleGetPartyAdminPartyRequest,
  handleListPartyAdminStatementsRequest,
  handleSetPartyAdminAnswerRequest,
  handleUpdatePartyAdminPartyRequest,
} from './party-admin';
import {
  handleCreatePartyAdminRequest,
  handleDeletePartyAdminRequest,
  handleListPartyAdminsRequest,
  handleUpdatePartyAdminRequest,
} from './party-admins';
import { parseId } from './http/parse-id';
import { defaultUploadDir, handleServeUploadRequest, handleUploadImageRequest, uploadUrlPattern } from './uploads';

const statementIdPattern = /^\/statements\/([^/]+)$/u;
const partyIdPattern = /^\/parties\/([^/]+)$/u;
const partyAnswersPattern = /^\/parties\/([^/]+)\/answers$/u;
const partyAnswerPattern = /^\/parties\/([^/]+)\/answers\/([^/]+)$/u;
const partyAdminsPattern = /^\/parties\/([^/]+)\/admins$/u;
const partyAdminAccountPattern = /^\/party-admins\/([^/]+)$/u;
const partyAdminStatementPattern = /^\/party-admin\/statements\/([^/]+)$/u;

export function createApp(database: DatabaseSync, uploadDir = defaultUploadDir): Server {
  return createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const method = request.method ?? '';

      if (url.pathname === '/uploads') {
        if (method !== 'POST') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'POST' });
          response.end(JSON.stringify({ error: 'Gebruik POST voor deze route.' }));

          return;
        }

        if (authorize(database, request, response, ['superadmin', 'party-admin'])) {
          void handleUploadImageRequest(uploadDir, request, response);
        }

        return;
      }

      const uploadMatch = uploadUrlPattern.exec(url.pathname);

      if (uploadMatch?.[1] !== undefined) {
        if (method !== 'GET') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET' });
          response.end(JSON.stringify({ error: 'Gebruik GET voor deze route.' }));

          return;
        }

        void handleServeUploadRequest(uploadDir, uploadMatch[1], response);

        return;
      }

      if (url.pathname === '/auth/login') {
        if (method !== 'POST') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'POST' });
          response.end(JSON.stringify({ error: 'Gebruik POST voor deze route.' }));

          return;
        }

        void handleLoginRequest(database, request, response);

        return;
      }

      if (url.pathname === '/matching') {
        if (method !== 'POST') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'POST' });
          response.end(JSON.stringify({ error: 'Gebruik POST voor deze route.' }));

          return;
        }

        void handleMatchingRequest(database, request, response);

        return;
      }

      if (url.pathname === '/statements') {
        if (method === 'GET') {
          handleStatementRequest(database, url.searchParams, response);

          return;
        }

        if (method === 'POST') {
          if (authorize(database, request, response, 'superadmin')) {
            void handleCreateStatementRequest(database, request, response);
          }

          return;
        }

        response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, POST' });
        response.end(JSON.stringify({ error: 'Gebruik GET of POST voor deze route.' }));

        return;
      }

      if (url.pathname === '/statements/all') {
        if (method !== 'GET') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET' });
          response.end(JSON.stringify({ error: 'Gebruik GET voor deze route.' }));

          return;
        }

        handleListStatementsRequest(database, response);

        return;
      }

      const statementIdMatch = statementIdPattern.exec(url.pathname);

      if (statementIdMatch) {
        const id = parseId(statementIdMatch[1]);

        if (id === undefined) {
          response.writeHead(StatusCodes.BAD_REQUEST);
          response.end(JSON.stringify({ error: 'Het id in de URL moet een positief geheel getal zijn.' }));

          return;
        }

        if (method === 'GET') {
          handleGetStatementByIdRequest(database, id, response);

          return;
        }

        if (method === 'PATCH') {
          if (authorize(database, request, response, 'superadmin')) {
            void handleUpdateStatementRequest(database, id, request, response);
          }

          return;
        }

        if (method === 'DELETE') {
          if (authorize(database, request, response, 'superadmin')) {
            handleDeleteStatementRequest(database, id, response);
          }

          return;
        }

        response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, PATCH, DELETE' });
        response.end(JSON.stringify({ error: 'Gebruik GET, PATCH of DELETE voor deze route.' }));

        return;
      }

      if (url.pathname === '/parties') {
        if (method === 'GET') {
          handleListPartiesRequest(database, response);

          return;
        }

        if (method === 'POST') {
          if (authorize(database, request, response, 'superadmin')) {
            void handleCreatePartyRequest(database, request, response);
          }

          return;
        }

        response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, POST' });
        response.end(JSON.stringify({ error: 'Gebruik GET of POST voor deze route.' }));

        return;
      }

      const partyAdminsMatch = partyAdminsPattern.exec(url.pathname);

      if (partyAdminsMatch) {
        const partyId = parseId(partyAdminsMatch[1]);

        if (partyId === undefined) {
          response.writeHead(StatusCodes.BAD_REQUEST);
          response.end(JSON.stringify({ error: 'Het id in de URL moet een positief geheel getal zijn.' }));

          return;
        }

        if (method !== 'GET' && method !== 'POST') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, POST' });
          response.end(JSON.stringify({ error: 'Gebruik GET of POST voor deze route.' }));

          return;
        }

        if (!authorize(database, request, response, 'superadmin')) {
          return;
        }

        if (method === 'GET') {
          handleListPartyAdminsRequest(database, partyId, response);
        }
        else {
          void handleCreatePartyAdminRequest(database, partyId, request, response);
        }

        return;
      }

      const partyAdminAccountMatch = partyAdminAccountPattern.exec(url.pathname);

      if (partyAdminAccountMatch) {
        const id = parseId(partyAdminAccountMatch[1]);

        if (id === undefined) {
          response.writeHead(StatusCodes.BAD_REQUEST);
          response.end(JSON.stringify({ error: 'Het id in de URL moet een positief geheel getal zijn.' }));

          return;
        }

        if (method !== 'PATCH' && method !== 'DELETE') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'PATCH, DELETE' });
          response.end(JSON.stringify({ error: 'Gebruik PATCH of DELETE voor deze route.' }));

          return;
        }

        if (!authorize(database, request, response, 'superadmin')) {
          return;
        }

        if (method === 'PATCH') {
          void handleUpdatePartyAdminRequest(database, id, request, response);
        }
        else {
          handleDeletePartyAdminRequest(database, id, response);
        }

        return;
      }

      const partyAnswersMatch = partyAnswersPattern.exec(url.pathname);

      if (partyAnswersMatch) {
        const partyId = parseId(partyAnswersMatch[1]);

        if (partyId === undefined) {
          response.writeHead(StatusCodes.BAD_REQUEST);
          response.end(JSON.stringify({ error: 'Het id in de URL moet een positief geheel getal zijn.' }));

          return;
        }

        if (method !== 'GET') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET' });
          response.end(JSON.stringify({ error: 'Gebruik GET voor deze route.' }));

          return;
        }

        handleListPartyAnswersRequest(database, partyId, response);

        return;
      }

      const partyAnswerMatch = partyAnswerPattern.exec(url.pathname);

      if (partyAnswerMatch) {
        const partyId = parseId(partyAnswerMatch[1]);
        const statementId = parseId(partyAnswerMatch[2]);

        if (partyId === undefined || statementId === undefined) {
          response.writeHead(StatusCodes.BAD_REQUEST);
          response.end(JSON.stringify({ error: 'De ids in de URL moeten positieve gehele getallen zijn.' }));

          return;
        }

        if (method !== 'PUT') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'PUT' });
          response.end(JSON.stringify({ error: 'Gebruik PUT voor deze route.' }));

          return;
        }

        if (authorize(database, request, response, 'superadmin')) {
          void handleSetPartyAnswerRequest(database, partyId, statementId, request, response);
        }

        return;
      }

      const partyIdMatch = partyIdPattern.exec(url.pathname);

      if (partyIdMatch) {
        const id = parseId(partyIdMatch[1]);

        if (id === undefined) {
          response.writeHead(StatusCodes.BAD_REQUEST);
          response.end(JSON.stringify({ error: 'Het id in de URL moet een positief geheel getal zijn.' }));

          return;
        }

        if (method === 'GET') {
          handleGetPartyByIdRequest(database, id, response);

          return;
        }

        if (method === 'PATCH') {
          if (authorize(database, request, response, 'superadmin')) {
            void handleUpdatePartyRequest(database, id, request, response);
          }

          return;
        }

        if (method === 'DELETE') {
          if (authorize(database, request, response, 'superadmin')) {
            handleDeletePartyRequest(database, id, response);
          }

          return;
        }

        response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, PATCH, DELETE' });
        response.end(JSON.stringify({ error: 'Gebruik GET, PATCH of DELETE voor deze route.' }));

        return;
      }

      if (url.pathname === '/party-admin/party') {
        if (method !== 'GET' && method !== 'PATCH') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET, PATCH' });
          response.end(JSON.stringify({ error: 'Gebruik GET of PATCH voor deze route.' }));

          return;
        }

        const user = authorize(database, request, response, 'party-admin');

        if (user && method === 'GET') {
          handleGetPartyAdminPartyRequest(database, user, response);
        }
        else if (user) {
          void handleUpdatePartyAdminPartyRequest(database, user, request, response);
        }

        return;
      }

      if (url.pathname === '/party-admin/statements') {
        if (method !== 'GET') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'GET' });
          response.end(JSON.stringify({ error: 'Gebruik GET voor deze route.' }));

          return;
        }

        const user = authorize(database, request, response, 'party-admin');

        if (user) {
          handleListPartyAdminStatementsRequest(database, user, response);
        }

        return;
      }

      const partyAdminStatementMatch = partyAdminStatementPattern.exec(url.pathname);

      if (partyAdminStatementMatch) {
        const statementId = parseId(partyAdminStatementMatch[1]);

        if (statementId === undefined) {
          response.writeHead(StatusCodes.BAD_REQUEST);
          response.end(JSON.stringify({ error: 'Het id in de URL moet een positief geheel getal zijn.' }));

          return;
        }

        if (method !== 'PUT') {
          response.writeHead(StatusCodes.METHOD_NOT_ALLOWED, { allow: 'PUT' });
          response.end(JSON.stringify({ error: 'Gebruik PUT voor deze route.' }));

          return;
        }

        const user = authorize(database, request, response, 'party-admin');

        if (user) {
          void handleSetPartyAdminAnswerRequest(database, user, statementId, request, response);
        }

        return;
      }

      response.writeHead(StatusCodes.NOT_FOUND);
      response.end(JSON.stringify({ error: 'Route niet gevonden.' }));
    }
    catch (error: unknown) {
      console.error('Aanvraag verwerken mislukt:', error);
      response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
      response.end(JSON.stringify({ error: 'De aanvraag kon niet worden verwerkt.' }));
    }
  });
}
