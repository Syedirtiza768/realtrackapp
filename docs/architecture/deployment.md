> ⚠️ MOVED → [/docs/architecture/DEPLOYMENT.md](DEPLOYMENT.md) (2026-06-06)

# Deployment Architecture

## Parts Search portal and Needs Review badge (2026-10-27)

Production now runs backend image `realtrackapp-backend:parts-search-20261027-4fc25e79` and frontend image `realtrackapp-frontend:parts-search-20261027-49d1dfe7`. Both are layered on the previously live images (`fashion-import-recovery-25mp-20261022-1c389779`, `catalog-condition-icon-20261021-r1`); rollback tags `rollback-parts-search-20261027-4fc25e79` and `rollback-parts-search-20261027-49d1dfe7` point at them. Release folders: `/home/ubuntu/realtrackapp-parts-search-20261027-4fc25e79/` and `/home/ubuntu/realtrackapp-frontend-parts-search-20261027-49d1dfe7/` (Dockerfile, Compose override, rollback override, rollout script, recorded Compose args).

- **Backend layer:** adds `dist/src/parts-search/` and main's `app.module.js` (identical to the live file apart from the module import). `rbac/permission-registry.js` was deliberately not replaced: the live file has the Primemotive permissions `published_listings.external_feed` / `published_listings.sales.notify`, which main lacks, and lacks main's `stock.*` permissions. Only the `'parts-search': 'dashboard.view'` sidebar key was patched in. Reconcile that file with main before any full backend rebuild.
- **Frontend:** built from main `49d1dfe7`. Before the switch, the live bundle's user-visible strings were compared with the new build; the only live-only change (the "Needs Review" badge from an uncommitted `dist/`) was committed to main first, so nothing live was dropped.
- **Checks:** backend healthy; `/api/parts-search/*` routes mapped; container reaches `https://partsbazar360.com/api/v1/search`; `/api/parts-search/status` → 401 unauthenticated; `/`, `/parts-search`, `/parts-search/login`, `/auto-parts` → 200 with bundle `index-D15VAWcc.js`; `nginx -t` passes in the running container. PostgreSQL, Redis and PgBouncer containers unchanged.
- `PARTSBAZAR360_SEARCH_API_KEY` is not set yet, so the portal serves the PartsBazar360 buyer view. `docker compose` must run with `sudo` on this host (some override files are root-only).

## Fashion catalogue workbook import completion (2026-10-23)

Production import `a93b9937-2135-4300-b3a2-580ec407f582` for `catalogue-export-2026-10-20 (1).xlsx` completed at `2026-10-23 17:30:44 UTC` with all 13,209 rows processed: 13,162 inserted, 0 updated, 4 duplicates, 43 flagged for review, and 0 invalid. The outcomes reconcile to the workbook total.

The final `catalog_products` aggregate contained 13,135 products with application S3-mirrored image URLs, 27 with no stored image URLs, and 0 with non-empty image URLs outside the mirror. Backend logs contained 218 source-image HTTP 403 mirror-warning entries during the 30-minute completion window; the final aggregate showed no remaining unmirrored URLs. The backend, PostgreSQL, and Redis were healthy, BullMQ active/wait counts were 0, and job progress was 100% at verification.

## Fashion catalogue import recovery (2026-10-22)

Main commit 250b94f7 adds persisted row checkpoints, idempotent resume, bounded BullMQ stalled-job recovery and retry handling, plus a final repair pass for incomplete Fashion image mirrors. Production backend image `realtrackapp-backend:fashion-import-recovery-20261022-250b94f7` was built as an overlay on the existing Fashion catalogue import image and deployed by recreating only the backend service.

The backend became healthy and /api/health returned HTTP 200. The active workbook import resumed from 500 to 750 of 13,209 rows after the worker restart. The frontend, PostgreSQL, Redis and PgBouncer stayed running; no schema migration was needed. The saved backend-only rollback override is in `/home/ubuntu/realtrackapp-fashion-import-recovery-20261022-250b94f7/rollback.yml`; rollback image `realtrackapp-backend:rollback-fashion-import-recovery-20261022-250b94f7`.

Main commit 3b9247f2 added a 20 MP input-pixel cap scoped to Fashion imports after twelve sampled source photos measured 4,284 × 4,284 pixels (18.35 MP), just above the shared image limit. WebP output remains capped at 2,048 pixels with quality 85. Production backend image `realtrackapp-backend:fashion-import-recovery-20mp-20261022-3b9247f2` passed its compiled-code checks and `/api/health` returned HTTP 200. Only the backend was recreated; the frontend, PostgreSQL, Redis and PgBouncer container IDs were unchanged. The active import's worker job was live after restart; the UI still showed processing at 750 of 13,209 rows at the time of verification. Rollback image `realtrackapp-backend:rollback-fashion-import-recovery-20mp-20261022-3b9247f2` and rollback override are retained under `/home/ubuntu/realtrackapp-fashion-import-recovery-20mp-20261022-3b9247f2/`.\n\nMain commit 1c389779 raised the Fashion-only cap to 25 MP after seven remaining photos measured 5,712 × 4,284 pixels (24.46 MP), each below the 25 MB byte cap. Output remains 2,048-pixel WebP at quality 85. Production image `realtrackapp-backend:fashion-import-recovery-25mp-20261022-1c389779` passed compiled-code checks and `/api/health` returned HTTP 200; only the backend was recreated and other container IDs were unchanged. BullMQ reclaimed the active job after its prior lock expired; the UI advanced to 1,250 of 13,209 rows and the import remained processing during verification. Rollback image and override are retained under `/home/ubuntu/realtrackapp-fashion-import-recovery-25mp-20261022-1c389779/`.


## Fashion source catalogue import (2026-10-21)

Commit `b95045cd2ca5731af1db1b40a090625731dac04b` is deployed as
`realtrackapp-backend:fashion-catalog-import-20261021-b95045cd` and
`realtrackapp-frontend:fashion-catalog-import-20261021-b95045cd`. The backend
image layers the Artistic Server import and Fashion export modules over the
active `primemotive-feedback-20261015-r5` image; the frontend layers the new
Fashion import/editor bundle over `publish-workspace-20261020-r3`. Deployment
reused each running service's saved Compose file list and appended the release
override, retaining production environment values and earlier fixes.

Only backend and frontend containers were recreated. PostgreSQL, Redis and
PgBouncer container IDs stayed unchanged. The feature uses the existing
`catalog_products.vertical_attributes` JSONB field, so no database migration
was added or applied. Public homepage, `/fashion/import`, its JavaScript asset,
and `/api/health` returned HTTP 200; the backend is healthy and frontend nginx
configuration is valid. No source workbook was imported during deployment.

Rollback images are
`realtrackapp-backend:rollback-fashion-catalog-import-20261021-b95045cd` and
`realtrackapp-frontend:rollback-fashion-catalog-import-20261021-b95045cd`.
The release directory `/home/ubuntu/realtrackapp-fashion-catalog-import-20261021-b95045cd/`
retains the image overlay files, rollback Compose override, rollout script and
exact pre-deploy Compose arguments. Run
`bash /home/ubuntu/realtrackapp-fashion-catalog-import-20261021-b95045cd/rollout.sh --rollback`
to restore the two previous application images.

## Fashion full screen camera deployment (2026-10-13)

The frontend runs `fashion-fullscreen-camera-20261013-a84fa885`. The backend
observed during this frontend-only rollout was `add-part-recovery-20261013-r1`
and was not recreated. Health and deployed browser scenarios pass, including
portrait, landscape and desktop camera/review coverage and non-sticky Save & Next.
For current recreation/rollback, use the saved Compose arguments under
`/home/ubuntu/realtrackapp-fashion-fullscreen-camera-20261013-a84fa885/`; they
preserve both services' current cumulative overrides. See
[release evidence](../operations/FASHION_CAPTURE_RELEASE_2026-10-13.md).

## Initial Fashion responsive capture rollout (2026-10-13; historical snapshot)

The following original image/override record is superseded by the full screen
frontend and subsequent backend hotfixes above; use the latest release's saved
arguments for recreation.

Production backend runs `fashion-camera-sku-20261013-45d396e4`; the frontend now
runs `fashion-save-flow-20261013-611f1018` after the frontend-only Save & Next
positioning correction. Its retained release directory is
`/home/ubuntu/realtrackapp-fashion-save-flow-20261013-611f1018/`.
The backend layers four Fashion compiled modules onto the prior production
image; the frontend rebuild retains cumulative production source fixes. Existing
environment values and database/cache services are preserved. No migrations ran.
The release is retained at
`/home/ubuntu/realtrackapp-fashion-camera-sku-20261013-45d396e4/`; reuse its saved
Compose arguments and overrides when recreating services. Prior images remain
under `rollback-fashion-camera-20261013` tags. Health, deployed browser scenarios,
the live allocator (rolled back) and real S3/photo serving checks passed. See
[release and rollback details](../operations/FASHION_CAPTURE_RELEASE_2026-10-13.md).

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

### Add Part photo identity reliability follow-up — 2026-10-09

Main commit `557a9206483830294db211adda24701452096b28` was built from the clean
`/home/ubuntu/realtrackapp-release` checkout pinned to that pushed `main` commit.
The per-commit override
`/home/ubuntu/realtrackapp-add-part-photo-identity-557a9206.override.yml`
selects `realtrackapp-backend:add-part-photo-identity-557a9206` and builds from
the release checkout's `backend/` directory. It was applied with the active
production Compose files using `up -d --no-deps --no-build --pull never backend`.
The frontend stayed on `realtrackapp-frontend:add-part-photo-identity-217d09e3`;
PostgreSQL, Redis, and PgBouncer stayed running. No schema change or migration
was part of this release. Verification showed the new backend image running and
healthy, with `/api/health` HTTP 200 and database and heap up. The prior backend
image tag remains available for rollback through an image-only override.
