> ⚠️ MOVED → [/docs/architecture/DEPLOYMENT.md](DEPLOYMENT.md) (2026-06-06)

## B&I eBay OAuth callback destination — 2026-11-04

Production backend image `realtrackapp-backend:ebay-oauth-return-20261104-r1`
now follows the vertical-specific destination returned by the eBay OAuth
service. Successful B&I connections return to `/business-industrial/stores`,
which the B&I admin role can access. The release is a one-file overlay on the
active backend image; frontend, PostgreSQL, Redis, PgBouncer, and database
schema were unchanged. The previous image is retained as
`realtrackapp-backend:rollback-ebay-oauth-return-20261104-r1`. See the
[release record](../operations/EBAY_OAUTH_RETURN_2026-11-04.md).

## MotoArk lifecycle and quantity integration — 2026-11-03

The candidate image `realtrackapp-backend:motoark-lifecycle-20261102-candidate`
is a scoped overlay on `ebay-revise-00aad7cd`. It restores missing Primemotive
routes and adds lifecycle/quantity processing while preserving production
PartsSearch. The backend-only rollout completed after full pre-migration
archive verification. Both migrations are applied; local and public health
return 200; unauthenticated MotoArk and legacy sale routes return 401. The
separate lifecycle key is configured, legacy receipt key preserved, and
marketplace stock pushing remains off. The verified release record has the
[backup checksum, image IDs, production API checks, and rollback steps](../operations/MOTOARK_RELEASE_2026-11-02.md).

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

# Deployment Architecture

## Fashion catalog filter dropdowns (2026-11-04, main 057cfb0f)

Production frontend runs `realtrackapp-frontend:fashion-catalog-filters-20261104-057cfb0f`, built from main commit `057cfb0f` on the live `7fb85299` source lineage. The Fashion catalog presents brand, category, condition, status, stock, and Fashion-specific facets as horizontal dropdowns above results; remaining criteria stay in Advanced Filters. Business & Industrial keeps its desktop filter column.

- **Base and rollback:** the release layers the existing `realtrackapp-frontend:publish-workspace-20261104-7fb85299` image. Rollback image: `realtrackapp-frontend:rollback-fashion-catalog-filters-20261104-r1`.
- **Release folder:** `/home/ubuntu/fashion-catalog-filters-20261104/`.
- **Verification:** public homepage and `/api/health` returned HTTP 200; the public JavaScript bundle `index-DBsuBUAI.js` contains the Fashion filter and workspace-scoped publishing code. Only the frontend was recreated; backend, PostgreSQL, Redis, and PgBouncer container IDs were unchanged. No schema or catalog data changed.
- **Browser check:** an authenticated visual walkthrough was not completed because Windows browser state capture timed out.

## eBay catalog bulk publish workspace scope (2026-11-04, main 7fb85299)

Production frontend only: `realtrackapp-frontend:publish-workspace-20261104-7fb85299` (bundle `index-DqQ7q5aK.js`) layers the main commit `7fb85299` frontend build over the previously live `parts-search-desc-20261027-2bfc2a5d` image. The publish dialog scopes active eBay stores to the selected workspace and passes its `organizationId` through durable bulk-job creation and target polling.

- **Rollback:** `realtrackapp-frontend:rollback-publish-workspace-20261104-7fb85299`, preserving the prior live frontend image. Release folder: `/home/ubuntu/realtrackapp-publish-workspace-20261104-7fb85299/`.
- **Verification:** frontend root and the new bundle returned successfully over HTTP; `/api/health` returned successfully; backend, PostgreSQL, Redis, and PgBouncer container IDs were unchanged. No schema or listing data changes were made.
- **Verification limit:** authenticated browser interaction was not confirmed because Windows computer-use state capture timed out twice. The screenshot's 53-listing batch was already complete at 53/53 on 2026-11-03 and was not submitted again.

## Inventory photo-review status (2026-11-04, main)

Production backend image `realtrackapp-backend:inventory-photo-review-20261104`
contains the main-branch status fix and layers the existing Motoark/Primemotive
production overlay over it. Only the backend was recreated; the frontend,
PostgreSQL, Redis, and PgBouncer stayed running. No schema migration or listing
data update was needed.

- Photo identity failures with at least two saved images report `needs_review`;
  fewer than two images remain a missing-data failure.
- **Verification:** backend health and `/api/health` return HTTP 200. The
  inventory frontend already supports the `Needs review` badge.
- **Rollback:** restore
  `realtrackapp-backend:motoark-lifecycle-20261102-candidate` using the active
  production Compose file list.

## eBay revision stale-readback fix (2026-10-30, main 00aad7cd)

Production backend image `realtrackapp-backend:ebay-revise-00aad7cd` was built
from the clean main release source at `/home/ubuntu/realtrackapp-release-ebay-revise-00aad7cd/`
and deployed by recreating only the backend with the active production Compose
file list. PostgreSQL, Redis, PgBouncer, and the frontend stayed running. No
database migration or listing retry was needed.

- Existing Trading API listing revisions now treat a successful
  `ReviseFixedPriceItem` response as confirmation; an immediate `GetItem`
  readback can lag and must not turn an accepted revision into a failed target.
- **Verification:** the backend container is healthy; `/api/health` returned
  HTTP 200 with database and heap up; the compiled stale-readback helper is
  absent. The eBay publish queue had no active, waiting, or delayed jobs at
  cutover.
- **Rollback:** image `realtrackapp-backend:parts-search-images-20261027-2f2d4755`
  with `/home/ubuntu/realtrackapp-release-ebay-revise-00aad7cd/rollback.yml`.
  The release folder also retains the clean backend source and Compose override.

## Parts Search listing descriptions as sanitized HTML (2026-10-27, main 2bfc2a5d)

Frontend only: production frontend is `realtrackapp-frontend:parts-search-desc-20261027-2bfc2a5d` (bundle `index-Bj8-ZK2t.js`), layered on `parts-search-modal-20261027-3f6e9f4c` (replaces `dist/` only). Rollback: `realtrackapp-frontend:rollback-parts-search-desc-20261027-2bfc2a5d`. Release folder: `/home/ubuntu/realtrackapp-parts-search-desc-20261027-2bfc2a5d/`. Checks: the bundle carries the sandboxed description frame, `/parts-search` and `/parts-search/results` return 200, and the backend and data containers are unchanged.

## Parts Search list-first + part detail modal (2026-10-27, main 3f6e9f4c)

Frontend only: production frontend is `realtrackapp-frontend:parts-search-modal-20261027-3f6e9f4c` (bundle `index-Cs3kmmgc.js`), layered on `parts-search-images-20261027-2f2d4755` (replaces `dist/` only). The backend is unchanged (`parts-search-images-20261027-2f2d4755`): the new part-detail fields come from PartsBazar360 and are passed through.

- **Rollback:** `realtrackapp-frontend:rollback-parts-search-modal-20261027-3f6e9f4c`. Release folder: `/home/ubuntu/realtrackapp-parts-search-modal-20261027-3f6e9f4c/`.
- **Depends on PartsBazar360** `main` 894393a + 0aaaa5b, which is live as `partsbazar360-api:latest` `728b5f918f12` (see PartsBazar360 `docs/apps/api.md`).
- **Checks:**
  - From the backend container with its key, options for `5N1419502B` show it superseded by `5N1419502M`, and the part detail carries `crossReferences` (MPN + 5 superseded) and 7 fitment rows.
  - `/parts-search` and `/parts-search/results` return 200; the options API returns 401 without auth.
  - Backend, PostgreSQL, Redis and PgBouncer containers are unchanged.
  - A signed-in staff session on production was not exercised; the flow was verified locally against production-captured data.

## Parts Search image downloads (2026-10-27, main 2f2d4755)

Production runs backend and frontend `parts-search-images-20261027-2f2d4755` (frontend bundle `index-v28gJd7N.js`). They are layered on `parts-search-options-20261027-22dc97da`, replacing only `dist/src/parts-search/**` and the frontend `dist/`; there is no migration and no environment change.

- **Rollback:** tags `rollback-parts-search-images-20261027-2f2d4755`. Release folder: `/home/ubuntu/realtrackapp-parts-search-images-20261027-2f2d4755/`.
- **Checks:**
  - The image routes are mapped and return 401 without auth.
  - A catalogue original reads from the private bucket as a 2448×2448 JPEG (1.6 MB) through the same S3 client.
  - The backend container fetches eBay 1600 px renditions.
  - PostgreSQL, Redis and PgBouncer are unchanged.

## Parts Search "every sellable option" (2026-10-27, main 22dc97da)

**Production images:**
- Backend `realtrackapp-backend:parts-search-options-20261027-22dc97da`, layered on `parts-search-20261027-4fc25e79`. It adds `dist/src/parts-search/**` and migration `1791600000000-CreatePartsSearchEvents`, which ran at the entrypoint; it was the only pending migration of 71.
- Frontend `realtrackapp-frontend:parts-search-options-20261027-22dc97da` (bundle `index-U27TdzyR.js`), layered on `parts-search-20261027-49d1dfe7`.

**Rollback:** tags `rollback-parts-search-options-20261027-22dc97da` (backend and frontend). Release folder: `/home/ubuntu/realtrackapp-parts-search-options-20261027-22dc97da/` (backend files at the top level, `frontend/` for the frontend).

**Key and configuration:**
- `PARTSBAZAR360_SEARCH_API_KEY` was added to `/home/ubuntu/realtrackapp/.env`, copied server-to-server from PartsBazar360's `REALTRACK_SEARCH_API_KEY`, never printed. Backup: `/home/ubuntu/realtrackapp.env.pre-parts-search-options-20261027`.
- The backend's `compose-override.yml` passes the key through, so later rollouts that reuse the container's Compose file list keep it.

**Checks:**
- Backend healthy; `parts_search_events` exists.
- `/api/parts-search/options` returns 401 unauthenticated; with the key, the container reaches PartsBazar360 internal search `/health` (200).
- The frontend serves the new bundle on `/parts-search`. PostgreSQL, Redis and PgBouncer are unchanged.

**Staff check still needed:** a signed-in end-to-end check by a staff user (sign in at `/parts-search/login`).

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

## Catalog condition-filter crash fix (2026-10-21)
Production frontend runs
`realtrackapp-frontend:catalog-condition-icon-20261021-r1`, an overlay on the
active `realtrackapp-frontend:fashion-catalog-import-20261021-b95045cd` image.
Rows returned by condition **New** can have status `needs_review`; the previous
bundle lacked an icon mapping and crashed while reading `cfg.icon`. The release
adds the **Needs Review** shield icon, a fail-closed fallback for unknown
statuses, and a matching label in the inventory detail modal.
The frontend-only Compose override is
`/home/ubuntu/realtrackapp-catalog-condition-icon-20261021-r1/compose-frontend.yml`.
It was appended to the Compose file list recorded on the running frontend, and
only the frontend service was recreated (`--no-deps --no-build --pull never`).
The public homepage, `/auto-parts/catalog`, JavaScript, CSS, and `/api/health`
returned HTTP 200; the served JavaScript contains `needs_review`. Backend,
PostgreSQL, Redis, and PgBouncer container IDs stayed unchanged, and no listing
data changed. Rollback image:
`realtrackapp-frontend:rollback-catalog-condition-icon-20261021-r1`.
## Catalog bulk-publish workspace scope (2026-10-20)
Production frontend image `realtrackapp-frontend:publish-workspace-20261020-r3` fixes catalog publishing across organizations. The publish dialog resolves active eBay primary stores from the selected workspace, then carries the same `organizationId` through job creation and target polling. Previously the poll request omitted the workspace ID; the backend fell back to the user's primary organization and returned `Job not found` for a job created in another workspace. The image also includes the `Needs Review` shield icon and fail-closed status fallback already present in the workspace.
The release was built from the deployed `ae12191b` frontend baseline and uses the existing nginx image and static-asset permissions. The rollback image is `realtrackapp-frontend:rollback-publish-workspace-20261020-r2`, which preserves the prior workspace-scoped frontend. The deployment uses the frontend-only Compose override at `/home/ubuntu/realtrackapp-publish-workspace-20261020/compose-frontend.yml` and recreates only the frontend service with `--no-deps`. Backend, PostgreSQL, and Redis container IDs remain unchanged. Nginx validation, the homepage, the served publish bundle, and `/api/health` return HTTP 200; no listing is retried or published during verification. The previous rollback tags remain available for earlier releases.
## Primemotive integration feedback (2026-10-15)
Production runs backend image
`realtrackapp-backend:primemotive-feedback-20261015-r5`, with rollback image
`realtrackapp-backend:rollback-primemotive-feedback-20261015-r5`. Migration
`1791400000000-PrimemotiveListingChangeFeed` is applied. The pre-migration
database backup is `/home/ubuntu/backups/primemotive-feedback-pre179140-20261015.dump`.
The Primemotive API no longer filters on Mercedes item specifics and returns
active published rows with non-empty eBay item IDs, paginated at up to 200 rows
per page. Its measured total was 91,496, including 10 marked synthetic test
rows. CSV export accepts a page number and returns up to 10,000 rows per page.
The migration-backed change feed captures additions, edits, ended/deleted rows,
and supports incremental polling. HMAC-signed outbound delivery with retries is
deployed but idle until `PRIMEMOTIVE_LISTING_WEBHOOK_URL` and
`PRIMEMOTIVE_LISTING_WEBHOOK_SECRET` are configured.
Ten synthetic rows were seeded for the Primemotive organization, and the
minute simulator is enabled for that organization. Two synthetic update events
were observed after rollout; the simulator mutates only test rows in the local
database mirror and does not call eBay. Local and public health checks,
deployed-file checksums, migration state, protected-route checks, and preservation
of existing runtime settings passed. The API and simulator use the existing
Compose stack; only the two simulator environment variables were added.
## Production catalog status icon runtime fix (2026-10-15)
Production frontend runs `realtrackapp-frontend:catalog-status-icon-20261015-r2`,
an overlay on the prior `realtrackapp-frontend:main-ae12191b` image. The active
backend already returned `needs_review`, but that frontend build did not map it
to an icon. The Auto Parts catalog now displays the review status and treats
unrecognized API statuses as non-publishable review holds. The first overlay's
asset directories were mode 0700, preventing nginx from reading JavaScript and
CSS; r2 applies `chmod -R a+rX /usr/share/nginx/html` in the image build.
The deployment appended
`/home/ubuntu/realtrackapp-catalog-status-icon-20261015-r1/compose-frontend.yml`
to the Compose file list recorded on the running frontend and recreated only
the frontend service (`--no-deps --no-build --pull never`). The public homepage,
catalog route, JavaScript, CSS, and `/api/health` returned HTTP 200; Chrome
rendered the homepage. Backend, PostgreSQL, Redis, and PgBouncer containers
were not recreated. No listing data changed. The base frontend image
`realtrackapp-frontend:main-ae12191b` remains available for rollback.
## Catalog review holds and eBay publish diagnostics (2026-10-14)
Production runs backend image `realtrackapp-backend:catalog-publish-holds-20261014-r2`
and frontend image `realtrackapp-frontend:catalog-publish-holds-20261014-r1`.
The backend is a scoped overlay on the previous live image; the frontend build
adds a **Needs Review** catalog status. Manual-review and protected lifecycle
holds are excluded from **Ready to Publish**, rechecked by the publish
validator, and rejected before an eBay request. The Trading API surfaces the
first `ErrorParameters.Value` for error 240 when eBay returns it. Compose
overrides and runtime environment were preserved. Backend/frontend builds,
local and public health, module checksums, public frontend checksum, and
unauthenticated protected-route checks passed. Rollback backend image:
`realtrackapp-backend:rollback-catalog-publish-holds-20261014-r2-attempt3`.
No failed listing was retried; existing error-240 records still need an
actionable eBay policy reason before retry.
## Add Part recovery rollout (2026-10-13)
The backend now runs `realtrackapp-backend:add-part-recovery-20261013-r1`, a scoped derivative of the active photo-review image. Existing runtime environment and Compose overrides were preserved. Local/public health and isolated runtime regression checks passed; rollback is `realtrackapp-backend:rollback-add-part-recovery-20261013-r1`. See [audit and recovery](../operations/ADD_PART_RECOVERY_2026-10-13.md). Earlier image references below describe historical deployments.
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
  (Vite) → static assets served by nginx (`docker/nginx.conf`).
- The frontend nginx image cache also serves the public NAPA image proxy path
  (`/api/storage/napa-image/`) with a 30-day shared cache; the backend route
  only accepts numeric image IDs and fetches from a fixed CDN host.
- **Backend** (`backend/Dockerfile`): multi-stage — install all deps → `nest build`
  → production image with `--omit=dev` deps running `node dist/main.js`.

### Current production backend health fix (2026-10-11)

Production's backend heap was 335 MB while the container used about 462 MB RSS
within its 1.8 GB memory limit. The 300 MB heap check therefore returned HTTP
503 and Docker marked the otherwise-responsive backend unhealthy. The backend
initially ran `realtrackapp-backend:health-heap-512-20261011`, layered over
`realtrackapp-backend:health-probe-throttle-20261011`; it exempted `/api/health`
from global throttling and raised the heap check to 512 MB. On 2026-10-11 the
backend later reached 657.85 MB heap and returned HTTP 503 while using about
740 MiB of its 1.8 GB container limit, with no OOM or restart. The health cutoff
was raised to 1 GB in `realtrackapp-backend:health-heap-1024-20261011`, a
derived image from the running backend that changes only the compiled health
controller threshold. The backend container alone was recreated; the earlier
512 MB image remains available for rollback. Node syntax validation passed.
At 07:57 UTC, direct and public `/api/health` returned HTTP 200 with database
and memory up, `/api/health/runtime` and the frontend root returned HTTP 200,
and all five containers were running with the backend healthy.

The active application URL `https://app.omnicoreholding.com/` and its
`/api/health` route return HTTP 200. The configured RealTrack names
`mhn.realtrackapp.com` and `enxi.realtrackapp.com` currently resolve to
`208.91.197.132` instead of the EC2 host, so requests through those public names
fail. Update their A records with the DNS provider before treating those names
as externally available; the containers and local Nginx virtual hosts are
healthy.

**Health regression and recovery (2026-10-11 07:47–07:57 UTC):** heap use rose
from 624.13 MB to 657.85 MB, crossing the 512 MB health cutoff while the
database check and runtime endpoint remained up. The 1 GB threshold follow-up
above resolved the false unhealthy state. Recheck health and memory before
large catalog imports because the earlier process showed increasing heap use.

### Current production Add Part responsiveness fix (2026-10-08)

Production runs `realtrackapp-backend:add-part-responsive-20261008`, layered
over `realtrackapp-backend:title-fitment-20261008-v28`. Its retained build
directory and Compose override are under
`/home/ubuntu/realtrackapp-add-part-responsive-20261008/`. The image replaces
only the compiled eBay Browse client and single-listing form service modules:
interactive MPN lookup returns promptly on eBay 429 responses, a successful
pre-save lookup is not repeated during save, and placeholder-draft enrichment
finishes in the background before optimization is queued.

The frontend `usePartLookup` request now also has a 45-second abort deadline.
On timeout, Add Part displays a retry notice and still permits saving a draft
with its fallback title; the notice remains visible after save.

The frontend fix is preserved in the Compose-referenced local image tag
`realtrackapp-frontend:main-e2e019b` (image
`sha256:ff8fb18dec751465e50b6ac637f814eac7aea32a183d41f8f43d62a42ed85b7e`).
The prior image (`sha256:4f303bc597da031f5e5ba7ac5487409c3cbf11156e0a38c9fdce5af25d5d11fc`)
is retained as `realtrackapp-frontend:rollback-20261008-pre-addpart-timeout`.
The frontend has no bind mount, so this snapshot makes the static hotfix survive
container recreation. The snapshot was captured from the running container;
future source builds must include the tracked 45-second lookup change in
`src/lib/pipelineApi.ts` or they can replace this snapshot.

After the image was preserved, Compose recreated the frontend and its backend
dependency. PostgreSQL, Redis, and PgBouncer remained running. Verification
returned HTTP 200 for the frontend root, `/auto-parts/listings/new`, the new
frontend JS asset, and `/api/health`; the backend health payload reported the
database and memory checks up. All five service containers were running, with
backend/PostgreSQL/Redis/PgBouncer healthy. The three enriched production
listing records and their image, description, tenant scope, and 28 verified
fitments remained present. No listing rows were changed by this container
refresh.

#### Production image and health recheck (2026-10-09)

The running images now report `realtrackapp-backend:add-part-photo-identity-557a9206`
and `realtrackapp-frontend:add-part-photo-identity-217d09e3`, superseding the
image tags above. A read-only production recheck found all five containers
running, with backend, PostgreSQL, Redis, and PgBouncer healthy. `/api/health`
returned HTTP 200 with database and memory checks up, and the frontend returned
HTTP 200. An unauthenticated browser session reached `/auto-parts/login`, so an
authenticated Add Part save was not exercised during this recheck.

### Current production Add Part draft-first fix (2026-10-10)

Production now runs `realtrackapp-backend:add-part-save-timeout-20261010` and
`realtrackapp-frontend:add-part-save-timeout-20261010`. The isolated source copy
is under `/home/ubuntu/realtrackapp-add-part-save-timeout-20261010`; its Compose
override is `/home/ubuntu/realtrackapp-add-part-save-timeout-20261010.override.yml`.
The rollout recreated only backend and frontend. The prior production tags
`realtrackapp-backend:catalog-readiness-20261010` and
`realtrackapp-frontend:add-part-photo-identity-217d09e3` remain available through
the existing Compose overrides for rollback.

Add Part persists and returns the draft before optional Image Drive lookup.
Background attachment re-reads the listing before saving, so a photo uploaded
after draft creation is preserved. Automatic identification starts only after
at least two photos are saved. The frontend aborts its wait after 45 seconds and
asks the operator to check Inventory before retrying, since the draft may exist.

After rollout, the local frontend root and `/api/health` both returned HTTP 200;
the health response reported `status: ok` and database/memory checks up. All five
containers were running; backend, PostgreSQL, Redis, and PgBouncer were healthy.
The browser rendered the production sign-in page, but no authenticated Add Part
submission was made. No catalog/listing rows were imported or changed by this
deployment.

#### Catalog readiness fix and Superior batch (2026-10-10)

The backend now runs `realtrackapp-backend:catalog-readiness-20261010`, built
from the production source snapshot with the catalog readiness correction. The
fitment duplicate gate distinguishes actual configurations (including trim,
engine, platform, body style, and drive type), and the U.S. marketplace image
gate accepts one product photo, consistent with eBay's inventory photo
requirement. The frontend and data-service images were left unchanged.

The production catalog API reports all 600 Superior batch products ready for
catalog use and U.S. marketplace listing, with 85,478 valid fitment rows and no
readiness errors. All 600 prices and shipping policy assignments match the
approved batch values. Through the listing API, 591 drafts were promoted to
`ready`; the final active listing counts are 592 `ready` and 8 `published`, with
600 distinct active SKUs. The backend, PostgreSQL, Redis, and PgBouncer report
healthy, and the local frontend reverse proxy returns HTTP 200 for `/api/health`
and `/auto-parts/listings/new`.

To roll back only the frontend snapshot, restore the saved image tag and
recreate the frontend using the production Compose files:

```bash
docker tag realtrackapp-frontend:rollback-20261008-pre-addpart-timeout realtrackapp-frontend:main-e2e019b
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f /home/ubuntu/realtrackapp-main-e2e019b.override.yml up -d --no-build --pull never frontend
```

The previous backend `realtrackapp-backend:title-fitment-20261008-v28` image
remains the rollback target for the separate backend override; omitting the
Add Part override and recreating only the backend restores it.

### Initial production inventory photo display fix (2026-10-10; superseded)

Production frontend now runs
`realtrackapp-frontend:inventory-photo-fix-20261010`, built from the isolated
release source at
`/home/ubuntu/realtrackapp-inventory-photo-fix-20261010/frontend`. The Compose
override is
`/home/ubuntu/realtrackapp-inventory-photo-fix-20261010.override.yml`. The
Inventory Details modal displays a larger primary part photo using `contain`
and a thumbnail strip for additional photos; `OptimizedImage` explicitly fills
its frame so both `cover` and `contain` render visibly.

The production record reported in the complaint had 18 saved photos. The
frontend root and `/api/health` returned HTTP 200, the backend health payload
reported `ok`, and the served JavaScript bundle contained the photo-gallery
UI. Only the frontend container was recreated; the backend, database, and
listing data were not changed. The previous
`realtrackapp-frontend:add-part-save-timeout-20261010` image and its existing
Compose override remain available for rollback by omitting the new inventory
photo override and recreating only `frontend`.

### Current production eBay publish quantity cap (2026-10-10)

Production backend now runs
`realtrackapp-backend:ebay-quantity-cap-20261010`, built from the retained
production source snapshot at
`/home/ubuntu/realtrackapp-ebay-quantity-cap-20261010/backend`. The Compose
override is
`/home/ubuntu/realtrackapp-ebay-quantity-cap-20261010.override.yml`. The
standard, queued, legacy adapter, and variation-family eBay publish paths cap
submitted available quantity at 10; queued channel records store the capped
value.

Only the backend container was recreated. The frontend remained on
`realtrackapp-frontend:inventory-photo-fix-20261010`; PostgreSQL, Redis, and
PgBouncer were left running. The backend reports healthy, `/api/health` reports
database and memory up, and the compiled quantity utility reports a maximum of
10. No migration or marketplace listing data was changed. The prior
`realtrackapp-backend:add-part-save-timeout-20261010` image remains the rollback
target; omit the new override and recreate only the backend to restore it.

### Current production catalog publication destinations (2026-10-10)

Production frontend now runs
`realtrackapp-frontend:catalog-publication-destination-20261010`, built from the
isolated release source at
`/home/ubuntu/realtrackapp-catalog-publication-destination-20261010/frontend`.
Its Compose override is
`/home/ubuntu/realtrackapp-catalog-publication-destination-20261010.override.yml`.
The catalog shows each publication's marketplace and store destination on
desktop and mobile, with an explicit link to open the listing. The prior
`realtrackapp-frontend:inventory-photo-dedupe-20261010` image remains available
for rollback by omitting the destination override and recreating only `frontend`.

Only the frontend container was recreated. The backend remained on
`realtrackapp-backend:ebay-quantity-cap-20261010`; PostgreSQL, Redis, and
PgBouncer remained running. The frontend root, `/catalog`,
`/auto-parts/catalog`, and `/api/health` returned HTTP 200. The health payload
reported database and memory checks up, and the served JavaScript bundle
contained the destination labels and listing links. No database or listing
data was changed.

### Inventory gallery deduplication fix (2026-10-10; retained in current frontend)

The catalog publication destination release described above is based on the
retained `realtrackapp-frontend:inventory-photo-dedupe-20261010` snapshot, built
from the isolated source at
`/home/ubuntu/realtrackapp-inventory-photo-dedupe-20261010/frontend`. Its
Compose override is
`/home/ubuntu/realtrackapp-inventory-photo-dedupe-20261010.override.yml`. It
removes the redundant “Part pictures” thumbnail strip that duplicated the
existing Product Images gallery. The larger primary-photo preview and the
Product Images gallery/editor remain available.

At its initial rollout, the frontend root and `/api/health` returned HTTP 200 with health status `ok`;
the backend remained on
`realtrackapp-backend:ebay-quantity-cap-20261010` and healthy. The served bundle
contains the Product Images gallery and no longer contains the duplicate strip.
Only the frontend container was recreated; no listing data or database was
changed. The previous
`realtrackapp-frontend:inventory-photo-fix-20261010` image remains the rollback
target: omit the dedupe override and recreate only `frontend`.

### Historical title-fitment v3 rollout (2026-10-08, superseded)

The earlier rollout ran `realtrackapp-backend:title-fitment-20261008-v3`, a small
overlay on `realtrackapp-backend:title-fitment-20261008-v2`. It adds forced
Optimize All reruns for completed or needs-review jobs and optimization
version 8. Its source
bundle and separate Compose override are retained under
`/home/ubuntu/realtrackapp-title-fitment-fix-20261008-v3/`. The override is
loaded after the existing title-fitment override and changes only the backend
image. Version 7 remains the immediate rollback target.

At that earlier rollout, only the backend container was recreated. The frontend stayed on
`realtrackapp-frontend:main-e2e019b`; PostgreSQL, Redis, and PgBouncer stayed
running. Both container and public `/api/health` checks returned `status: ok`.
The previous backend image remains available. Roll back by omitting the new
title-fitment override and recreating only the backend with the existing
`main-e2e019b` override.

That rollout did not run Optimize All or mutate catalog/listing data. Pipeline
`7239edb3-770b-4b18-a60f-288b5bdeba8c` is refreshed over SSH using the
application optimization service after this deployment. Record actual product
counts and resulting state once the pass completes.

### Current production catalog photo and part lookup fix (2026-10-07)

Production now runs `realtrackapp-frontend:catalog-photo-part-lookup-20261007`
and `realtrackapp-backend:catalog-photo-part-lookup-20261007`. The frontend
was built from `/home/ubuntu/realtrackapp-frontend-fashion-ai-20261007`; the
backend was built from the clean `00206b9` backend snapshot at
`/home/ubuntu/realtrackapp-build-catalog-photo-part-fix-20261007`, with the
scoped single-listing lookup change applied. The separate Compose override is
`/home/ubuntu/realtrackapp-catalog-photo-part-fix-20261007.override.yml`.

The rollout recreated only frontend and backend. PostgreSQL, Redis, and
PgBouncer remained running. After rollout, `/api/health` returned
`status: ok`, and both `/catalog` and `/auto-parts/catalog` returned HTTP 200.
The previous frontend `realtrackapp-frontend:fashion-ai-20261007` and backend
`realtrackapp-backend:ebay-quota-880eb325` image tags remain available; omit the
new override to restore those image selections.

### Previous Auto Parts catalog route hotfix (2026-10-06)

The Catalog sidebar path is relative (`/catalog`) because `Shell.tsx` adds
`/auto-parts`. The initial hotfix image was
`realtrackapp-frontend:catalog-route-fix-20261006`, built from
`/home/ubuntu/realtrackapp-main-release-20261005`; that route correction is
carried forward in the current production frontend image above.

## Runtime config highlights

- Backend container: `NODE_ENV=production`, `IGNORE_ENV_FILE=true` (config comes
  from compose `environment`, not a mounted `.env`), `PORT=4191`,
  `PIPELINE_PROJECT_ROOT=/app`.
- `BUSINESS_INDUSTRIAL_ALLOW_UNAPPROVED_PUBLISH` is passed through Compose and
  defaults to `false`; set it explicitly to `true` only for a temporary,
  operator-led B&I publishing window, then disable it and recreate the backend.
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
  pressure; the production overlay keeps this setting at 512mb, and the
  `redisdata` volume preserves queue state across restarts.
- `JWT_SECRET` is **required** (compose fails fast if unset).
- `DB_MIGRATIONS_RUN=true` by default → migrations run on backend boot.
- Postgres seeds from `listingpro.dump` on first volume init (idempotent-ish;
  `pg_restore` warnings on existing objects are tolerated).
- eBay listing template `.xlsx` files are mounted read-only into the backend.
- Durable eBay bulk publishing uses the existing Redis/BullMQ service and
  `ebay_listing_jobs` tables. `EBAY_DAILY_PUBLISH_TARGET_LIMIT` defaults to and
  is hard-capped at 5,000 listing/store targets per organization per UTC day.
- Production queue consumers must be Compose-managed backend containers named
  `${COMPOSE_PROJECT_NAME:-realtrackapp}-backend-N`. The deployment helper
  `scripts/deploy-production.sh` removes stale Compose one-off backend
  containers before rebuilding and fails if an unexpected backend consumer
  remains; this prevents old code from competing for the same BullMQ publish
  jobs. Horizontal scaling remains supported with `--scale backend=N`.
- Job-scoped incident recovery is dry-run by default through
  `scripts/requeue-ebay-publish-job.mjs`. Apply mode requires the exact job ID
  as a confirmation and requeues only failures covered by the current publish
  normalizers (legacy projection, EPS, invalid legacy fitment, missing UPC, or
  stale generic Engine category), leaving policy/condition/duplicate/unknown
  failures for review.
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

- Production host referenced: `app.omnicoreholding.com` (in default CORS + nginx).
- CORS allow-list from `CORS_ORIGIN` (comma-separated) or built-in defaults
  (`localhost:3911`, `localhost:8050`, `app.omnicoreholding.com`).

### S3 presigned-upload CORS

Browser image uploads use presigned `PUT` URLs directly against the configured
S3 bucket. The bucket CORS policy must allow `PUT`, `Content-Type`, and the
origins served by the frontend. Applied 2026-09-13 after the bucket had
`NoSuchCORSConfiguration` (browser uploads failed as `S3 upload network
error`). The production bucket now allows `PUT`/`GET`/`HEAD` from
`https://app.omnicoreholding.com`, `http://app.omnicoreholding.com`,
`https://mhn.realtrackapp.com`, `http://mhn.realtrackapp.com`,
`https://enxi.realtrackapp.com`, `https://www.enxi.realtrackapp.com`,
`https://renovessa.com`, `https://www.renovessa.com`, and the local
frontend/API origins (`http://localhost:8050`, `http://localhost:3911`,
`http://localhost:4191`). If the application domain changes, update the S3
bucket CORS policy as well as `CORS_ORIGIN`; a missing S3 origin appears in the
browser as a generic `S3 upload network error`.

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
## Business & Industrial deployment note (2026-09-09)
The additive B&I migration must be reviewed before the normal migration-on-boot
path applies it. Set `EBAY_WEBHOOK_SECRET` in the Compose environment only when
the signed local enforcement endpoint is intentionally enabled; empty leaves
that endpoint unavailable. Do not connect a production seller or enable the
vertical flag until sandbox category, shipping, OAuth, and incident paths have
been verified.
## Backend image fonts (2026-09-28)
The backend runner stage installs `fonts-dejavu-core`. sharp/librsvg needs a system font to draw text in Fashion size-chart images and photo banners; `node:20-slim` ships none, so without it those images render with blank text. Migration `1791000000000-CreateFashionIntake` runs with the normal migration step. See docs/architecture/FASHION_QUICK_CAPTURE.md.
## Primemotive Mercedes-Benz listing feed (2026-10-12)
### Production follow-up (2026-10-13; current)
Production now runs `realtrackapp-backend:primemotive-catalog-data-r3-20261013`,
a fitment-validation layer over
`realtrackapp-backend:primemotive-catalog-data-r2-20261013`, the ownership-check
layer over `realtrackapp-backend:primemotive-catalog-data-20261013`, which
layers over `realtrackapp-backend:primemotive-api-fix-20261013` and the original
`realtrackapp-backend:primemotive-external-listings-20261012`.
The runtime initially used the base Compose files without the saved Primemotive
override, so the running container had no Primemotive route even though the
release image and override existed. The corrected Compose launch explicitly
includes `/home/ubuntu/realtrackapp-primemotive-external-listings-20261012/compose-override.yml`.
The prior override is preserved as
`compose-override.yml.backup-20261013` in the same directory.
The underlying API-fix layer updates the query DTO and published-listings service, and
adds migration `1791300000000-PrimemotiveExportPermissionGrant`. The dedicated
feed reads the RealTrackApp database only and always requires the authenticated
organization's Primemotive store, a non-empty eBay item ID, database
`listingStatus=active`, and explicit Mercedes-Benz item specifics. The active,
published, make, and store constraints cannot be broadened by query parameters.
Both `updatedAfter` and the compatibility alias `updateAfter` are supported.
The API URL includes the global prefix:
`https://app.omnicoreholding.com/api/published-listings/primemotive`.
The 2026-10-13 catalog-data layer adds the opt-in query parameter
`includeCatalogData=true` to listing list/detail reads. It batch-loads the
linked `catalog_products` source identifiers, descriptors, attributes, source
category, and explicitly MVL-validated fitment rows; review-only, rejected, and
untagged fitment rows are omitted. It does not map these values to canonical
Partslink24 IDs. It excludes catalog rows owned by another organization and
allows legacy rows without an organization ID. A follow-up filters the
fitment projection to explicitly MVL-validated rows only. No migration was
required. The layer and separate Compose override are retained under
`/home/ubuntu/realtrackapp-primemotive-catalog-data-20261013/`; the ownership
check layer/override are under
`/home/ubuntu/realtrackapp-primemotive-catalog-data-r2-20261013/`; the
fitment-validation layer/override are under
`/home/ubuntu/realtrackapp-primemotive-catalog-data-r3-20261013/`. Removing
only the latest override and recreating the backend rolls back to r2; removing
both follow-up overrides rolls back to
`realtrackapp-backend:primemotive-catalog-data-20261013`.
After rollout, `/api/health` returned HTTP 200, the unauthenticated Primemotive
feed returned HTTP 401, and Docker reported the new backend container healthy.
An authenticated payload check is still pending the external integration
login, including a check of how many eligible listings have a linked catalog
product.
Production migration-on-boot succeeded. The existing
`api_published_listings_reader` role now has `published_listings.view`,
`published_listings.external_feed`, `published_listings.sales.notify`, and
`published_listings.export`. Backend health returned HTTP 200; unauthenticated
requests to the feed with either timestamp spelling returned HTTP 401, which
confirms the route is registered and protected. An authenticated payload check
still requires the external integration login.
The database has 238 active, published Primemotive Mercedes-Benz rows under
the endpoint's required filters. Its Primemotive eBay connection is active;
the latest completed scheduled sync finished 2026-10-11 10:23 UTC with 25,000
processed and 0 failed. Sync-status now uses that latest completed sync log and
production sets `PUBLISHED_LISTINGS_SYNC_STALE_AFTER_HOURS=192` for the weekly
refresh cadence, preventing the older failed run/account watermark from
overriding the successful Oct 11 run.
Store-status review: active accounts with completed Oct 11 refreshes now report
`ok`. `Salvage Auto Parts` remains `stale` because its latest completed refresh
was Oct 4 05:56 UTC (more than 192 hours before this review). Disabled or
`reconnect_required` accounts remain `inactive`, and one generic `eBay store`
has no connected account and remains `never_synced`; these states reflect their
database connection/sync records and are not masked by the Primemotive change.
Across the 21 eBay store records in the Primemotive organization, the resulting
status breakdown is 8 `ok`, 11 `inactive`, 1 `stale`, and 1 `never_synced`.
The Seller Hub report generated 2026-10-07 contains 87,955 US-site item IDs.
At the time of the production DB comparison, 64,257 IDs matched active
RealTrackApp rows, while 238 matched the narrower Primemotive/Mercedes feed
scope. The report predates the database comparison by six days.
### Pre-deployment workspace follow-up (2026-10-14; superseded 2026-10-15)
This entry records the 2026-10-14 candidate that removed the feed's explicit
Mercedes item-specific predicate, added migration-backed listing-change events
and optional signed outbound webhook delivery, and paginated CSV exports in
10,000-row pages. It also added an idempotent 10-row synthetic fixture seed and
an opt-in minute simulator that writes only to the database mirror. The
candidate was deployed on 2026-10-15; see the current deployment record at the
top of this document. The older production counts and behavior recorded above
describe the pre-deployment state.
### Original release record (2026-10-12; superseded runtime)
Production backend runs `realtrackapp-backend:primemotive-external-listings-20261012`,
an image layer over `realtrackapp-backend:health-heap-1024-20261011`. The layer
adds only the Primemotive listing and sale-event routes, their DTO/service code,
the two RBAC registry entries, and migration
`1791200000000-PrimemotiveExternalApiPermissions`. The feed is fixed to the
authenticated organization's Primemotive eBay store and explicit Mercedes-Benz
Make/Brand item specifics before pagination. The sale callback secret is stored
in the production environment and passed to the backend through the saved
Compose override at
`/home/ubuntu/realtrackapp-primemotive-external-listings-20261012/compose-override.yml`.
Migration-on-boot succeeded. It added both permissions and granted them to the
existing `api_published_listings_reader` role. Production's backend health,
frontend root, and direct health endpoints returned HTTP 200; unauthenticated
feed and sale-webhook probes returned HTTP 401. A database check matched 239
current Primemotive rows to the Mercedes-Benz filter. The pre-deploy compressed
backup is `/home/ubuntu/backups/pre-primemotive-20261012T115136Z.dump`.
Rollback the 2026-10-13 follow-up by restoring
`compose-override.yml.backup-20261013` to `compose-override.yml` and recreating
only the backend with the same three Compose files. This returns to the original
Primemotive image while keeping the additive export permission migration
applied. Re-applying the current override requires
`PRIMEMOTIVE_SALES_WEBHOOK_SECRET` to remain in production `.env`.
