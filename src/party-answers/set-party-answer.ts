import type { DatabaseSync } from 'node:sqlite';
import type { PartyAnswerInput } from '../types/party-answer.interface';

export function setPartyAnswer(database: DatabaseSync, partyId: number, statementId: number, input: PartyAnswerInput): void {
  if (input.answer === null) {
    database.prepare('DELETE FROM party_answers WHERE party_id = ? AND statement_id = ?').run(partyId, statementId);

    return;
  }

  const result = input.explanation === undefined
    ? database.prepare('UPDATE party_answers SET answer = ? WHERE party_id = ? AND statement_id = ?').run(input.answer, partyId, statementId)
    : database.prepare('UPDATE party_answers SET answer = ?, explanation = ? WHERE party_id = ? AND statement_id = ?')
        .run(input.answer, input.explanation, partyId, statementId);

  if (Number(result.changes) === 0) {
    database.prepare('INSERT INTO party_answers (party_id, statement_id, answer, explanation) VALUES (?, ?, ?, ?)')
      .run(partyId, statementId, input.answer, input.explanation ?? null);
  }
}
