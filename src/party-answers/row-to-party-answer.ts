import type { SQLOutputValue } from 'node:sqlite';
import type { PartyAnswerRecord } from '../types/party-answer.interface';

export function rowToPartyAnswer(row: Record<string, SQLOutputValue>): PartyAnswerRecord {
  const { statementId, statementText, statementIsActive, answer } = row;

  if (typeof statementId !== 'number' || typeof statementText !== 'string') {
    throw new Error('De database heeft ongeldige partijantwoorden teruggegeven.');
  }

  if (answer !== null && answer !== 'eens' && answer !== 'neutraal' && answer !== 'oneens') {
    throw new Error('De database heeft ongeldige partijantwoorden teruggegeven.');
  }

  return { statementId, statementText, statementIsActive: statementIsActive === 1, answer };
}
