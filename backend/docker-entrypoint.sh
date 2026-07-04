#!/bin/sh
set -e

# Run pending TypeORM migrations before the API starts (Docker deploy).
# Use DB_MIGRATION_HOST when set (e.g. postgres) so DDL bypasses PgBouncer transaction pooling.
if [ "${DB_MIGRATIONS_RUN:-false}" = "true" ] && [ "${DB_MIGRATIONS_AT_ENTRYPOINT:-true}" = "true" ]; then
  echo "[entrypoint] Running database migrations..."
  MIG_HOST="${DB_MIGRATION_HOST:-${DB_HOST}}"
  DB_HOST="$MIG_HOST" node ./node_modules/typeorm/cli.js migration:run -d dist/src/data-source.js
  echo "[entrypoint] Migrations complete."
fi

exec node dist/src/main.js
