# Codebase Map

> File and module reference for navigating the RealTrackApp codebase.
> For architecture overview, see `/docs/architecture/overview.md`.
> For API details, see `/docs/architecture/api-map.md`.

---

## Repository Root Structure

```
F:\apps\realtrackapp/
├── src/                          # React frontend source
├── backend/                      # NestJS backend
│   └── src/                      # Backend source
├── docs/                         # Documentation
├── docker/                       # Docker configuration
├── scripts/                      # Utility scripts
├── uploads/                      # Runtime uploads (not in git)
├── output/                       # Runtime output (not in git)
├── dist/                         # Build output (not in git)
├── docker-compose.yml            # Full stack orchestration
├── Dockerfile                    # Frontend container
├── backend/Dockerfile            # Backend container
├── nginx.conf                    # Nginx configuration
├── ecosystem.config.cjs          # PM2 configuration
├── deploy.sh                     # Deployment script
├── listingpro.dump               # Postgres seed dump
├── package.json                  # Frontend dependencies
├── vite.config.ts                # Vite configuration
├── tailwind.config.js            # Tailwind CSS config
└── .env.example                  # Environment template
```

---

## Frontend (`src/`)

### Entry Points

| File | Purpose |
|------|---------|
| `main.tsx` | React entry point, renders `<App />` |
| `App.tsx` | Route table, provider wrapping |
| `index.css` | Global styles + Tailwind directives |

### Components Structure

```
src/components/
├── auth/               # Login, register, forgot password
├── layout/             # Shell, navigation, layout components
├── ui/                 # Reusable UI components (buttons, inputs, etc.)
├── dashboard/          # Dashboard, KPIs, charts
├── listings/           # Listing editor, revision history
├── catalog/            # Catalog manager, bulk actions, eBay publish
├── catalog-import/     # CSV import, motors filters
├── ingestion/          # Ingestion manager UI
├── pipeline/           # Pipeline wizard
├── motors/             # Motors dashboard, review queue, AI upload
├── fitment/            # Fitment manager, VIN listings
├── inventory/          # Inventory manager
├── orders/             # Orders page
├── settings/           # Settings pages (general, eBay, users, permissions)
├── templates/          # Template manager
├── automation/         # Automation rules
├── notifications/      # Notifications page
├── audit/              # Audit trail
├── sku/                # SKU detail page
├── preview/            # eBay listing preview
└── channels/           # eBay OAuth callback
```

### Library (`src/lib/`)

| File | Purpose |
|------|---------|
| `authApi.ts` | `fetchWithAuth` wrapper, JWT handling, 401 redirect |
| `queryProvider.tsx` | TanStack Query setup |
| `permissions.ts` | Frontend RBAC helpers |
| `listingsApi.ts` | Listings API client |
| `catalogImportApi.ts` | Catalog import API |
| `catalogProductsApi.ts` | Catalog products API |
| `motorsApi.ts` | Motors intelligence API |
| `ebayIntegrationsApi.ts` | eBay integration API |
| `multiStoreApi.ts` | Multi-store API |
| `fitmentApi.ts` | Fitment API |
| `fitmentVinListingsApi.ts` | VIN listings API |
| `ordersApi.ts` | Orders API |
| `inventoryApi.ts` | Inventory API |
| `channelsApi.ts` | Channels API |
| `publishApi.ts` | Publish operations API |
| `pricingApi.ts` | Pricing intelligence API |
| `templateApi.ts` | Templates API |
| `pipelineApi.ts` | Pipeline API |
| `listingGenerationApi.ts` | AI listing generation API |
| `rbacApi.ts` | RBAC admin API |
| `clientBrandingApi.ts` | Client branding API |
| `searchApi.ts` | Search API |
| `ingestionAdapters.ts` | Ingestion adapters |
| `ingestionPipeline.ts` | Ingestion pipeline helpers |
| `persistence.ts` | Local storage helpers |
| `sanitize.ts` | Sanitization utilities |
| `ebayFileExchangeParser.ts` | eBay file parsing |
| `catalogDestructiveUi.ts` | Catalog UI helpers |
| `listingsQueryHooks.ts` | React Query hooks for listings |

### Contexts (`src/contexts/`)

| File | Purpose |
|------|---------|
| `BrandingContext.tsx` | White-label branding provider |
| `AuthContext.tsx` | Authentication provider (in components/auth/) |

### Hooks (`src/hooks/`)

| File | Purpose |
|------|---------|
| `usePermissions.ts` | RBAC permission checking |
| `usePublicBranding.ts` | Public branding fetch |

### Types (`src/types/`)

| File | Purpose |
|------|---------|
| `catalog.ts` | Catalog-related types |
| `platform.ts` | Platform types |
| (others as needed) |

---

## Backend (`backend/src/`)

### Core Application Files

| File | Purpose |
|------|---------|
| `main.ts` | NestJS bootstrap, Swagger, CORS, global pipes |
| `app.module.ts` | Root module, imports all feature modules, global guards |
| `app.controller.ts` | Root controller |
| `app.service.ts` | Root service |
| `data-source.ts` | TypeORM CLI configuration for migrations |

### Module Structure

Each module follows standard NestJS structure:
```
module-name/
├── module-name.module.ts
├── module-name.controller.ts
├── module-name.service.ts
├── dto/                    # Data transfer objects
├── entities/               # TypeORM entities
├── processors/             # BullMQ job processors
├── guards/                 # Module-specific guards
└── decorators/             # Module-specific decorators
```

### Module Reference

| Module | Path | Key Files | Purpose |
|--------|------|-----------|---------|
| **auth** | `auth/` | `auth.controller.ts`, `auth.service.ts`, `jwt.strategy.ts`, `user-organization.service.ts` | JWT auth, login, register, user management |
| **rbac** | `rbac/` | `permission-registry.ts`, `rbac.service.ts`, `rbac-admin.controller.ts`, `guards/permissions.guard.ts` | Roles, permissions, access control |
| **listings** | `listings/` | `listings.controller.ts`, `listings-v2.controller.ts`, `listing-generation.controller.ts`, `export-rule.controller.ts`, `listing-record.entity.ts` | Listing CRUD, revisions, AI generation |
| **listing-optimization** | `listing-optimization/` | `listing-optimization.processor.ts` | Listing optimization queue |
| **ingestion** | `ingestion/` | `ingestion.controller.ts`, `pipeline.controller.ts`, `processors/ingestion.processor.ts`, `processors/pipeline.processor.ts` | Image/AI ingestion pipeline |
| **catalog-import** | `catalog-import/` | `catalog-import.controller.ts`, `catalog-product.controller.ts`, `compliance.controller.ts`, `processors/csv-import.processor.ts` | CSV import, compliance |
| **fitment** | `fitment/` | `fitment.controller.ts`, `processors/fitment-import.processor.ts` | Vehicle fitment (YMMT) |
| **motors-intelligence** | `motors-intelligence/` | `motors-intelligence.controller.ts`, `review-queue.controller.ts`, `processors/motors-pipeline.processor.ts` | AI attribute extraction |
| **channels** | `channels/` | `channels.controller.ts`, `stores.controller.ts`, `ai-enhancement.controller.ts`, `ebay-publish.controller.ts`, `processors/channel-publish.processor.ts` | Marketplace channel abstraction |
| **integrations/ebay** | `integrations/ebay/` | `controllers/integrations-ebay.controller.ts`, `controllers/ebay-multi-store.controller.ts`, `services/ebay-integrations-oauth.service.ts`, `services/ebay-sync.service.ts`, `processors/` | eBay OAuth, multi-store, sync |
| **inventory** | `inventory/` | `inventory.controller.ts`, `processors/inventory-sync.processor.ts` | Inventory ledger, allocations |
| **orders** | `orders/` | `orders.controller.ts`, `order-import-ebay.service.ts`, `processors/order-import.processor.ts` | Order management |
| **dashboard** | `dashboard/` | `dashboard.controller.ts`, `processors/aggregation.processor.ts` | KPIs, audit logs |
| **settings** | `settings/` | `settings.controller.ts` | Tenant settings, pricing rules |
| **client-settings** | `client-settings/` | `client-settings.controller.ts` | White-label branding |
| **automation** | `automation/` | `automation.controller.ts` | Automation rules |
| **templates** | `templates/` | `template.controller.ts` | Listing templates |
| **notifications** | `notifications/` | `notifications.controller.ts`, `notifications.gateway.ts` | WebSocket notifications |
| **storage** | `storage/` | `storage.controller.ts`, `processors/thumbnail.processor.ts`, `processors/cleanup.processor.ts` | S3 assets, thumbnails |
| **health** | `health/` | `health.controller.ts` | Health checks (@Public) |
| **pricing-intelligence** | `pricing-intelligence/` | `pricing-intelligence.controller.ts` | Pricing rules |
| **common/openai** | `common/openai/` | `openai-queue.service.ts` | OpenAI client, queued calls |
| **common/scheduler** | `common/scheduler/` | `scheduler.service.ts` | Cron jobs feeding queues |
| **common/feature-flags** | `common/feature-flags/` | `feature-flag.controller.ts`, `feature-flag.entity.ts` | Feature flags |

### Migrations (`migrations/`)

| Migration | Purpose |
|-----------|---------|
| `1708999999990-ListingRecordsBase.ts` | Base listing tables |
| `1708999999999-InitialSchema.ts` | Initial schema |
| `1709078400000-Phase1SafeFoundations.ts` | Foundational tables |
| `1709164800000-Phase2AutomationAndTemplates.ts` | Automation + templates |
| `1709251200000-Phase3PriceTypesMigration.ts` | Price column type fixes |
| `1709337600000-Phase3ComplianceSatellite.ts` | Compliance tables |
| `1709424000000-Phase3Partitioning.ts` | Partitioning |
| `1709510400000-Phase3DeprecateChannelListings.ts` | Channel listing deprecation |
| `1709596800000-Phase3MultiTenant.ts` | Multi-tenant columns |
| `1709683200000-Phase4MultiStoreFoundation.ts` | Multi-store base |
| `1709769600000-MotorsIntelligenceSystem.ts` | Motors AI pipeline tables |
| `1772145877171-Migration.ts` | Generated migration |
| `1772600000000-CatalogImportSystem.ts` | Catalog import tables |
| `1774000000000-Phase1UpgradeSchema.ts` | Upgrade schema |
| `1774100000000-Phase2VinCache.ts` | VIN cache |
| `1774300000000-ListingRecordsSearchVectorTrigger.ts` | Full-text search |
| `1775200000000-EbayMultiAccountIntegration.ts` | eBay multi-account |
| `1775300000000-EbayMultiStoreExtensions.ts` | eBay multi-store |
| `1775300000000-ListingOptimizationPipeline.ts` | Optimization pipeline |
| `1775400000000-RbacFoundation.ts` | RBAC tables |
| `1775400000001-ClientSettings.ts` | Client settings |

### Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `seed-rbac.ts` | Seed RBAC roles/permissions |
| `seed-demo-ebay.ts` | Seed demo eBay data |

---

## Docker Configuration

### `docker-compose.yml`

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| postgres | postgres:16-alpine | 5432 | PostgreSQL database |
| redis | redis:7-alpine | 6379 | Redis cache + BullMQ |
| backend | (Dockerfile) | 4191 | NestJS API |
| frontend | (Dockerfile) | 8050 | Nginx + built React |

### `docker/` Directory

```
docker/
├── nginx/
│   └── nginx.conf          # Nginx configuration
└── postgres/
    └── init/
        └── 01-restore-listingpro.sh  # Seed dump restore script
```

### Dockerfiles

| File | Purpose |
|------|---------|
| `Dockerfile` | Frontend: Node build + Nginx serve |
| `backend/Dockerfile` | Backend: Node production image |

---

## Scripts Directory (`scripts/`)

| Script | Purpose |
|--------|---------|
| `import-ebay-inventory.mjs` | eBay inventory import utility |
| `run-migrations.ps1` | PowerShell migration helper |
| (other utility scripts) |

---

## Configuration Files

| File | Purpose |
|------|---------|
| `.env.example` | Environment variable template |
| `vite.config.ts` | Vite dev server, proxy config |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |
| `tsconfig.json` | TypeScript config (frontend) |
| `tsconfig.app.json` | TypeScript app config |
| `tsconfig.node.json` | TypeScript node config |
| `backend/tsconfig.json` | Backend TypeScript config |
| `nginx.conf` | Nginx reverse proxy config |
| `ecosystem.config.cjs` | PM2 process manager config |
| `deploy.sh` | Deployment automation script |

---

## Key Entity Files by Domain

### Auth/RBAC
- `backend/src/auth/entities/user.entity.ts`
- `backend/src/auth/entities/organization.entity.ts`
- `backend/src/auth/entities/organization-member.entity.ts`
- `backend/src/rbac/entities/role.entity.ts`
- `backend/src/rbac/entities/permission.entity.ts`

### Listings
- `backend/src/listings/entities/listing-record.entity.ts`
- `backend/src/listings/entities/listing-revision.entity.ts`
- `backend/src/listings/entities/listing-compliance.entity.ts`

### Catalog
- `backend/src/catalog-import/entities/catalog-product.entity.ts`
- `backend/src/catalog-import/entities/catalog-import.entity.ts`

### eBay Integration
- `backend/src/integrations/ebay/entities/connected-ebay-account.entity.ts`
- `backend/src/integrations/ebay/entities/ebay-oauth-token.entity.ts`
- `backend/src/integrations/ebay/entities/internal-store.entity.ts`

### Orders/Inventory
- `backend/src/orders/entities/order.entity.ts`
- `backend/src/orders/entities/order-item.entity.ts`
- `backend/src/inventory/entities/inventory-ledger.entity.ts`

### Motors
- `backend/src/motors-intelligence/entities/motors-product.entity.ts`
- `backend/src/motors-intelligence/entities/product-candidate.entity.ts`

---

## Navigation Tips

1. **Finding a feature**: Check `src/App.tsx` (frontend routes) or `backend/src/app.module.ts` (backend modules)
2. **API endpoint**: Look in `backend/src/*/controllers/` or check `/docs/architecture/api-map.md`
3. **Database table**: Find the entity in `backend/src/*/entities/` or check `/docs/architecture/database.md`
4. **Permission**: Check `backend/src/rbac/permission-registry.ts`
5. **Queue processor**: Look in `backend/src/*/processors/`

---

*Last updated: 2026-05-29*
