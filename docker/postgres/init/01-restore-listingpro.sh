#!/bin/bash
# Optional: seed Postgres from listingpro.dump on first volume init (docker-entrypoint-initdb.d).
set -euo pipefail

DUMP="/seed/listingpro.dump"
if [ ! -f "$DUMP" ]; then
  echo "No listingpro.dump at $DUMP — skipping seed (migrations will create schema)."
  exit 0
fi

echo "Restoring listingpro.dump into ${POSTGRES_DB}..."
pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-acl "$DUMP" || {
  echo "pg_restore finished with warnings (common when objects already exist)."
}
echo "listingpro.dump restore complete."
