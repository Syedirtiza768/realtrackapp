# Architecture

> **Source**: Consolidated from `docs/architecture/overview.md` (99 lines) and `docs/SYSTEM_OVERVIEW.md` (architectural sections) — 2026-05-29.
> Authoritative high-level map. Update when a module, integration, or major data flow is added/removed.

## What It Is

RealTrackApp (DB/internal name: **listingpro**) is a multi-channel **automotive parts listing & operations platform**. It ingests product data (CSV/catalog import, images, spreadsheets), enriches it with AI, manages fitment/compatibility, and publishes/syncs listings to marketplaces (primarily **eBay**), while handling orders, inventory, pricing, dashboards, automation, and audit.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, TypeScript, Tailwind CSS, React Router 7, TanStack Query 5 |
| Backend | NestJS 11 with TypeORM 0.3, Passport JWT |
| Database | PostgreSQL 16 |
| Cache / Queues | Redis 7 + BullMQ |
| Realtime | Socket.IO (`@nestjs/websockets`) |
| AI | OpenAI (chat + vision + embeddings) |
| Storage | AWS S3 (+ presigned URLs), Sharp for thumbnails; nginx proxy_cache for image serving |
| Infra | Docker Compose (postgres, redis, backend, frontend/nginx); PM2 optional |

## Ports

| Service | Port | Notes |
|---------|------|-------|
| Backend (NestJS) | 4191 | Global prefix `/api`; Swagger at `/api/docs` (non-prod) |
| Frontend (Vite dev) | 3911 | Proxies `/api` → `localhost:4191` (`vite.config.ts`) |
| Frontend (Docker/nginx) | 8050 | `FRONTEND_PORT`; serves built assets |
| PostgreSQL | 5432 | `DB_PORT_EXTERNAL` |
| Redis | 6379 | `REDIS_PORT_EXTERNAL` |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Dashboard  │  │   Catalog   │  │  Listings   │  │  Orders  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   Ingest    │  │   Motors    │  │   Settings  │  │  Audit   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (NestJS 11)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │    Auth     │  │   Listings  │  │   Catalog   │  │  Orders  │ │
│  │    RBAC     │  │  Ingestion  │  │   Import    │  │ Inventory│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │ eBay Integ. │  │   Motors    │  │   Storage   │  │  Common  │ │
│  │Multi-Store  │  │ Intelligence│  │    (S3)     │  │ (OpenAI) │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ SQL / Redis / S3
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  PostgreSQL │  │    Redis    │  │    AWS S3   │  │  BullMQ  │ │
│  │  (Primary)  │  │  (Cache/    │  │  (Images/   │  │ (Queues) │ │
│  │             │  │   PubSub)   │  │   Assets)   │  │          │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Topology (Docker Compose)

```
            ┌─────────────┐
 browser ──▶│ host nginx   │  TLS termination (Let's Encrypt), gzip,
            │ :443/:80     │  proxy_cache for /api/storage/serve/ (30-day, 1 GB)
            └──┬───────┬───┘  routes /api → backend, / → frontend
               │       │
       ┌───────▼─┐  ┌──▼──────────┐
       │frontend │  │ backend     │  NestJS, node:20-alpine, :4191
       │:8050→:80│  │             │  depends_on postgres+redis (healthy)
       │nginx    │  └──┬───────┬──┘
       └─────────┘     │       │
                  ┌────▼─┐  ┌──▼──────┐
                  │postgres│ │ redis   │
                  │ :5432  │ │ :6379   │
                  └────────┘ └─────────┘
```

### Image Serving Pipeline

Browser → host nginx → backend (`/api/storage/serve/{s3Key}`) → S3 (us-east-1).

The frontend's `toProxyUrl()` (`src/lib/imageUrl.ts`) rewrites S3 image URLs to
`/api/storage/serve/{key}` proxy paths so the browser reuses its existing
connection to the app origin (no separate DNS/TLS to S3). The host nginx caches
these responses for 30 days (`proxy_cache_path /tmp/nginx-image-cache`,
1 GB, `proxy_cache_use_stale error timeout updating`). First request = MISS
(backend streams from S3, ~100ms), all subsequent = HIT (~16ms, served from
nginx cache). The backend sets `Cache-Control: public, max-age=31536000,
immutable` on image responses; nginx adds `X-Cache-Status` (MISS/HIT).

Variant derivatives (`_thumb.webp` 200px, `_sm.webp` 320px, `_medium.webp`
800px, `_lg.webp` 1200px) are generated by Sharp via the `storage-thumbnails`
BullMQ queue and stored alongside originals in S3. The frontend's
`OptimizedImage` component requests the appropriate variant based on display
context (thumb for table rows, large for detail modals).

**On-demand self-healing:** if a variant is requested but missing from S3
(e.g. images imported before variant generation ran, jobs lost on a Redis
restart, or `mirrorRemoteImages` `skipExisting` not re-queueing), the
`/api/storage/serve/{key}` endpoint generates it on the fly from the original
and serves it in the same request — no fallback to a multi-MB original. The
backend probes the original extension (`.webp`/`.png`/`.jpg`/…), runs
`ImageProcessorService.processImage()` (generates all four variants in one
pass), then streams the requested variant. Concurrency is bounded to
`MAX_VARIANT_GEN` (4) concurrent Sharp generations with per-original in-flight
dedup to protect CPU; nginx caches the resulting 200 for 30 days so each
variant is generated at most once. A bulk backfill
(`scripts/check-and-backfill-variants.js`, DESC `createdAt` order, or
`POST /storage/backfill-catalog-variants`) pre-warms variants via the queue
worker (concurrency 15) so most never hit the on-demand path. The queue uses
`removeOnComplete`/`removeOnFail` (1-day age) so `jobId` dedup doesn't block
legitimate re-queues after a Redis restart or re-import.

External (eBay CDN) image URLs are passed through unchanged — no proxy routing.

### Image Drive Folder-Tree Uploads

The Image Drive UI accepts both the existing flat image upload and a recursive
folder drop/selection. The browser preserves each file's relative path and
sends it to `POST /api/image-drive/upload-folder` in chunks of at most 50 files
(matching the existing multipart limit). The backend normalizes paths, rejects
absolute/parent-traversal paths, and chooses the deepest directory that looks
like an automotive part number (at least two normalized characters and one
digit). Images under that directory are stored in a folder linked to the part
number; nested paths are retained in the asset filename/S3 key. Files without a
part-number directory remain in the selected top-level upload folder so no
images are discarded.

Pipeline finalization already performs Image Drive lookup for missing images by
manufacturer/OE part number. That lookup now stamps both the missing
`listing_records.itemPhotoUrl` and the corresponding empty
`catalog_products.imageUrls`, and records attachment counts in the pipeline
job's `stageDetails.imageDrive` object. Existing flat uploads, manually linked
folders, and non-empty image fields are not overwritten.

## Backend Modules (23)

Registered in `backend/src/app.module.ts`: `auth`, `rbac`, `listings`, `health`, `storage`, `ingestion`, `catalog-import`, `fitment`, `channels`, `inventory`, `orders`, `dashboard`, `settings`, `notifications`, `common/scheduler`, `common/feature-flags`, `automation`, `templates`, `motors-intelligence`, `common/openai`, `pricing-intelligence`, `integrations/ebay`, `client-settings`. Note: `listing-optimization` is imported transitively via `ingestion`, and `sellerpundit` is imported transitively via `integrations/ebay`.

Per-module details: [/docs/backend/MODULE_MAP.md](../backend/MODULE_MAP.md).

## Cross-Cutting Concerns

**Global guards** (order matters), declared in `app.module.ts`:
1. `ThrottlerGuard` (rate limiting: 10/s, 100/min, 1000/hr)
2. `JwtAuthGuard` (authentication; `@Public()` opts out)
3. `PermissionsGuard` (RBAC; `@RequirePermissions('module.action')`)

- **Validation**: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`)
- **Compression**: gzip via `compression` middleware
- **CORS**: from `CORS_ORIGIN` (comma-separated) or built-in defaults
- **Raw body** preserved for webhook HMAC verification

## Primary Data Flow (Ingestion → Publish)

After the pipeline persists catalog and listing rows, it enqueues one idempotent
`listing-optimization` job for the pipeline marketplace. Optimization derives and
validates structured fitment before the products enter the eBay publish path; a
pipeline is complete before optimization begins, but is not publish-ready until
that queued optimization has processed its products.

```
Upload / CSV / image
   → catalog-import or ingestion (BullMQ job)
   → AI enrichment (OpenAI: vision/text) + fitment extraction
   → motors-intelligence (attribute extraction, validation, review queue)
   → listing-record / catalog-product persisted (Postgres)
   → review/approve (review queues)
   → channels / integrations.ebay publish (BullMQ) → marketplace
   → order import + inventory sync (BullMQ, scheduled) ← marketplace
   → dashboard aggregation + notifications (WebSocket)
```

## Background Processing

BullMQ queues back nearly every heavy operation: `ingestion`, `pipeline`, `listing-optimization`, `catalog-import`, `fitment`, `inventory`, `orders`, `dashboard`, `channels`, `openai`, `motors-pipeline`, `storage-thumbnails`, `storage-cleanup`, `ebay-inventory-sync`, `ebay-order-sync`, `ebay-listing-publish`. Scheduled jobs via `@nestjs/schedule` in `common/scheduler`.

Details: [INTEGRATIONS.md](INTEGRATIONS.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

## Database

- PostgreSQL 16, TypeORM 0.3, 82 entities (78 unique tables), 27 migrations
- Schema: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
- Entities auto-loaded via `autoLoadEntities`
- `DB_SYNCHRONIZE=false` — schema changes via migrations only
- `DB_MIGRATIONS_RUN=true` runs on boot (default in Docker)

## Auth & RBAC

- JWT bearer tokens (Passport JWT), bcrypt 12 rounds
- 8 system roles, 73 permissions (`module.action` format)
- Source of truth: `backend/src/rbac/permission-registry.ts`
- Full details: [AUTH_RBAC.md](AUTH_RBAC.md)

## Known Structural Risks

- Some controllers declare `@Controller('api/...')` on top of the global `api` prefix → routes resolve at `/api/api/...` (**Needs verification**)
- Historical schema audit flags TEXT price columns, missing FKs, and tables not created by migrations
- Frontend and backend tests are sparse (24 backend `.spec.ts`, 0 e2e, 0 frontend)
- eBay OAuth token refresh fragility against live API

Full inventory: [/docs/context/KNOWN_ISSUES.md](../context/KNOWN_ISSUES.md).

## Key Domain Concepts

### Listing Lifecycle

| Status | Meaning |
|--------|---------|
| `draft` | Initial state, being edited |
| `ready` | Complete, awaiting publish |
| `published` | Live on marketplace(s) |
| `sold` | Item sold, no longer available |
| `delisted` | Removed from marketplace |
| `archived` | Historical record only |

---

*Consolidated & reorganized: 2026-06-06. Updated: 2026-06-11.*
