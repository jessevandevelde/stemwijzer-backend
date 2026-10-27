import type { DatabaseSync } from 'node:sqlite';
import type { Party } from '../types/party.interface';
import { partySelectColumns, rowToParty } from './row-to-party';

export function listParties(database: DatabaseSync): Party[] {
  const rows = database.prepare(`SELECT ${partySelectColumns} FROM parties ORDER BY id`).all();

  return rows.map(rowToParty);
}
