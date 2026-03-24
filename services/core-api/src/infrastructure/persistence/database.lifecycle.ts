import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { DATABASE_CONNECTION } from './persistence.tokens.js';
import { SqliteDatabase } from './sqlite-database.js';

@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CONNECTION) private readonly database: SqliteDatabase) {}

  onApplicationShutdown(): void {
    this.database.close();
  }
}
