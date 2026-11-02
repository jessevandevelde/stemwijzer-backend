import type { DatabaseSync } from 'node:sqlite';

interface TableMigration {
  readonly table: string
  // Kolommen die later zijn toegevoegd; schema.sql maakt ze alleen aan in een nieuwe database.
  readonly columns: readonly (readonly [string, string])[]
  // De updated_at-trigger moet de nieuwe kolommen ook kennen, dus die wordt opnieuw aangemaakt.
  readonly trigger: string
}

const migrations: readonly TableMigration[] = [
  {
    table: 'parties',
    columns: [
      ['abbreviation', 'VARCHAR(20) CHECK (length(abbreviation) <= 20)'],
      ['color', 'VARCHAR(7) CHECK (length(color) = 7)'],
      ['seats', 'INTEGER CHECK (seats BETWEEN 0 AND 150)'],
      ['leader', 'VARCHAR(100) CHECK (length(leader) <= 100)'],
    ],
    trigger: `
      DROP TRIGGER IF EXISTS parties_updated_at;
      CREATE TRIGGER parties_updated_at
      AFTER UPDATE OF name, description, image_url, abbreviation, color, seats, leader, is_active ON parties
      BEGIN
          UPDATE parties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `,
  },
  {
    table: 'statements',
    columns: [
      ['title', 'VARCHAR(100) CHECK (length(title) <= 100)'],
      ['theme', 'VARCHAR(100) CHECK (length(theme) <= 100)'],
      ['explanation', 'TEXT'],
      ['consequence', 'TEXT'],
      ['arguments_for', 'TEXT'],
      ['arguments_against', 'TEXT'],
    ],
    trigger: `
      DROP TRIGGER IF EXISTS statements_updated_at;
      CREATE TRIGGER statements_updated_at
      AFTER UPDATE OF text, created_by, is_active, economic_weight, cultural_weight, title, theme, explanation, consequence, arguments_for, arguments_against ON statements
      BEGIN
          UPDATE statements SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `,
  },
  {
    table: 'party_answers',
    columns: [
      ['explanation', 'TEXT'],
    ],
    trigger: `
      DROP TRIGGER IF EXISTS party_answers_updated_at;
      CREATE TRIGGER party_answers_updated_at
      AFTER UPDATE OF party_id, statement_id, answer, explanation ON party_answers
      BEGIN
          UPDATE party_answers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `,
  },
];

function migrateTable(database: DatabaseSync, migration: TableMigration): void {
  const existing = new Set(database.prepare(`PRAGMA table_info(${migration.table})`).all().map(column => column['name']));
  const missing = migration.columns.filter(([name]) => !existing.has(name));

  if (missing.length === 0) {
    return;
  }

  database.exec('BEGIN IMMEDIATE');

  try {
    for (const [name, definition] of missing) {
      database.exec(`ALTER TABLE ${migration.table} ADD COLUMN ${name} ${definition}`);
    }

    database.exec(migration.trigger);
    database.exec('COMMIT');
  }
  catch (error: unknown) {
    database.exec('ROLLBACK');

    throw error;
  }
}

export function migrateDatabase(database: DatabaseSync): void {
  for (const migration of migrations) {
    migrateTable(database, migration);
  }
}
