# Database & background jobs

**Last reviewed:** 2026-08-06

PostgreSQL via TypeORM, Redis-backed BullMQ for background work. Both live inside
`backend/`.

## Database
- PostgreSQL 16 (`postgres:16-alpine` in `docker-compose.yml`)
- TypeORM entities under `backend/src/*/entities` (per module)
- Migrations under `backend/src/migrations/`, run via `npm run migration:*` from
  `backend/`
- **`DB_SYNCHRONIZE` must never be enabled** — production runs migrations on boot
  (`DB_MIGRATIONS_RUN=true`, `DB_MIGRATIONS_AT_ENTRYPOINT=true` in `.env.example`)
- Known DB-typing issue: TEXT-typed price/quantity columns, partially fixed by a
  migration (per [[../context/CURRENT_STATE|CURRENT_STATE.md]] "What Is Broken") —
  not independently re-verified here
- The database name is `listingpro` (`.env.example` `DB_NAME`) even though the app
  is branded RealTrackApp — see the branding-inconsistency note in
  [[../context/CURRENT_STATE|CURRENT_STATE.md]]

## Background jobs
- Redis 7 (`redis:7-alpine`)
- BullMQ queues configured via `@nestjs/bullmq`; ~14 queues per
  [[../context/CURRENT_STATE|CURRENT_STATE.md]]
- `REDIS_SOCKET_ADAPTER` env flag enables Socket.IO's Redis adapter for
  cross-replica WebSocket rooms when running multiple backend instances
- Scheduler leader election uses a Redis lock (disable only for single-instance
  dev, per `.env.example` comments)

## Deep dives (pre-existing, more detail than this note)
- [[../architecture/DATABASE_SCHEMA|Database schema]] (Aug 6 — most recently
  updated of the database docs; prefer this over the older
  [[../architecture/database|architecture/database.md]] (Jul 18) and the
  root-level [[../DATABASE_MAP|DATABASE_MAP.md]] (Jul 18))
- [[../backend/DATABASE_MODELS|Database models]]
- [[../backend/BACKGROUND_JOBS|Background jobs]]

## Open questions / TODO
- Not verified in this pass: exact list of the ~14 BullMQ queues and their
  concurrency settings — see `docs/backend/BACKGROUND_JOBS.md` and grep
  `backend/src/**/*.processor.ts` for the current, authoritative list.
- Foreign keys are reportedly missing on some entity relationships (per
  [[../context/CURRENT_STATE|CURRENT_STATE.md]]) — not independently re-verified.
