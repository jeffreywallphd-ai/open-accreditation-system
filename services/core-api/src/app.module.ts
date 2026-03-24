import path from 'node:path';
import { Module } from '@nestjs/common';
import { APP_CONFIG, DATABASE_CONNECTION } from './infrastructure/persistence/persistence.tokens.js';
import { resolveAppConfig } from './config/app-config.js';
import { SqliteDatabase } from './infrastructure/persistence/sqlite-database.js';
import { applyMigrations } from './infrastructure/persistence/migration-runner.js';
import { DatabaseLifecycle } from './infrastructure/persistence/database.lifecycle.js';
import { OrganizationRegistryModule } from './modules/organization-registry/organization-registry.module.js';
import { IdentityAccessModule } from './modules/identity-access/identity-access.module.js';

@Module({
  imports: [OrganizationRegistryModule, IdentityAccessModule],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => resolveAppConfig(),
    },
    {
      provide: DATABASE_CONNECTION,
      inject: [APP_CONFIG],
      useFactory: (config) => {
        const database = new SqliteDatabase(config.databasePath);
        applyMigrations(database, path.resolve(process.cwd(), 'src', 'infrastructure', 'persistence', 'migrations'));
        return database;
      },
    },
    DatabaseLifecycle,
  ],
})
export class AppModule {}
