# Architecture Overview

> Authoritative high-level map of RealTrackApp. For deeper detail see the sibling
> docs in `/docs/architecture/`. Update this file whenever a module, integration,
> or major data flow is added/removed.

## What it is

RealTrackApp (DB/internal name: **listingpro**; login screen still says "ListingPro")
is a multi-channel **automotive parts listing & operations platform**. It ingests
product data (CSV/catalog import, images, spreadsheets), enriches it with AI,
manages fitment/compatibility, and publishes/syncs listings to marketplaces
(primarily **eBay**, with Shopify scaffolding), while handling orders, inventory,
pricing, dashboards, automation, and audit.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, TypeScript, Tailwind CSS, React Router 7, TanStack Query 5 |
| Backend | NestJS 11, TypeORM 0.3, Passport JWT |
| Database | PostgreSQL 16 |
| Cache / Queues | Redis 7 + BullMQ |
| Realtime | Socket.IO (`@nestjs/websockets`) |
| AI | OpenAI (chat + vision + embeddings) |
| Storage | AWS S3 (+ presigned URLs), Sharp for thumbnails |
| Infra | Docker Compose (postgres, redis, backend, frontend/nginx); PM2 (`ecosystem.config.cjs`) |

## Ports

| Service | Port | Notes |
|---------|------|-------|
| Backend (NestJS) | 4191 | Global prefix `/api`; Swagger at `/api/docs` (non-prod) |
| Frontend (Vite dev) | 3911 | Proxies `/api` → `localhost:4191` (`vite.config.ts`) |
| Frontend (Docker/nginx) | 8050 | `FRONTEND_PORT`; serves built assets |
| PostgreSQL | 5432 | `DB_PORT_EXTERNAL` |
| Redis | 6379 | `REDIS_PORT_EXTERNAL` |

> Note: `CLAUDE.md` historically says frontend port 8050 — that is the Docker port.
> Local `npm run dev` runs on **3911**.

## Backend modules (NestJS)

Registered in `backend/src/app.module.ts`:

`auth`, `rbac`, `listings`, `health`, `storage`, `ingestion`, `catalog-import`,
`fitment`, `channels`, `inventory`, `orders`, `dashboard`, `settings`,
`notifications`, `common/scheduler`, `common/feature-flags`, `automation`,
`templates`, `motors-intelligence`, `common/openai`, `pricing-intelligence`,
`integrations/ebay`, `client-settings`. Plus `listing-optimization` (imported via ingestion).

See [codebase-map.md](codebase-map.md) for per-module purpose and key files.

## Cross-cutting concerns

- **Global guards** (order matters), declared in `app.module.ts`:
  1. `ThrottlerGuard` (rate limiting: 10/s, 100/min, 1000/hr)
  2. `JwtAuthGuard` (authentication; `@Public()` opts out)
  3. `PermissionsGuard` (RBAC; `@RequirePermissions('module.action')`)
- **Validation**: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).
- **Compression**: gzip via `compression` middleware.
- **CORS**: from `CORS_ORIGIN` (comma-separated) or built-in defaults.
- **Raw body** preserved for webhook HMAC verification.

## Primary data flow (ingestion → publish)

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

## Background processing

BullMQ queues back nearly every heavy operation. Queues:
`ingestion`, `pipeline`, `listing-optimization`, `catalog-import`, `fitment`,
`inventory`, `orders`, `dashboard`, `channels`, `openai`, `motors-pipeline`,
`storage-thumbnails`, `storage-cleanup`, `ebay-inventory-sync`,
`ebay-order-sync`, `ebay-listing-publish`. Scheduled jobs via `@nestjs/schedule`
in `common/scheduler`. See [integrations.md](integrations.md) and
[deployment.md](deployment.md).

## Known structural risks (summary)

- Some controllers declare `@Controller('api/...')` on top of the global `api`
  prefix → routes resolve at `/api/api/...`. **Needs verification** (see
  [api-map.md](api-map.md)).
- Historical schema audit (`docs/FULL_SYSTEM_AUDIT_AND_ROADMAP.md`) flags TEXT
  price columns, missing FKs, and tables not created by migrations.
- Frontend and backend tests are sparse (9 backend `.spec.ts`, 1 e2e).

Full inventory of risks: [/docs/handover/risk-register.md](../handover/risk-register.md).
