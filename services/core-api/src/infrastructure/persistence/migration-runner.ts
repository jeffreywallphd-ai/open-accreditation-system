import fs from 'node:fs';
import path from 'node:path';
import { SqliteDatabase } from './sqlite-database.js';

export function applyMigrations(database: SqliteDatabase, migrationsDirectory: string): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS core_schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const files = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const alreadyApplied = database.get<{ version: string }>(
      'SELECT version FROM core_schema_migrations WHERE version = @version',
      { version: file },
    );

    if (alreadyApplied) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf-8');

    database.transaction(() => {
      database.exec(sql);
      database.run(
        `
          INSERT INTO core_schema_migrations (version, applied_at)
          VALUES (@version, @appliedAt)
        `,
        {
          version: file,
          appliedAt: new Date().toISOString(),
        },
      );
    });
  }
}
