import type { DatabaseSync } from 'node:sqlite';
import type { StatementRecord } from '../types/statement.interface';
import { rowToStatement, statementColumns } from './row-to-statement';

export function listStatements(database: DatabaseSync): StatementRecord[] {
  const rows = database.prepare(`
    SELECT ${statementColumns}
    FROM statements
    ORDER BY id
  `).all();

  return rows.map(rowToStatement);
}
