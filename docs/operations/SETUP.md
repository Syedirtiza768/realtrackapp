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

Production note (2026-08-21): the eBay inventory-location reconciliation fix
was deployed with a backend-only Docker rebuild and the backend health endpoint
was verified before retrying Superior Auto Parts publication.

For high-volume eBay publishing, Redis must remain persistent and healthy so
durable jobs can resume after backend restarts. The optional
`EBAY_DAILY_PUBLISH_TARGET_LIMIT` setting defaults to 5,000 and cannot raise the
application maximum above 5,000 targets per organization per UTC day.
Native-OAuth single and bulk publishing also check eBay Developer Analytics' live Trading
API allowance before job creation. The per-organization target cap is not the
eBay application quota: listing migration, enrichment, reads, and revisions
share the allowance. If a submission reports low capacity, wait until the
reset timestamp in that response before resubmitting. Do not assume the reset
is at UTC midnight; on 2026-10-07 this keyset reported 07:00 UTC. A separate
migration or enrichment run should leave capacity for queued publish targets.
The Inventory-to-Trading migration now checks capacity before preflight, apply,
and each batch, reserving 1,000 calls for publishing. A low-capacity stop during
apply leaves the migration plan for a later run; do not schedule its resume at UTC midnight
unless Analytics actually reports that reset time.

For confirmed `AddFixedPriceItem failed (518)` targets, run
`node /app/tools/requeue-ebay-518-failures.mjs --account-id=<connected-account-uuid> --since-hours=24`
inside the backend container first. The dry run reports one target per product,
excludes products with a published channel or another active/successful target,
and prints eBay's current remaining calls and reset time. After verifying the
selection and obtaining approval to create live listings, add `--canary --apply`
and exact `--confirm-account-id=<uuid> --confirm-count=1` for one target.
Verify its eBay Item ID and channel mapping before running a fresh dry run for
the remaining products, then apply with the new exact `--confirm-count`.
The tool saves the original target records under `/app/output` before requeueing.
If a queue write fails after a target is marked pending, stop and reconcile that
target's database and BullMQ state before retrying; never blindly rerun the
whole set. eBay API code 518 is a quota failure; other eBay validation errors
need separate fixes.

### Convert recent Inventory-managed eBay listings

After deploying the Trading API release, run the migration from the backend
container. The plan step only reads eBay and saves a resumable plan under the
persistent `/app/output` mount. Review its eligible, already-Trading, and
skipped counts before applying. Applying withdraws each old Inventory offer,
creates a Trading API replacement, and updates the app's listing mappings. The
new eBay ItemID differs from the old one. Apply processes at most 250 listings
per run and stops when eBay reports a listing-rate limit; rerun it to continue.

```bash
docker exec realtrackapp-backend-1 node /app/tools/migrate-recent-ebay-inventory-listings.mjs --plan
docker exec realtrackapp-backend-1 node /app/tools/migrate-recent-ebay-inventory-listings.mjs --apply-plan
```

Do not remove the saved plan while any channel row has
`last_error_code='TRADING_MIGRATION_PENDING'`; rerunning the apply step resumes
from live offer state. A full active-list index is loaded only when a pending
migration's old offer is missing and the runner must locate a possible
replacement by SKU. If rollback recreated an Inventory offer, resume uses its
current mapped offer ID as long as the original ItemID is still current. Normal
apply runs verify each replacement ItemID directly and sample one old ItemID
per account/marketplace group. Verification stops after an eBay usage-limit
response, and an unresolved rollback or pending listing stops later migration
batches. Verify the output summary and compare the remaining published
`offer_id` mappings for the 30-day window before cleaning up the saved plan and
result files.

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
