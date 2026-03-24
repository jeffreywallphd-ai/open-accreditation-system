import path from 'node:path';

export type AppConfig = {
  port: number;
  databasePath: string;
};

const DEFAULT_PORT = 3000;
const DEFAULT_DB_RELATIVE_PATH = path.join('data', 'core-api.sqlite');

export function loadAppConfig(): AppConfig {
  const port = Number.parseInt(process.env.CORE_API_PORT ?? `${DEFAULT_PORT}`, 10);

  const databasePath = process.env.CORE_API_DB_PATH
    ? path.resolve(process.env.CORE_API_DB_PATH)
    : path.resolve(process.cwd(), DEFAULT_DB_RELATIVE_PATH);

  return {
    port: Number.isFinite(port) ? port : DEFAULT_PORT,
    databasePath,
  };
}

export function resolveAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const base = loadAppConfig();
  return {
    port: overrides.port ?? base.port,
    databasePath: overrides.databasePath ?? base.databasePath,
  };
}
