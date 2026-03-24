# Core API Foundation

`services/core-api` is the modular-monolith runtime foundation for the core platform contexts implemented in this slice.

## Runtime

- Framework: NestJS
- HTTP platform: Fastify
- Persistence: SQLite (file path from `CORE_API_DB_PATH`)

## Local development

From `services/core-api`:

- `npm install`
- `npm run migrate`
- `npm run start:dev`
- `npm test`

Default environment values:

- `CORE_API_PORT=3000`
- `CORE_API_DB_PATH=./data/core-api.sqlite`

## Migration convention

Migrations are SQL files in:

- `src/infrastructure/persistence/migrations`

They are applied in lexical filename order and tracked in `core_schema_migrations`.
