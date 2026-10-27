import type { DatabaseSync } from 'node:sqlite';
import type { PartyAnswerRecord } from '../types/party-answer.interface';
import { rowToPartyAnswer } from './row-to-party-answer';

const selectPartyAnswers = `
  SELECT statements.id AS statementId, statements.text AS statementText,
         statements.is_active AS statementIsActive, party_answers.answer
  FROM statements
  LEFT JOIN party_answers ON party_answers.id = (
    SELECT id FROM party_answers
    WHERE party_id = ? AND statement_id = statements.id
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  )
`;

export function listPartyAnswers(database: DatabaseSync, partyId: number): PartyAnswerRecord[] {
  return database.prepare(`${selectPartyAnswers} ORDER BY statements.id`).all(partyId).map(rowToPartyAnswer);
}

export function getPartyAnswer(database: DatabaseSync, partyId: number, statementId: number): PartyAnswerRecord | undefined {
  const row = database.prepare(`${selectPartyAnswers} WHERE statements.id = ?`).get(partyId, statementId);

  return row ? rowToPartyAnswer(row) : undefined;
}
