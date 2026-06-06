> ⚠️ MOVED → [/docs/context/SYSTEM_MAP.md](../context/SYSTEM_MAP.md) and [/docs/backend/SERVICES_AND_CONTROLLERS.md](../backend/SERVICES_AND_CONTROLLERS.md) (2026-06-06)

# Codebase Map

Repository root: `F:\apps\realtrackapp`. Monorepo-style: frontend at root `src/`,
backend under `backend/`.

## Top-level layout

| Path | Purpose |
|------|---------|
| `src/` | React + Vite frontend (components, lib API clients, contexts, hooks, types) |
| `backend/` | NestJS API, TypeORM entities/migrations, BullMQ processors |
| `docs/` | Documentation (this set + prior audit/feature docs) |
| `scripts/` | Standalone Node/Python utility scripts (eBay tooling, importers, analyzers) |
| `docker/` | nginx + postgres init scripts for Docker |
| `docker-compose.yml`, `Dockerfile`, `backend/Dockerfile` | Container build/run |
| `deploy.sh`, `ecosystem.config.cjs`, `nginx.conf` | Deployment helpers (PM2 / nginx) |
| `listingpro.dump` | Postgres seed dump (restored on first volume init) |
| `eBay-*.xlsx` | eBay listing template spreadsheets (mounted into backend container) |
| `uploads/`, `output/`, `dist/` | Runtime artifacts (not source) |

## Frontend (`src/`)

| Path | Purpose |
|------|---------|
| `App.tsx` | Route table; wraps app in `QueryProvider` → `AuthProvider` → `BrandingProvider` → `Router`. All app routes guarded by `ProtectedRoute` + permission props. |
| `main.tsx` | React entry |
| `components/<domain>/` | Feature UIs: `dashboard`, `listings`, `catalog`, `catalog-import`, `fitment`, `ingestion`, `inventory`, `orders`, `motors`, `pipeline`, `channels`, `pricing`, `templates`, `automation`, `notifications`, `settings`, `audit`, `sku`, `preview`, `auth`, `layout`, `ui` |
| `lib/*Api.ts` | Per-domain fetch clients (e.g. `listingsApi.ts`, `motorsApi.ts`, `ebayIntegrationsApi.ts`, `multiStoreApi.ts`, `catalogImportApi.ts`) |
| `lib/authApi.ts` | `fetchWithAuth` wrapper — injects JWT from `localStorage`, redirects to `/login` on 401 |
| `lib/permissions.ts`, `hooks/usePermissions.ts` | Frontend RBAC helpers (`<Can>`, route gating) |
| `lib/queryProvider.tsx` | TanStack Query setup |
| `contexts/BrandingContext.tsx`, `hooks/usePublicBranding.ts` | White-label branding |
| `types/` | Shared TS types (`catalog.ts`, `platform.ts`, etc.) |

> Frontend talks to the backend via relative `/api/...` paths (Vite proxy in dev,
> nginx reverse proxy in Docker). JWT stored in `localStorage` (`mk_auth_token`).

## Backend (`backend/src/`)

One folder per NestJS module. Common shape: `*.module.ts`, `*.controller.ts`,
`*.service.ts`, `entities/`, `dto/`, `processors/` (BullMQ).

| Module | Path | Purpose / key files |
|--------|------|---------------------|
| auth | `auth/` | Login/register/me, JWT issue, password hashing. `auth.service.ts`, `guards/jwt-auth.guard.ts`, `decorators/{public,current-user}.decorator.ts`, `user-organization.service.ts` |
| rbac | `rbac/` | Roles/permissions. `permission-registry.ts` (source of truth), `guards/permissions.guard.ts`, `rbac.service.ts`, `rbac-admin.controller.ts`, `rbac-seed.service.ts` |
| listings | `listings/` | Core listing CRUD + v2 + generation + export rules. `listing-record.entity.ts`, `listings.controller.ts`, `listings-v2.controller.ts`, `listing-generation.controller.ts`, `export-rule.controller.ts`, entities for offers/categories/competitor-price/master-product |
| listing-optimization | `listing-optimization/` | Optimization pipeline queue + processor |
| ingestion | `ingestion/` | Image/AI ingestion + pipeline. `ingestion.controller.ts`, `pipeline.controller.ts`, `processors/{ingestion,pipeline}.processor.ts`, `image-enrichment/`, `review/`, `ai/`, `enterprise-listing-intelligence.service.ts` |
| catalog-import | `catalog-import/` | CSV/catalog import + compliance. `catalog-import.controller.ts`, `catalog-product.controller.ts`, `controllers/compliance.controller.ts`, `processors/csv-import.processor.ts` |
| fitment | `fitment/` | Vehicle fitment (YMMT), VIN cache. `fitment.controller.ts`, fitment entities, `processors/fitment-import.processor.ts` |
| motors-intelligence | `motors-intelligence/` | AI Motors pipeline: candidates, attribute extraction, validation, review. `controllers/{motors-intelligence,review-queue}.controller.ts`, `processors/motors-pipeline.processor.ts` |
| channels | `channels/` | Marketplace channel abstraction, AI enhancements, stores, eBay publish. `channels.controller.ts`, `stores.controller.ts`, `ai-enhancement.controller.ts`, `ebay/ebay-publish.controller.ts`, `processors/channel-publish.processor.ts` |
| integrations/ebay | `integrations/ebay/` | eBay multi-account/multi-store OAuth + sync + publish. `controllers/{integrations-ebay,ebay-multi-store}.controller.ts`, many services (`ebay-integrations-oauth.service.ts`, `ebay-sync.service.ts`, `ebay-policy-sync.service.ts`), processors for sync/publish |
| inventory | `inventory/` | Inventory ledger, allocations, events. `inventory.controller.ts`, `processors/inventory-sync.processor.ts` |
| orders | `orders/` | Order CRUD + eBay order import. `orders.controller.ts`, `order-import-ebay.service.ts`, `processors/order-import.processor.ts` |
| dashboard | `dashboard/` | KPI aggregation, audit-logs, sales records. `dashboard.controller.ts` (also hosts `audit-logs`), `processors/aggregation.processor.ts` |
| pricing-intelligence | `pricing-intelligence/` | Pricing rules/insights. `pricing-intelligence.controller.ts` |
| settings | `settings/` | Tenant settings, pricing rules, shipping profiles. `settings.controller.ts` |
| client-settings | `client-settings/` | White-label branding/theme (super-admin). `client-settings.controller.ts` |
| automation | `automation/` | Automation rules. `automation.controller.ts` |
| templates | `templates/` | Listing templates. `template.controller.ts` |
| notifications | `notifications/` | In-app + WebSocket notifications. `notifications.controller.ts` |
| storage | `storage/` | S3 image assets, thumbnails, cleanup. `storage.controller.ts`, `processors/{thumbnail,cleanup}.processor.ts` |
| health | `health/` | Liveness/readiness (`@nestjs/terminus`). `health.controller.ts` (`@Public()`) |
| common/openai | `common/openai/` | OpenAI client + queued calls. `openai-queue.service.ts` |
| common/scheduler | `common/scheduler/` | Cron-scheduled jobs feeding queues |
| common/feature-flags | `common/feature-flags/` | Feature flag entity + controller |

## Migrations & data layer

- Entities discovered via `autoLoadEntities` + glob in `data-source.ts`.
- Migrations: `backend/src/migrations/*.ts` (21 files; phased naming).
- See [database.md](database.md).
