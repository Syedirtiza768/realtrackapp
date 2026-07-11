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
  (Vite) → static assets served by nginx (`docker/nginx.conf`).
- **Backend** (`backend/Dockerfile`): multi-stage — install all deps → `nest build`
  → production image with `--omit=dev` deps running `node dist/main.js`.

## Runtime config highlights

- Backend container: `NODE_ENV=production`, `IGNORE_ENV_FILE=true` (config comes
  from compose `environment`, not a mounted `.env`), `PORT=4191`,
  `PIPELINE_PROJECT_ROOT=/app`.
- `NODE_OPTIONS=--max-old-space-size=1536` (default, AWS t3.medium / 4 GB RAM) —
  large CSV catalog imports load the file into the V8 heap. Raise on larger
  instances (e.g. `3072` on t3.large). Includes IPv4-first DNS for Docker.
- Postgres container: `shared_buffers=128MB`, `max_connections=50` (t3.medium).
- Redis container: `maxmemory 128mb`, `allkeys-lru`.
- `JWT_SECRET` is **required** (compose fails fast if unset).
- `DB_MIGRATIONS_RUN=true` by default → migrations run on backend boot.
- Postgres seeds from `listingpro.dump` on first volume init (idempotent-ish;
  `pg_restore` warnings on existing objects are tolerated).
- eBay listing template `.xlsx` files are mounted read-only into the backend.
- Durable eBay bulk publishing uses the existing Redis/BullMQ service and
  `ebay_listing_jobs` tables. `EBAY_DAILY_PUBLISH_TARGET_LIMIT` defaults to and
  is hard-capped at 5,000 listing/store targets per organization per UTC day.

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
