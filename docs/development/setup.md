> ⚠️ MOVED → [/docs/operations/SETUP.md](../operations/SETUP.md) (2026-06-06)

# Development Setup

## Prerequisites

- Node.js 20+ (Docker images use node:20-alpine)
- npm
- Docker + Docker Compose (for the production-like full stack)
- A local PostgreSQL 16 and Redis 7 if running without Docker

## Option A — Full stack via Docker (recommended for parity)

```bash
cp .env.example .env          # fill in JWT_SECRET, OPENAI/EBAY/AWS keys as needed
docker compose up -d --build  # postgres, redis, backend, frontend
docker compose logs -f        # follow logs
```

- Frontend: http://localhost:8050
- Backend API: http://localhost:4191/api  (Swagger at `/api/docs` in non-prod)
- Postgres seeded from `listingpro.dump` on first run; migrations run on boot
  (`DB_MIGRATIONS_RUN=true`).

## Option B — Local dev (hot reload)

Run Postgres + Redis (Docker or local), then:

```bash
# Backend (from backend/)
cd backend
cp ../.env .env        # or create backend/.env (data-source.ts reads backend/.env)
npm install
npm run start:dev      # NestJS watch mode on :4191

# Frontend (from repo root, separate terminal)
npm install
npm run dev            # Vite on :3911, proxies /api → :4191
```

> Local Vite runs on **3911** (not 8050). The proxy in `vite.config.ts` forwards
> `/api` to the backend, so frontend code uses relative `/api/...` paths.

## Database / migrations

```bash
cd backend
npm run migration:run      # apply pending migrations
npm run migration:show     # status
npm run migration:generate # generate from entity diff (after editing entities)
npm run migration:revert   # revert last
```

Seed RBAC + demo data:

```bash
cd backend
# RBAC sync also runs on startup when RBAC_SYNC_PERMISSIONS=true
ts-node -r tsconfig-paths/register src/scripts/seed-rbac.ts
ts-node -r tsconfig-paths/register src/scripts/seed-demo-ebay.ts
```

## Build & test

```bash
# Frontend
npm run build      # tsc -b && vite build
npm run lint

# Backend (from backend/)
npm run build      # nest build
npm run lint
npm run test       # jest (sparse coverage today)
npm run test:e2e
```

## First credentials

Seed users are created from `DEFAULT_*_EMAIL` / `DEFAULT_*_PASSWORD` env vars when
`SEED_DEMO_USERS=true` (non-production). See [auth-rbac](../architecture/auth-rbac.md)
and `docs/RBAC.md`. Or register via `POST /api/auth/register` (gets `staff` role).

## Useful scripts

- `npm run import:inventory` (root) — import eBay inventory xlsx into frontend seed data.
- `scripts/` — eBay token/auth helpers, category fetchers, analyzers (Node + Python).
- `scripts/run-migrations.ps1` — Windows migration helper.

## Environment variables

Full table: [environment-variables.md](environment-variables.md).
