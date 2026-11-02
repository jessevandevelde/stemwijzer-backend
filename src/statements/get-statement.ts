import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type { PublicPartyAnswer, StatementResult } from '../types/statement.interface';
import { rowToStatementDetails } from './row-to-statement';

function rowToPublicPartyAnswer(row: Record<string, SQLOutputValue>): PublicPartyAnswer {
  const { partyId, partyName, abbreviation, color, answer, explanation } = row;

  if (typeof partyId !== 'number' || typeof partyName !== 'string'
    || (answer !== null && answer !== 'eens' && answer !== 'neutraal' && answer !== 'oneens')) {
    throw new Error('De database heeft ongeldige partijantwoorden teruggegeven.');
  }

  return {
    partyId,
    partyName,
    abbreviation: typeof abbreviation === 'string' ? abbreviation : null,
    color: typeof color === 'string' ? color : null,
    answer,
    explanation: typeof explanation === 'string' ? explanation : null,
  };
}

export function getStatement(database: DatabaseSync, index: number): StatementResult | undefined {
  const statement = database.prepare(`
    SELECT id, text, title, theme, explanation, consequence, arguments_for AS argumentsFor, arguments_against AS argumentsAgainst
    FROM statements
    WHERE is_active = 1
    ORDER BY id
    LIMIT 1 OFFSET ?
  `).get(index);

  if (!statement || typeof statement['id'] !== 'number' || typeof statement['text'] !== 'string') {
    return undefined;
  }

  const answers = database.prepare(`
    SELECT parties.id AS partyId, parties.name AS partyName, parties.abbreviation, parties.color,
           party_answers.answer, party_answers.explanation
    FROM parties
    LEFT JOIN party_answers ON party_answers.id = (
      SELECT id FROM party_answers
      WHERE party_id = parties.id AND statement_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    )
    WHERE parties.is_active = 1
    ORDER BY parties.id
  `).all(statement['id']);

  return {
    index,
    id: statement['id'],
    text: statement['text'],
    ...rowToStatementDetails(statement),
    partyAnswers: answers.map(rowToPublicPartyAnswer),
  };
}
