import path from 'node:path';
import { loadAppConfig } from '../../config/app-config.js';
import { applyMigrations } from './migration-runner.js';
import { SqliteDatabase } from './sqlite-database.js';

const config = loadAppConfig();
const database = new SqliteDatabase(config.databasePath);

try {
  applyMigrations(database, path.resolve(process.cwd(), 'src', 'infrastructure', 'persistence', 'migrations'));
  console.log(`Migrations applied successfully to ${config.databasePath}`);
} finally {
  database.close();
}
