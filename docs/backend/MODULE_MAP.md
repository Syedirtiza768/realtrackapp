# Module Map

**2026-11-02 local candidate:** `MotoarkModule`
(`backend/src/integrations/motoark/motoark.module.ts`) imports scoped listing,
eBay authorization, RBAC, channel access, and warehouse services. It owns the
signed order-events API, durable retry processor, quantity projection, and
physical-return adapter. Existing `StockModule` exports reservation and
channel-sync services for this integration. See the
[complete lifecycle design](../architecture/MOTOARK_ORDER_LIFECYCLE.md).

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **Source**: Moved from `docs/BACKEND_MAP.md` (552 lines, 2026-05-29).
> Complete reference for the NestJS backend structure.
> For API endpoints, see [/docs/architecture/API_CONTRACTS.md](../architecture/API_CONTRACTS.md).
> For database entities, see [/docs/architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md).
> For services/controllers details, see [SERVICES_AND_CONTROLLERS.md](SERVICES_AND_CONTROLLERS.md).

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 11.0.1 | Framework |
| TypeScript | 5.7.3 | Language |
| TypeORM | 0.3.28 | ORM |
| PostgreSQL | 16 | Database |
| Redis | 7 | Cache + BullMQ |
| BullMQ | 5.70.1 | Job queues |
| Passport | 0.7.0 | Authentication |
| JWT | 11.0.2 | Token signing |
| Socket.IO | 4.8.3 | WebSocket |
| OpenAI | 6.25.0 | AI integration |
| AWS SDK | 3.998.0 | S3 storage |

---

## Application Structure

```
backend/src/
├── main.ts                    # Bootstrap, Swagger, CORS
├── app.module.ts              # Root module, global guards
├── app.controller.ts          # Root controller
├── app.service.ts             # Root service
├── data-source.ts             # TypeORM CLI config
├── auth/                      # Authentication
├── rbac/                      # Authorization
├── listings/                  # Listings
├── listing-optimization/      # Listing optimization
├── ingestion/                 # Ingestion pipeline
├── catalog-import/            # Catalog import
├── fitment/                   # Vehicle fitment
├── motors-intelligence/       # AI attribute extraction
├── channels/                  # Marketplace channels
├── integrations/ebay/         # eBay integration
├── inventory/                 # Inventory management
├── orders/                    # Order management
├── dashboard/                 # Dashboard + audit
├── settings/                  # Tenant settings
├── client-settings/           # White-label settings
├── automation/                # Automation rules
├── templates/                 # Listing templates
├── notifications/             # Notifications + WebSocket
├── storage/                   # S3 asset management
├── health/                    # Health checks
├── pricing-intelligence/      # Pricing rules
├── common/                    # Shared modules
│   ├── openai/                # OpenAI client
│   ├── scheduler/               # Cron jobs
│   └── feature-flags/         # Feature flags
├── migrations/                # TypeORM migrations
└── scripts/                   # Seed scripts
```

---

## Core Application Files

### `main.ts`

```typescript
- NestFactory.create(AppModule, { rawBody: true })
- Compression middleware (gzip level 6)
- CORS configuration
- Global prefix: '/api'
- ValidationPipe (whitelist, forbidNonWhitelisted, transform)
- Swagger UI at /api/docs (non-production)
- Listen on PORT (default 4191)
```

### `app.module.ts`

```typescript
imports:
  - ConfigModule (global, env vars)
  - EventEmitterModule
  - ScheduleModule
  - ThrottlerModule (10/s, 100/min, 1000/hr)
  - TypeOrmModule (PostgreSQL connection)
  - BullModule (Redis connection)
  - All feature modules (23 total)

providers (global guards):
  - ThrottlerGuard (rate limiting)
  - JwtAuthGuard (authentication)
  - PermissionsGuard (authorization)
```

### `data-source.ts`

TypeORM CLI configuration for migrations. `autoLoadEntities: true`, `migrations: [__dirname + '/migrations/*{.ts,.js}']`.

---

## Module Reference: Auth (`auth/`)

| File | Purpose |
|------|---------|
| `auth.module.ts` | Module definition |
| `auth.controller.ts` | Login, register, me, logout endpoints |
| `auth.service.ts` | Authentication logic, JWT signing |
| `jwt.strategy.ts` | Passport JWT strategy |
| `user-organization.service.ts` | User-org relationship management |
| `auth-audit.service.ts` | Authentication audit logging |
| `entities/user.entity.ts` | User entity |
| `entities/organization.entity.ts` | Organization entity |
| `entities/organization-member.entity.ts` | Membership entity |
| `guards/jwt-auth.guard.ts` | JWT authentication guard |
| `decorators/public.decorator.ts` | @Public() decorator |
| `decorators/current-user.decorator.ts` | @CurrentUser() decorator |
| `dto/login.dto.ts` | Login request DTO |
| `dto/register.dto.ts` | Register request DTO |

---

## Module Reference: RBAC (`rbac/`)

| File | Purpose |
|------|---------|
| `rbac.module.ts` | Module definition |
| `rbac.service.ts` | Role/permission business logic |
| `rbac-admin.controller.ts` | User/role management endpoints |
| `rbac-seed.service.ts` | Seed roles/permissions from registry |
| `permission-registry.ts` | **Source of truth** for permissions |
| `entities/role.entity.ts` | Role entity |
| `entities/permission.entity.ts` | Permission entity |
| `entities/role-permission.entity.ts` | Role-Permission join |
| `entities/user-role-assignment.entity.ts` | User-Role join |
| `guards/permissions.guard.ts` | Permission checking guard |
| `decorators/require-permissions.decorator.ts` | @RequirePermissions() decorator |

---

## Module Reference: Listings (`listings/`)

| File | Purpose |
|------|---------|
| `listings.module.ts` | Module definition |
| `listings.controller.ts` | Main listing endpoints |
| `listings-v2.controller.ts` | Cached listing endpoints |
| `listing-generation.controller.ts` | AI generation endpoints |
| `export-rule.controller.ts` | Export rule endpoints |
| `listings.service.ts` | Business logic |
| `search.service.ts` | Search functionality |
| `export-rule.service.ts` | Export rule logic |
| `listing-generation.service.ts` | AI generation logic |
| `entities/listing-record.entity.ts` | Main listing entity (76+ columns) |
| `entities/listing-revision.entity.ts` | Revision history |
| `entities/listing-compliance.entity.ts` | Compliance status |
| `entities/ebay-offer.entity.ts` | eBay offer data |
| `entities/ebay-category.entity.ts` | eBay category |
| `entities/master-product.entity.ts` | Master product |
| `entities/competitor-price.entity.ts` | Competitor pricing |
| `entities/cross-reference.entity.ts` | Cross-references |
| `entities/market-snapshot.entity.ts` | Market data |
| `entities/export-rule.entity.ts` | Export rules |

---

## Module Reference: Remaining Modules

### Ingestion (`ingestion/`)

`ingestion.module.ts`, `ingestion.controller.ts` (upload), `pipeline.controller.ts` (pipeline control), `ingestion.service.ts`, `pipeline.service.ts`, `enterprise-listing-intelligence.service.ts`, `processors/ingestion.processor.ts`, `processors/pipeline.processor.ts`, `image-enrichment/`, `review/`, `ai/`, `entities/ingestion-job.entity.ts`, `entities/pipeline-job.entity.ts`, `entities/ai-result.entity.ts`

### Catalog Import (`catalog-import/`)

`catalog-import.controller.ts`, `catalog-product.controller.ts`, `controllers/compliance.controller.ts`, `catalog-import.service.ts`, `catalog-product.service.ts`, `compliance.service.ts`, `processors/csv-import.processor.ts`, `entities/catalog-import.entity.ts`, `entities/catalog-product.entity.ts`, `entities/compliance-audit-log.entity.ts`

### Fitment (`fitment/`)

`fitment.controller.ts`, `fitment.service.ts`, `processors/fitment-import.processor.ts`, entities: `fitment-engine`, `fitment-make`, `fitment-model`, `fitment-submodel`, `fitment-year`, `part-fitment`, `vin-cache`

### Motors Intelligence (`motors-intelligence/`)

`controllers/motors-intelligence.controller.ts`, `controllers/review-queue.controller.ts`, `motors-intelligence.service.ts`, `review-queue.service.ts`, `processors/motors-pipeline.processor.ts`, ~10 entities

### Channels (`channels/`)

`channels.controller.ts`, `stores.controller.ts`, `ai-enhancement.controller.ts`, `ebay-publish.controller.ts`, `channels.service.ts`, `stores.service.ts`, `ai-enhancement.service.ts`, `ebay-publish.service.ts`, `processors/channel-publish.processor.ts`, ~7 entities

### eBay Integration (`integrations/ebay/`)

`controllers/integrations-ebay.controller.ts`, `controllers/ebay-multi-store.controller.ts`, services: `ebay-integrations-oauth`, `ebay-sync`, `ebay-policy-sync`, `ebay-listing`, `ebay-inventory`, `ebay-order`, processors: `ebay-listing-publish`, `ebay-inventory-sync`, `ebay-order-sync`, ~15 entities

### Published Listings (`published-listings/`)

`published-listings.controller.ts` exposes the organization-scoped listing mirror and detail APIs; `services/published-listings.service.ts` filters the database mirror, while the sync service refreshes it from eBay. The Primemotive JSON feed resolves the exact store associated with the authenticated organization and returns active published listings without a make-specific filter. Snapshot imports use a stable UUID cursor and listing revision; incremental changes use a committed sequence cursor. `includeCatalogData=true` optionally batch-loads linked `catalog_products` source fields for the page, restricted to same-organization or legacy null-organization rows; fitment projection includes only explicitly MVL-validated rows. These values are not canonical Partslink24 values. The migration-backed `/primemotive/changes` feed records added, edited, ended, and deleted listings; its optional HMAC-signed outbound callbacks require a configured URL, secret, and organization scope. Synthetic rows are marked `is_test_listing`; the opt-in simulator changes only those database rows and makes no eBay calls. The legacy sale-event receiver requires `published_listings.sales.notify` plus timestamped HMAC verification and records deduplicated receipts without changing inventory quantities.

### MotoArk (`integrations/motoark/`)

Deployed 2026-11-03. `motoark.controller.ts` exposes signed order events,
processing status, and warehouse-derived quantity lookup. `motoark.service.ts`
provides the organization-scoped durable inbox and ordered lifecycle processing;
`motoark-stock.service.ts` uses `stock` reservations/ledger for shipment,
cancellation, and physically inspected return flows. The separate lifecycle key
is required. Synthetic listings are safely rejected; unmapped or unavailable
stock remains pending. Marketplace stock push remains disabled.

### Inventory (`inventory/`)

`inventory.controller.ts`, `inventory.service.ts`, `inventory-workbench.service.ts`, `processors/inventory-sync.processor.ts`, entities: `inventory-event`, `inventory-ledger`, `store-inventory-allocation`. The Add Part photo lookup reads private S3 images with the app's AWS identity, avoids using a stale part-type field to choose its vision prompt, and syncs successful identity fields plus normalized title to the listing and matching CatalogProduct.

### Orders (`orders/`)

`orders.controller.ts`, `orders.service.ts`, `order-import-ebay.service.ts`, `processors/order-import.processor.ts`, entities: `order`, `order-item`

### Dashboard (`dashboard/`)

`dashboard.controller.ts` (includes audit-logs), `dashboard.service.ts`, `processors/aggregation.processor.ts`, entities: `audit-log`, `dashboard-cache`, `sales-record`

### Settings (`settings/`)

`settings.controller.ts`, `settings.service.ts`, entities: `tenant-setting`, `pricing-rule`, `shipping-profile`

### Client Settings (`client-settings/`)

`client-settings.controller.ts`, `client-settings.service.ts`, `client-settings.entity.ts`

### Other Modules

- **listing-optimization**: Processor for optimization queue
- **automation**: `automation.controller.ts`, automation rules
- **templates**: `template.controller.ts`, listing templates
- **notifications**: `notifications.controller.ts`, `notifications.gateway.ts` (Socket.IO)
- **storage**: `storage.controller.ts`, `image-drive.controller.ts`, `image-drive.service.ts`, `utils/image-drive-folder-upload.util.ts`, thumbnail + cleanup processors | S3 assets, thumbnails, flat Image Drive folders, recursive folder-tree uploads, and part-number lookup; same-origin proxy for official NAPA catalog images
- **health**: `health.controller.ts` (@Public, @nestjs/terminus)
- **pricing-intelligence**: `pricing-intelligence.controller.ts`
- **common/openai**: `openai.service.ts`, `openai-queue.service.ts`
- **common/scheduler**: `scheduler.service.ts` (cron)
- **common/feature-flags**: `feature-flag.controller.ts`, `feature-flag.entity.ts`

---

## Global Guards

Applied in order in `app.module.ts`:

1. **ThrottlerGuard** — 10/s, 100/min, 1000/hr
2. **JwtAuthGuard** — validates JWT; skipped with `@Public()`
3. **PermissionsGuard** — checks `@RequirePermissions()`

---

## Decorators

| Decorator | Location | Purpose |
|-----------|----------|---------|
| `@Public()` | `auth/decorators/public.decorator.ts` | Skip auth |
| `@CurrentUser()` | `auth/decorators/current-user.decorator.ts` | Inject user |
| `@RequirePermissions(...)` | `rbac/decorators/require-permissions.decorator.ts` | Require permissions |

---

## Migrations

21 files in `backend/src/migrations/`. Commands: `npm run migration:run`, `:generate`, `:revert`, `:show`.

## Scripts

`seed-rbac.ts`, `seed-demo-ebay.ts` in `backend/src/scripts/`.

---

*Reorganized: 2026-06-06.*

## Fashion vertical module (2026-09-09)

backend/src/verticals contains VerticalsModule, FashionController, FashionListingsService, FashionImageAnalysisService, VerticalsService, FashionReview, and the vertical configuration/DTOs. FashionController owns organization-scoped drafts, photo upload, multi-image identification, listing-text generation, review decisions, private evidence metadata, quarantine, store configuration, and Fashion role administration. Photo storage reuses StorageService and ImageProcessorService; Fashion vision uses short-lived signed GET URLs for private S3 image keys; identification reuses OpenAiService vision and EbayTaxonomyApiService. The eBay integration module exposes the vertical-tagged Fashion OAuth start route while the shared callback preserves the destination.
backend/src/verticals contains VerticalsModule, FashionController, FashionListingsService, FashionImageAnalysisService, VerticalsService, FashionReview, and the vertical configuration/DTOs. FashionController owns organization-scoped drafts, photo upload, multi-image identification, listing-text generation, review decisions, private evidence metadata, quarantine, store configuration, and Fashion role administration. Photo storage reuses StorageService and ImageProcessorService; identification reuses OpenAiService vision and EbayTaxonomyApiService. The eBay integration module exposes vertical-tagged Fashion and B&I OAuth start routes; the shared callback returns successful connections to the store page for the vertical saved in OAuth state.
**Quick capture (2026-09-28):** `FashionIntakeController` (`/api/fashion/measurement-templates`, `warehouses`, `intake`, `intake/sku`, `intake/batches`, `listings/:id/identify`, `listings/size-chart`, `listings/photos/banner`), `FashionIntakeService` (warehouses, atomic batch SKUs, capture → `FashionListingsService.create`, background merge), `FashionIntakeProcessor` (BullMQ `fashion-intake-analysis`, concurrency 2), `FashionIntakeImagesService` (sharp-rendered size chart and banners), `fashion-measurements.ts` (templates/diagrams), `fashion-storage-keys.util.ts`, entities `FashionWarehouse` and `FashionSkuCounter`. `FashionImageAnalysisService.analyzeImages` is the user-independent core used by the job. See docs/architecture/FASHION_QUICK_CAPTURE.md.

## Business & Industrial vertical module (2026-09-09)

`backend/src/verticals/business-industrial.controller.ts` and
`business-industrial.service.ts` own the organization-scoped B&I workspace,
explicit category-family/specification validation, review records, serialized
units, local quarantine, verified incident intake, dedicated stores, and
vertical-role administration. `business-industrial.config.ts` is the
deliberate attribute/unit contract; `business-industrial-import.ts` is the
allowlisted spreadsheet mapper. The eBay integration adds
`controllers/business-industrial-ebay.controller.ts` for vertical-tagged OAuth
and approved publish jobs. `1790500000000-BusinessIndustrialWorkspaceSecurity`
contains the additive persistence tables.

## B&I image intake (2026-09-10)

`business-industrial-image-intake.controller.ts` exposes the protected upload,
progress, group review, Excel export, and draft-application routes.
`business-industrial-image-intake.service.ts` owns organization isolation,
folder-instance grouping, S3 persistence, centralized vision calls, eBay
Taxonomy leaf/aspect resolution, AI audit logging, draft creation, and export.
`business-industrial-image-intake.processor.ts` runs the
`business-industrial-image-intake` BullMQ queue sequentially to control model
and taxonomy rate limits.

The same service exposes a full-root public-Drive route. It enumerates
server-side Drive children using GOOGLE_DRIVE_API_KEY, downloads every item
folder and every supported image; local uploads keep the separate 5,000-image safety limit, canonicalizes
images to WebP before S3, invokes openai/gpt-5.6-luna-20260709 for vision,
evidence-bound listing copy, and the shared Browse-backed price suggestion, and
aggregates spend from ai_run_logs. Decimal dot-suffix folders remain independent exact-folder SKUs. Successful draft application writes both
the B&I CatalogProduct and a shared ListingRecord inventory projection; reruns overwrite the existing exact-folder catalog SKU in place.

## Shared catalog module (2026-09-12)

`backend/src/catalog/catalog.module.ts` registers the shared
`CatalogWorkspaceService` and vertical controllers. Search, suggest, facets,
detail, inline patch, bulk team/policy/delete, and server-side CSV export use
the common `catalog_products` projection while delegating vertical edits to
FashionListingsService and BusinessIndustrialService. Publication summaries
join only organization/vertical-matching eBay channels whose stores are
accessible to the caller. Fashion bulk publish is exposed through the existing
durable eBay multi-store job service.

## Stock module (2026-10-05)

`backend/src/stock/` — `StockModule` (imports Auth, Channels, Notifications, FeatureFlag, Scheduler; registers BullMQ queue `stock-channel-sync`).

| File | Responsibility |
|---|---|
| `stock-ledger.service.ts` | The only writer of `stock_levels`/`stock_movements`. It handles locking, invariants, idempotency, the outbox and the legacy quantity projection |
| `stock-access.service.ts` | Org + warehouse scoping |
| `warehouses.service.ts`, `suppliers.service.ts`, `inventory-items.service.ts` | Warehouses/bins/store links/policies; suppliers/sources; SKU master, search, detail, scan |
| `stock-operations.service.ts` | Receive, adjust, move, damage; transfers; counts; adjustment approval; document and ledger listing |
| `reservations.service.ts`, `order-stock.service.ts` | Allocation primitive; order event listeners, pick, ship, release, backorder retry |
| `procurement.service.ts` | Procurement requests, purchase orders, receive-to-order, dropship, reorder |
| `channel-stock-sync.service.ts` + `.processor.ts` | Desired quantity, targets, push or shadow, crons |
| `stock-setup.service.ts`, `stock-reports.service.ts`, `stock-intake.listener.ts` | Bootstrap; reports; vertical intake events |
| `stock.controller.ts`, `stock-procurement.controller.ts` | `/api/stock/*` |

Design: [../architecture/WAREHOUSE_INVENTORY.md](../architecture/WAREHOUSE_INVENTORY.md).

## Fashion capture services (2026-10-09)

FashionIntakeController exposes protected capture, warehouse, batch/SKU, generated-image, retry, Catalog handoff, and activity-report APIs. FashionIntakeService stores capture state on catalog_products, writes handoff audit rows, and executes filtered report/CSV queries. FashionIntakeProcessor runs the fashion-intake-analysis BullMQ queue. FashionIntakeImagesService renders branded charts/banners and stores them as WebP. FashionWarehouse and FashionSkuCounter are registered in VerticalsModule and created by migration 1791000000000-CreateFashionIntake.
