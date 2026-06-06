# Setup

> **Source**: Consolidated from `docs/development/setup.md` and `docs/SETUP_AND_DEPLOYMENT.md` — 2026-05-29.
> For environment variables reference, see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).
> For deployment architecture, see [/docs/architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md).

---

## Prerequisites

- Node.js 20+ (Docker images use node:20-alpine)
- npm
- Docker + Docker Compose (for the production-like full stack)
- A local PostgreSQL 16 and Redis 7 if running without Docker

---

## Quick Start (Docker, Full Stack)

```bash
cp .env.example .env          # set JWT_SECRET (required) + any API keys
docker compose up -d --build  # postgres, redis, backend, frontend
docker compose logs -f
```

- Frontend: http://localhost:8050
- Backend API: http://localhost:4191/api (Swagger at `/api/docs` in non-prod)
- Postgres seeded from `listingpro.dump` on first run; migrations run on boot (`DB_MIGRATIONS_RUN=true`)

### Stop Services

```bash
docker compose down          # Stop all
docker compose down -v       # Stop and remove volumes (data loss!)
```

---

## Local Development (Hot Reload)

Run Postgres + Redis (Docker or local), then:

```bash
# Backend (from backend/)
cd backend
cp ../.env .env        # or create backend/.env
npm install
npm run start:dev      # NestJS watch mode on :4191

# Frontend (from repo root, separate terminal)
npm install
npm run dev            # Vite on :3911, proxies /api → :4191
```

> Local Vite runs on **3911** (not 8050). The proxy in `vite.config.ts` forwards `/api` to the backend.

---

## Database / Migrations

```bash
cd backend
npm run migration:run      # apply pending
npm run migration:show     # status
npm run migration:generate # generate from entity diff
npm run migration:revert   # revert last
```

Seed RBAC + demo data:

```bash
cd backend
ts-node -r tsconfig-paths/register src/scripts/seed-rbac.ts
ts-node -r tsconfig-paths/register src/scripts/seed-demo-ebay.ts
```

---

## Build & Test

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

---

## First Credentials

Seed users created from `DEFAULT_*_EMAIL` / `DEFAULT_*_PASSWORD` env vars when `SEED_DEMO_USERS=true` (non-production). Or register via `POST /api/auth/register` (gets `staff` role).

---

## Production Deployment

### Docker Compose

```bash
export NODE_ENV=production
cp .env.example .env  # fill with real secrets
docker compose up -d --build
curl http://localhost:4191/api/health  # verify
```

### PM2 Alternative

```bash
cd backend && npm ci && npm run build
pm2 start ecosystem.config.cjs
npm run build  # frontend (from root)
# Serve frontend dist/ via nginx (nginx.conf)
```

---

## Backups

```bash
# Database backup
docker compose exec postgres pg_dump -U postgres listingpro > backup.sql

# Restore from backup
docker compose exec -T postgres psql -U postgres listingpro < backup.sql

# Restore from seed dump
docker compose exec postgres psql -U postgres listingpro < listingpro.dump
```

---

## Health Checks

```bash
curl http://localhost:4191/api/health
# { "status": "ok", "services": { "database": "up", "redis": "up" } }
```

Docker services include healthchecks: backend (`wget /api/health`), postgres (`pg_isready`), redis (`redis-cli ping`).

---

*Consolidated & reorganized: 2026-06-06.*
