import type { SQLOutputValue } from 'node:sqlite';
import type { StatementDetails, StatementRecord } from '../types/statement.interface';

export const statementColumns = `
  id, text, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt,
  title, theme, explanation, consequence, arguments_for AS argumentsFor, arguments_against AS argumentsAgainst
`;

function optionalText(value: SQLOutputValue): string | null {
  return typeof value === 'string' ? value : null;
}

// Argumenten staan als JSON-lijst in de database; een ontbrekende of onleesbare waarde wordt een lege lijst.
function textList(value: SQLOutputValue): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  }
  catch {
    return [];
  }
}

export function rowToStatementDetails(row: Record<string, SQLOutputValue>): StatementDetails {
  return {
    title: optionalText(row['title'] ?? null),
    theme: optionalText(row['theme'] ?? null),
    explanation: optionalText(row['explanation'] ?? null),
    consequence: optionalText(row['consequence'] ?? null),
    argumentsFor: textList(row['argumentsFor'] ?? null),
    argumentsAgainst: textList(row['argumentsAgainst'] ?? null),
  };
}

export function rowToStatement(row: Record<string, SQLOutputValue>): StatementRecord {
  const { id, text, isActive, createdAt, updatedAt } = row;

  if (typeof id !== 'number' || typeof text !== 'string' || typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    throw new Error('De database heeft ongeldige stellinggegevens teruggegeven.');
  }

  return { id, text, isActive: isActive === 1, createdAt, updatedAt, ...rowToStatementDetails(row) };
}
