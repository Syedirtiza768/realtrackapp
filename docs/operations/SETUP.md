# Setup

**MotoArk production update (2026-11-03):** The lifecycle endpoints and both
database migrations are deployed. `MOTOARK_ORDER_WEBHOOK_SECRET` is configured
as a separate key; the legacy receipt key is preserved. Keep marketplace stock
pushing disabled. A 200-row Primemotive sample had no inventory mappings, so
verified warehouse counts and mappings are required before pending purchase
events can apply. Outbound listing callbacks remain disabled until their URL,
separate key, and `PRIMEMOTIVE_LISTING_WEBHOOK_ORGANIZATION_ID` are configured.
See the [implementation contract](../architecture/MOTOARK_ORDER_LIFECYCLE.md)
and [production release record](MOTOARK_RELEASE_2026-11-02.md).

> **Production update (2026-10-14, catalog publishing safeguards):** Backend
> image `realtrackapp-backend:catalog-publish-holds-20261014-r2` and frontend
> image `realtrackapp-frontend:catalog-publish-holds-20261014-r1` now expose and
> enforce catalog review holds, and show eBay error-240 policy details when
> returned. Compose overrides and runtime environment were preserved; local and
> public health checks passed. No failed listings were retried. See the
> [deployment record](../architecture/DEPLOYMENT.md#catalog-review-holds-and-ebay-publish-diagnostics-2026-10-14).

> **Production update (2026-10-15, Primemotive integration feedback):** Backend
> image `realtrackapp-backend:primemotive-feedback-20261015-r5` now removes the
> Mercedes item-specific filter, supports 10,000-row CSV export pages, and
> records durable listing changes for polling and optional signed push delivery.
> The migration was applied after a verified database backup; local/public
> health and protected-route checks passed. Production returned 91,496 active
> Primemotive rows across API pages (including 10 marked test rows, 200 rows per
> page). The synthetic listing simulator is enabled. Outbound pushes need a
> callback URL and secret before delivery starts. See the
> [deployment record](../architecture/DEPLOYMENT.md#primemotive-integration-feedback-2026-10-15).

> **Production update (2026-10-13, Add Part recovery):** Backend image `realtrackapp-backend:add-part-recovery-20261013-r1` preserves the existing deployment stack and fixes photo identity false rejections and unbounded AI output reservations. See [recovery record](ADD_PART_RECOVERY_2026-10-13.md). Earlier image references below are historical.

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **Production deployment record (2026-10-20 catalog bulk-publish workspace scope):** See the [deployment architecture](../architecture/DEPLOYMENT.md#catalog-bulk-publish-workspace-scope-2026-10-20).

> **Source**: Consolidated from `docs/development/setup.md` and `docs/SETUP_AND_DEPLOYMENT.md` — 2026-05-29.
> For environment variables reference, see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).
> For deployment architecture, see [/docs/architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md).

> **Historical production update (2026-10-13; superseded 2026-10-15):** The backend then ran
> `realtrackapp-backend:primemotive-catalog-data-r3-20261013`; its Compose launch
> includes the Primemotive override and all API calls use the `/api` prefix.
> At that time the database feed was filtered to active Primemotive
> Mercedes-Benz rows. The export permission migration ran and sync status
> reflected the latest completed weekly mirror sync. See the historical
> [deployment record](../architecture/DEPLOYMENT.md#primemotive-mercedes-benz-listing-feed-2026-10-12).

> **Historical workspace follow-up (2026-10-14; deployed 2026-10-15):** The
> follow-up described above is now deployed. Production has the changes endpoint,
> optional signed outbound webhook, 10,000-row CSV export pages, and enabled
> synthetic-listing simulation; webhook delivery remains inactive until callback
> settings are supplied.

> **Production update (2026-10-11):** The health probe skips global throttling
> and now allows up to 1 GB heap use. The previous 512 MB threshold again marked
> a responsive backend unhealthy when heap reached 657.85 MB inside the 1.8 GB
> container limit. Production runs
> `realtrackapp-backend:health-heap-1024-20261011`, derived from the running
> backend image with only the health-controller threshold changed. At 07:57 UTC,
> direct/public health, runtime, and frontend root checks returned HTTP 200; all
> five containers were running and the backend was healthy. See the
> [deployment record](../architecture/DEPLOYMENT.md#current-production-backend-health-fix-2026-10-11).

> **Production update (2026-10-08):** Add Part lookup now fails fast when eBay
> Browse is rate-limited, the browser cancels stalled lookups after 45 seconds,
> and a draft can still save with a fallback title. Frontend and backend
> containers have been refreshed and health-checked; image tags and rollback
> details are in the
> [deployment architecture](../architecture/DEPLOYMENT.md#current-production-add-part-responsiveness-fix-2026-10-08).

> **Production update (2026-10-10):** Add Part now returns its saved draft before
> optional Image Drive lookup and attachment. The browser gives up waiting after
> 45 seconds and advises checking Inventory before retrying. Production uses the
> `add-part-save-timeout-20261010` frontend/backend images; both health endpoints
> and all five containers were checked after rollout. The signed-in save path
> still needs an authenticated browser session for a full UI submission check.
> See the [deployment record](../architecture/DEPLOYMENT.md#current-production-add-part-draft-first-fix-2026-10-10).

> **Initial production photo update (2026-10-10; superseded below):** Inventory Details now shows a larger,
> full-fit primary part photo and thumbnails for additional saved photos. The
> frontend-only release is `inventory-photo-fix-20261010`; the frontend root
> and `/api/health` returned HTTP 200, and backend health remained healthy.
> See the [deployment record](../architecture/deployment.md#initial-production-inventory-photo-display-fix-2026-10-10-superseded).

> **Production update (2026-10-10):** eBay publishing now caps each listing's
> available quantity at 10. The backend-only image is
> `realtrackapp-backend:ebay-quantity-cap-20261010`; the backend is healthy and
> `/api/health` reports database and memory up. See the
> [deployment record](../architecture/deployment.md#current-production-ebay-publish-quantity-cap-2026-10-10).

> **Production update (2026-10-10):** Removed the redundant Inventory Details
> “Part pictures” strip; the primary photo and the existing Product Images
> gallery/editor remain. Production frontend runs
> `inventory-photo-dedupe-20261010`; the frontend root and `/api/health` returned
> HTTP 200, with backend health `healthy`. See the
> [deployment record](../architecture/deployment.md#current-production-inventory-gallery-deduplication-fix-2026-10-10).

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

The temporary B&I compliance-publish bypass is disabled by default. If an
operator-led publishing window explicitly requires it, set
`BUSINESS_INDUSTRIAL_ALLOW_UNAPPROVED_PUBLISH=true` in the Compose environment,
recreate the backend, and set it back to `false` afterward.

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

For a frontend-only production fix, build a tagged frontend image from the
intended release source, update only the frontend image/build context in the
production Compose override, and recreate only `frontend` with the `--no-deps`
and `--no-build` options. Retain the prior image and override as the rollback
point; record the active image and source in `docs/context/CURRENT_STATE.md`.

Production note (2026-08-21): the eBay inventory-location reconciliation fix
was deployed with a backend-only Docker rebuild and the backend health endpoint
was verified before retrying Superior Auto Parts publication.

For high-volume eBay publishing, Redis must remain persistent and healthy so
durable jobs can resume after backend restarts. The optional
`EBAY_DAILY_PUBLISH_TARGET_LIMIT` setting defaults to 5,000 and cannot raise the
application maximum above 5,000 targets per organization per UTC day.

### Shared New-condition listing image backfill

The backend includes three WebP assets in `backend/assets/new-condition-listing-images/`.
After deploying a backend build that includes the assets, first run the
backfill in its default dry-run mode:

```bash
cd backend
npm run ebay:backfill-new-condition-images
```

Review the application row counts before applying. The apply mode uploads
missing shared WebP objects once, preserves the existing gallery order,
appends F1, F2, F3, and writes a JSON backup under `backend/output/` before
changing catalog, listing, or published-listing image fields in the
application. It does not call eBay APIs or revise live eBay listings. Apply
after reviewing the dry-run report:

```bash
npm run ebay:backfill-new-condition-images -- --apply
```

Use `--limit=N` for a bounded application-data canary; it limits rows per
application table. The runner uses a maintenance-only module with migrations,
schedulers, queue workers, and marketplace API clients disabled.

### PM2 Alternative

```bash
cd backend && npm ci && npm run build
pm2 start ecosystem.config.cjs
npm run build  # frontend (from root)
# Serve frontend dist/ via nginx (nginx.conf)
```

The Docker frontend's `docker/nginx.conf` also caches S3 and NAPA image proxy
responses in its 1 GB image cache. Keep `/api/storage/napa-image/` ahead of the
general `/api/` proxy location when changing the nginx config.

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

## Fashion workspace setup

1. Review migrations 1790300000000-AddProductVerticals and 1790400000000-CreateFashionWorkspaceSecurity.
2. Set the four FASHION_SEED_ADMIN variables in the backend environment and run backend npm run seed:fashion-admin.
3. Enable multi_vertical_catalog through the normal feature-flag change process, then explicitly enable Fashion on a sandbox store.
4. Test /fashion/login, a small Fashion import, authenticity approval, category metadata, and sandbox eBay OAuth before any production action.

This implementation does not run migrations, connect a live seller, publish to production, or deploy.

## Business & Industrial workspace setup (2026-09-09)

1. Review and apply `1790300000000-AddProductVerticals`,
   `1790400000000-CreateFashionWorkspaceSecurity`, and
   `1790500000000-BusinessIndustrialWorkspaceSecurity` through the normal
   migration review process. The agent does not run migrations automatically.
2. Set `BUSINESS_INDUSTRIAL_SEED_ADMIN_EMAIL` and
   `BUSINESS_INDUSTRIAL_SEED_ADMIN_PASSWORD` (at least 12 characters), then
   run `cd backend && npm run seed:business-industrial-admin`.
3. Enable `multi_vertical_catalog` through the feature-flag change process.
4. Test `/business-industrial/login`, the required first-login password change,
   a small B&I import, unit/category and shipping validation, compliance
   approval, sandbox eBay OAuth, policy sync, and publish-job inspection.
5. Configure `EBAY_WEBHOOK_SECRET` before enabling signed enforcement webhook
   delivery. Verify an incident withdraws tracked offers and blocks release
   until eBay reports `UNPUBLISHED`; retry/escalation paths must be tested with
   an intentionally unavailable offer.

The B&I workspace uses administrator-created accounts with temporary passwords
and explicit dedicated-store assignments rather than public invite acceptance.

### B&I AI image intake (2026-09-10)

Apply `1790800000000-CreateBusinessIndustrialImageIntake` through the normal
migration review process before using `/business-industrial/image-intake`.

For an interrupted production Drive run, use the scoped backend command
`npm run bi:repair -- <operator-user-id> <job-id> [job-id ...]`. It resets only
groups that have been in `processing` for more than 15 minutes, separates
repeated folder names from different authorized roots with deterministic
`BNI-` collision suffixes, and never publishes to eBay.
Configure the existing `OPENAI_API_KEY`/model-routing settings, AWS S3
credentials, Redis/BullMQ, and eBay Taxonomy credentials. Test a small folder
tree first, including `BNI-20`, `BNI-20.1`, and `BNI-20.2`, and confirm the
result is one group with quantity 3. Verify the generated category/aspects,
Excel export, draft creation, compliance approval, and sandbox eBay validation
before production publishing. For an explicitly authorized operator-led
backfill, append `--operator-authorized-ready` to mark the repaired B&I
records ready without publishing them. Validate the exact intake scope with:
`node dist/src/scripts/audit-business-industrial-publish-readiness.js
<ebay-account-id> EBAY_US <job-id> [job-id ...] --exit-after-report`.

## Fashion quick capture (2026-09-28)

- Run migrations (`npm run migration:run` in `backend/`) to create `fashion_warehouses` and `fashion_sku_counters`.
- Add warehouses in Fashion settings before using Quick capture's warehouse field.
- Local (non-Docker) backends need a system font for size-chart/banner text; Windows and macOS have one. The Docker image installs `fonts-dejavu-core`.
- Background identification uses the existing Redis/BullMQ connection and `OPENAI_API_KEY` and optionally `FASHION_AI_MODEL` / `FASHION_AI_FALLBACK_MODEL` (code defaults are the Jev-selected models). See docs/architecture/FASHION_QUICK_CAPTURE.md.
