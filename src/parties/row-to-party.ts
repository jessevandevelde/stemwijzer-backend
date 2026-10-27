import type { SQLOutputValue } from 'node:sqlite';
import type { Party } from '../types/party.interface';

export const partySelectColumns = `
  id, name, description, image_url AS imageUrl, abbreviation, color, seats, leader,
  is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
`;

function isNullableString(value: SQLOutputValue): value is string | null {
  return value === null || typeof value === 'string';
}

export function rowToParty(row: Record<string, SQLOutputValue>): Party {
  const { id, name, description, imageUrl, abbreviation, color, seats, leader, isActive, createdAt, updatedAt } = row;

  if (typeof id !== 'number' || typeof name !== 'string' || typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    throw new Error('De database heeft ongeldige partijgegevens teruggegeven.');
  }

  if (!isNullableString(description) || !isNullableString(imageUrl) || !isNullableString(abbreviation)
    || !isNullableString(color) || !isNullableString(leader) || (seats !== null && typeof seats !== 'number')) {
    throw new Error('De database heeft ongeldige partijgegevens teruggegeven.');
  }

  return { id, name, description, imageUrl, abbreviation, color, seats, leader, isActive: isActive === 1, createdAt, updatedAt };
}
