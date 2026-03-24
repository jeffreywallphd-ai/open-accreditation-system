import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../app.module.js';
import { APP_CONFIG } from '../infrastructure/persistence/persistence.tokens.js';
import { resolveAppConfig, AppConfig } from '../config/app-config.js';
import { DomainErrorFilter } from '../common/http/domain-error.filter.js';

export async function createCoreApiApp(overrides: Partial<AppConfig> = {}): Promise<NestFastifyApplication> {
  const config = resolveAppConfig(overrides);

  process.env.CORE_API_PORT = `${config.port}`;
  process.env.CORE_API_DB_PATH = config.databasePath;

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });

  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}

export function getAppConfig(app: NestFastifyApplication): AppConfig {
  return app.get(APP_CONFIG);
}
