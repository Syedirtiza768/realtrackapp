> ⚠️ MOVED → [/docs/architecture/DEPLOYMENT.md](DEPLOYMENT.md) (2026-06-06)

# Deployment Architecture

## Topology

Four Docker Compose services (`docker-compose.yml`):

```
            ┌─────────────┐
 browser ──▶│ frontend    │  nginx:1.27-alpine, serves built Vite assets
            │ :8050 → :80 │  reverse-proxies /api → backend (see nginx.conf)
            └──────┬──────┘
                   │ /api
            ┌──────▼──────┐
            │ backend     │  NestJS, node:20-alpine, :4191
            │             │  depends_on postgres+redis (healthy)
            └──┬───────┬──┘
       ┌───────▼─┐  ┌──▼────────┐
       │ postgres│  │ redis     │
       │ :5432   │  │ :6379     │
       │ 16-alp. │  │ 7-alpine  │
       └─────────┘  └───────────┘
   volumes: pgdata, redisdata, uploads
```

## Build

- **Frontend** (`Dockerfile`, root context): multi-stage — `npm run build`
  (`tsc -b && vite build`) → static assets served by nginx (`docker/nginx.conf`).
  Until 2026-10-07 the image ran `vite build` alone, which skipped type-checking.
- **Backend** (`backend/Dockerfile`): multi-stage — install all deps → `nest build`
  → production image with `--omit=dev` deps running `node dist/main.js`.

## Runtime config highlights

- Backend container: `NODE_ENV=production`, `IGNORE_ENV_FILE=true` (config comes
  from compose `environment`, not a mounted `.env`), `PORT=4191`,
  `PIPELINE_PROJECT_ROOT=/app`.
- Pipeline path resolution validates that the configured root contains
  `scripts/ebay-enrichment-pipeline.mjs`; if the variable is missing or stale,
  it falls back to the backend working directory and then its parent. This
  keeps Docker runs rooted at `/app` and local `backend/` runs rooted at the
  repository checkout.
- `NODE_OPTIONS=--max-old-space-size=1536` (default, AWS t3.medium / 4 GB RAM) —
  large CSV catalog imports load the file into the V8 heap. Raise on larger
  instances (e.g. `3072` on t3.large). Includes IPv4-first DNS for Docker.
- Postgres container: `shared_buffers=128MB`, `max_connections=50` (t3.medium).
- Redis container: `maxmemory 256mb`, `noeviction`. BullMQ requires
  `noeviction` so queue metadata cannot be silently evicted under cache
  pressure; the `redisdata` volume preserves queue state across restarts.
- `JWT_SECRET` is **required** (compose fails fast if unset).
- `DB_MIGRATIONS_RUN=true` by default → migrations run on backend boot.
- Postgres seeds from `listingpro.dump` on first volume init (idempotent-ish;
  `pg_restore` warnings on existing objects are tolerated).
- eBay listing template `.xlsx` files are mounted read-only into the backend.
- Durable eBay bulk publishing uses the existing Redis/BullMQ service and
  `ebay_listing_jobs` tables. `EBAY_DAILY_PUBLISH_TARGET_LIMIT` defaults to and
  is hard-capped at 5,000 listing/store targets per organization per UTC day.
- Pending catalog fitment publishing uses the `listing-optimization` queue.
  `backend/src/scripts/queue-pending-fitment-publish.ts --apply` enqueues
  forced MVL validation jobs; only validated rows are synchronized to already
  published eBay channels, while rejected/review-only rows remain unpublished.

## Healthchecks

- backend: `wget http://localhost:4191/api/health` (start_period 120s).
- postgres: `pg_isready`; redis: `redis-cli ping`.
- frontend `depends_on` backend healthy.

## Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `pgdata` | postgres data | Persistent DB |
| `redisdata` | redis data | Queue/cache persistence |
| `uploads` | `/app/uploads` | Uploaded files (catalog/images) |
| `./scripts` (ro), `./output` | backend | Pipeline scripts/output |

## Alternative: PM2 (non-Docker)

`ecosystem.config.cjs` runs the built backend (`backend/dist/main.js`) under PM2
(`realtrackapp-backend`, fork mode, 500M restart, logs to `../logs/`). `deploy.sh`
is a shell deploy helper. nginx config also at repo-root `nginx.conf`.

## Domains / CORS

- Production host referenced: `mhn.realtrackapp.com` (in default CORS + nginx).
- CORS allow-list from `CORS_ORIGIN` (comma-separated) or built-in defaults
  (`localhost:3911`, `localhost:8050`, `mhn.realtrackapp.com`).

## Operational runbook

Step-by-step deploy/rollback: [/docs/operations/deployment-runbook.md](../operations/deployment-runbook.md).

The eBay inventory-location reconciliation fix was deployed to the production
backend with a backend-only Docker rebuild on 2026-08-21; the production health
endpoint and running compiled markers were verified afterward.

The Trading API migration runner is packaged in the backend image at
`/app/tools/migrate-recent-ebay-inventory-listings.mjs`. The `/app/scripts`
directory is bind-mounted from the production checkout, so the runner uses a
separate image path that the mount cannot hide. It uses a small
NestJS/TypeORM context with only the eBay clients and required repositories, so
running it does not start the app's queue processors or scheduled jobs. The
two-stage plan/result files live under persistent `/app/output`; see the
[production setup steps](../operations/SETUP.md#convert-recent-inventory-managed-ebay-listings).
Apply runs avoid scanning every seller's full active inventory: normal
conversion verifies each replacement ItemID directly and samples one old
ItemID per account/marketplace group. A full active-list index is loaded only
when recovering a pending migration whose old offer is no longer available.
Verification stops after the first eBay usage-limit response, and an
unresolved rollback or pending listing stops later migration batches.

## Production release checkout safety

The `app.omnicoreholding.com` host has an operator checkout at
`/home/ubuntu/realtrackapp` with local changes and persistent bind-mounted
configuration and data. Do not pull, reset, clean, or switch that checkout during
a routine release. Build from the clean `/home/ubuntu/realtrackapp-release`
checkout pinned to the pushed `main` commit. Keep the established Compose
configuration, `.env`, uploads volume, and host data mounts; use a per-commit
override for the release image tags and build contexts. Recreate only the
application services unless a reviewed change explicitly requires infrastructure
changes. The Fashion quick capture release was deployed this way from `b63261e8`
on 2026-10-09.

### Add Part photo identity release — 2026-10-09

Main commit `217d09e3568e441310fc2e1c0437c08ef720a1ec` was built from a clean
archive at `/home/ubuntu/realtrackapp-add-part-photo-identity-217d09e3`. The
image-only override is
`/home/ubuntu/realtrackapp-add-part-photo-identity-217d09e3.override.yml` and
selects `realtrackapp-backend:add-part-photo-identity-217d09e3` and
`realtrackapp-frontend:add-part-photo-identity-217d09e3`. It was applied with
the active production Compose files using
`up -d --no-deps --no-build --pull never backend frontend`. PostgreSQL, Redis,
and PgBouncer were left running.
Verification returned backend `/api/health` with database and heap up, HTTP 200
for the frontend root and `/listings/new`, and healthy/running application
containers. The prior `main-b63261e` application images remain available for
rollback by selecting those image tags in a rollback override.
