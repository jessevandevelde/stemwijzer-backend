import type { DatabaseSync } from 'node:sqlite';
import type { StatementRecord } from '../types/statement.interface';
import { rowToStatement, statementColumns } from './row-to-statement';

export function getStatementById(database: DatabaseSync, id: number): StatementRecord | undefined {
  const row = database.prepare(`
    SELECT ${statementColumns}
    FROM statements
    WHERE id = ?
  `).get(id);

  return row ? rowToStatement(row) : undefined;
}
