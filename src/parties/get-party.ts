import type { DatabaseSync } from 'node:sqlite';
import type { Party } from '../types/party.interface';
import { partySelectColumns, rowToParty } from './row-to-party';

export function getPartyById(database: DatabaseSync, id: number): Party | undefined {
  const row = database.prepare(`SELECT ${partySelectColumns} FROM parties WHERE id = ?`).get(id);

  return row ? rowToParty(row) : undefined;
}
