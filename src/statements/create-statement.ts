import type { DatabaseSync } from 'node:sqlite';
import type { CreateStatementInput, StatementRecord } from '../types/statement.interface';
import { detailColumns } from './details-columns';
import { getStatementById } from './get-statement-by-id';

const technicalAdminEmail = 'statements-import@stemwijzer.invalid';

function ensureTechnicalAdmin(database: DatabaseSync): number {
  database.prepare(`
    INSERT INTO superadmins (name, email, password_hash)
    SELECT 'Stellingenimport', ?, '!disabled:statement-import'
    WHERE NOT EXISTS (SELECT 1 FROM superadmins WHERE email = ?)
  `).run(technicalAdminEmail, technicalAdminEmail);

  const row = database.prepare('SELECT id FROM superadmins WHERE email = ?').get(technicalAdminEmail);

  if (!row || typeof row['id'] !== 'number') {
    throw new Error('Kon geen technisch beheerdersaccount voor stellingen vinden of aanmaken.');
  }

  return row['id'];
}

export function createStatement(database: DatabaseSync, input: CreateStatementInput): StatementRecord {
  const createdBy = ensureTechnicalAdmin(database);

  const columns = [['text', input.text], ['created_by', createdBy], ['is_active', input.isActive ? 1 : 0], ...detailColumns(input)] as const;

  const result = database.prepare(`INSERT INTO statements (${columns.map(([name]) => name).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
    .run(...columns.map(([, value]) => value));

  const statement = getStatementById(database, Number(result.lastInsertRowid));

  if (!statement) {
    throw new Error('De database heeft geen aangemaakte stelling teruggegeven.');
  }

  return statement;
}
