import type { DatabaseSync } from 'node:sqlite';
import type { Answer } from '../types/answer.interface';

export function setPartyAnswer(database: DatabaseSync, partyId: number, statementId: number, answer: Answer | null): void {
  if (answer === null) {
    database.prepare('DELETE FROM party_answers WHERE party_id = ? AND statement_id = ?').run(partyId, statementId);

    return;
  }

  const result = database.prepare('UPDATE party_answers SET answer = ? WHERE party_id = ? AND statement_id = ?').run(answer, partyId, statementId);

  if (Number(result.changes) === 0) {
    database.prepare('INSERT INTO party_answers (party_id, statement_id, answer) VALUES (?, ?, ?)').run(partyId, statementId, answer);
  }
}
