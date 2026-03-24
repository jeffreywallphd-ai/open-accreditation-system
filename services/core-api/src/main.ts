import { createCoreApiApp, getAppConfig } from './bootstrap/create-core-api-app.js';

async function bootstrap() {
  const app = await createCoreApiApp();
  const config = getAppConfig(app);
  await app.listen(config.port, '0.0.0.0');
}

bootstrap();
