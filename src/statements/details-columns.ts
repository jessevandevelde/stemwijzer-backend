import type { SQLInputValue } from 'node:sqlite';
import type { StatementDetails } from '../types/statement.interface';

// Vertaalt de opgegeven toelichtingsvelden naar kolommen; argumenten worden als JSON-lijst opgeslagen.
export function detailColumns(details: Partial<StatementDetails>): (readonly [string, SQLInputValue])[] {
  const columns: (readonly [string, SQLInputValue])[] = [];

  if (details.title !== undefined) {
    columns.push(['title', details.title]);
  }

  if (details.theme !== undefined) {
    columns.push(['theme', details.theme]);
  }

  if (details.explanation !== undefined) {
    columns.push(['explanation', details.explanation]);
  }

  if (details.consequence !== undefined) {
    columns.push(['consequence', details.consequence]);
  }

  if (details.argumentsFor !== undefined) {
    columns.push(['arguments_for', JSON.stringify(details.argumentsFor)]);
  }

  if (details.argumentsAgainst !== undefined) {
    columns.push(['arguments_against', JSON.stringify(details.argumentsAgainst)]);
  }

  return columns;
}
