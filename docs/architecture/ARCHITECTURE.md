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
| Storage | AWS S3 (+ presigned URLs), Sharp for thumbnails |
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
 browser ──▶│ frontend    │  nginx:1.27-alpine, serves built Vite assets
            │ :8050 → :80 │  reverse-proxies /api → backend
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
```

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
