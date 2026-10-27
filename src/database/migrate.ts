import type { DatabaseSync } from 'node:sqlite';

// Kolommen die later aan parties zijn toegevoegd; schema.sql maakt ze alleen aan in een nieuwe database.
const partyColumns: readonly (readonly [string, string])[] = [
  ['abbreviation', 'VARCHAR(20) CHECK (length(abbreviation) <= 20)'],
  ['color', 'VARCHAR(7) CHECK (length(color) = 7)'],
  ['seats', 'INTEGER CHECK (seats BETWEEN 0 AND 150)'],
  ['leader', 'VARCHAR(100) CHECK (length(leader) <= 100)'],
];

export function migrateDatabase(database: DatabaseSync): void {
  const existing = new Set(database.prepare('PRAGMA table_info(parties)').all().map(column => column['name']));
  const missing = partyColumns.filter(([name]) => !existing.has(name));

  if (missing.length === 0) {
    return;
  }

  database.exec('BEGIN IMMEDIATE');

  try {
    for (const [name, definition] of missing) {
      database.exec(`ALTER TABLE parties ADD COLUMN ${name} ${definition}`);
    }

    database.exec(`
      DROP TRIGGER IF EXISTS parties_updated_at;
      CREATE TRIGGER parties_updated_at
      AFTER UPDATE OF name, description, image_url, abbreviation, color, seats, leader, is_active ON parties
      BEGIN
          UPDATE parties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
    database.exec('COMMIT');
  }
  catch (error: unknown) {
    database.exec('ROLLBACK');

    throw error;
  }
}
