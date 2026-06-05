# Backend Map

> Complete reference for the NestJS backend structure.
> For API endpoints, see `/docs/API_MAP.md`.
> For database entities, see `/docs/DATABASE_MAP.md`.

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

Application bootstrap:

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

Root module configuration:

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

TypeORM CLI configuration for migrations:

```typescript
- Same DB config as app.module.ts
- autoLoadEntities: true
- migrations: [__dirname + '/migrations/*{.ts,.js}']
```

---

## Module Reference

### Auth Module (`auth/`)

**Purpose**: JWT authentication, user management

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

**Endpoints**: See `/docs/API_MAP.md` → Auth

---

### RBAC Module (`rbac/`)

**Purpose**: Role-based access control

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

**Permission Registry**: `backend/src/rbac/permission-registry.ts`
- 8 system roles
- ~90 permissions
- Default role assignments

**Endpoints**: See `/docs/API_MAP.md` → RBAC

---

### Listings Module (`listings/`)

**Purpose**: Listing CRUD, revisions, generation

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
| `dto/*.dto.ts` | Request/response DTOs |

**Endpoints**: See `/docs/API_MAP.md` → Listings

---

### Listing Optimization Module (`listing-optimization/`)

**Purpose**: Listing optimization pipeline

| File | Purpose |
|------|---------|
| `listing-optimization.module.ts` | Module definition |
| `listing-optimization.processor.ts` | BullMQ processor |

---

### Ingestion Module (`ingestion/`)

**Purpose**: Image/file ingestion, AI pipeline

| File | Purpose |
|------|---------|
| `ingestion.module.ts` | Module definition |
| `ingestion.controller.ts` | Upload endpoints |
| `pipeline.controller.ts` | Pipeline control endpoints |
| `ingestion.service.ts` | Ingestion logic |
| `pipeline.service.ts` | Pipeline orchestration |
| `enterprise-listing-intelligence.service.ts` | AI analysis |
| `processors/ingestion.processor.ts` | Ingestion job processor |
| `processors/pipeline.processor.ts` | Pipeline job processor |
| `image-enrichment/image-enrichment.controller.ts` | Image AI endpoints |
| `image-enrichment/image-enrichment.service.ts` | Image AI logic |
| `review/review.controller.ts` | Review queue endpoints |
| `review/review.service.ts` | Review queue logic |
| `ai/ai-analysis.service.ts` | AI analysis utilities |
| `entities/ingestion-job.entity.ts` | Ingestion job |
| `entities/pipeline-job.entity.ts` | Pipeline job |
| `entities/ai-result.entity.ts` | AI analysis results |

**Endpoints**: See `/docs/API_MAP.md` → Ingestion

---

### Catalog Import Module (`catalog-import/`)

**Purpose**: CSV import, compliance

| File | Purpose |
|------|---------|
| `catalog-import.module.ts` | Module definition |
| `catalog-import.controller.ts` | Import endpoints |
| `catalog-product.controller.ts` | Product endpoints |
| `controllers/compliance.controller.ts` | Compliance endpoints |
| `catalog-import.service.ts` | Import logic |
| `catalog-product.service.ts` | Product logic |
| `compliance.service.ts` | Compliance checking |
| `processors/csv-import.processor.ts` | CSV processing (BullMQ) |
| `entities/catalog-import.entity.ts` | Import job |
| `entities/catalog-import-row.entity.ts` | Import row |
| `entities/catalog-product.entity.ts` | Product |
| `entities/compliance-audit-log.entity.ts` | Compliance audit |
| `dto/*.dto.ts` | Request/response DTOs |

**Endpoints**: See `/docs/API_MAP.md` → Catalog Import

---

### Fitment Module (`fitment/`)

**Purpose**: Vehicle fitment (YMMT)

| File | Purpose |
|------|---------|
| `fitment.module.ts` | Module definition |
| `fitment.controller.ts` | Fitment endpoints |
| `fitment.service.ts` | Fitment logic |
| `processors/fitment-import.processor.ts` | Import processor |
| `entities/fitment-engine.entity.ts` | Engine data |
| `entities/fitment-make.entity.ts` | Vehicle make |
| `entities/fitment-model.entity.ts` | Vehicle model |
| `entities/fitment-submodel.entity.ts` | Submodel |
| `entities/fitment-year.entity.ts` | Model year |
| `entities/part-fitment.entity.ts` | Part compatibility |
| `entities/vin-cache.entity.ts` | VIN lookup cache |

**Endpoints**: See `/docs/API_MAP.md` → Fitment

---

### Motors Intelligence Module (`motors-intelligence/`)

**Purpose**: AI attribute extraction for automotive

| File | Purpose |
|------|---------|
| `motors-intelligence.module.ts` | Module definition |
| `controllers/motors-intelligence.controller.ts` | Main endpoints |
| `controllers/review-queue.controller.ts` | Review queue endpoints |
| `motors-intelligence.service.ts` | Business logic |
| `review-queue.service.ts` | Review logic |
| `processors/motors-pipeline.processor.ts` | AI processing |
| `entities/motors-product.entity.ts` | Motors product |
| `entities/product-candidate.entity.ts` | AI candidates |
| `entities/extracted-attribute.entity.ts` | Extracted attributes |
| `entities/validation-result.entity.ts` | Validation results |
| `entities/review-task.entity.ts` | Review tasks |
| `entities/listing-generation.entity.ts` | Generated listings |
| `entities/correction-rule.entity.ts` | Correction rules |
| `entities/ebay-aspect-requirement.entity.ts` | eBay aspects |
| `entities/ebay-category-mapping.entity.ts` | Category mappings |
| `entities/motors-feedback-log.entity.ts` | Feedback log |

**Endpoints**: See `/docs/API_MAP.md` → Motors Intelligence

---

### Channels Module (`channels/`)

**Purpose**: Marketplace channel abstraction

| File | Purpose |
|------|---------|
| `channels.module.ts` | Module definition |
| `channels.controller.ts` | Channel endpoints |
| `stores.controller.ts` | Store endpoints |
| `ai-enhancement.controller.ts` | AI enhancement endpoints |
| `ebay-publish.controller.ts` | eBay publish endpoints |
| `channels.service.ts` | Channel logic |
| `stores.service.ts` | Store logic |
| `ai-enhancement.service.ts` | AI enhancement logic |
| `ebay-publish.service.ts` | eBay publish logic |
| `processors/channel-publish.processor.ts` | Publish processor |
| `entities/channel-connection.entity.ts` | Channel connection |
| `entities/channel-listing.entity.ts` | Channel listing |
| `entities/channel-webhook-log.entity.ts` | Webhook logs |
| `entities/listing-channel-instance.entity.ts` | Listing-channel join |
| `entities/store.entity.ts` | Store entity |
| `entities/ai-enhancement.entity.ts` | AI enhancement |
| `entities/demo-simulation-log.entity.ts` | Demo logs |

**Endpoints**: See `/docs/API_MAP.md` → Channels

---

### eBay Integration Module (`integrations/ebay/`)

**Purpose**: eBay OAuth, multi-store, sync

| File | Purpose |
|------|---------|
| `ebay-integrations.module.ts` | Module definition |
| `controllers/integrations-ebay.controller.ts` | Main endpoints |
| `controllers/ebay-multi-store.controller.ts` | Multi-store endpoints |
| `services/ebay-integrations-oauth.service.ts` | OAuth flow |
| `services/ebay-sync.service.ts` | Data sync |
| `services/ebay-policy-sync.service.ts` | Policy sync |
| `services/ebay-listing.service.ts` | Listing operations |
| `services/ebay-inventory.service.ts` | Inventory sync |
| `services/ebay-order.service.ts` | Order import |
| `processors/ebay-listing-publish.processor.ts` | Listing publish |
| `processors/ebay-inventory-sync.processor.ts` | Inventory sync |
| `processors/ebay-order-sync.processor.ts` | Order sync |
| `entities/connected-ebay-account.entity.ts` | Connected account |
| `entities/ebay-account-marketplace.entity.ts` | Marketplace settings |
| `entities/ebay-oauth-token.entity.ts` | OAuth tokens |
| `entities/ebay-business-policy.entity.ts` | Business policies |
| `entities/ebay-listing-job.entity.ts` | Listing jobs |
| `entities/ebay-listing-job-target.entity.ts` | Job targets |
| `entities/ebay-listing-channel.entity.ts` | Listing channels |
| `entities/ebay-listing-sync-log.entity.ts` | Sync logs |
| `entities/ebay-api-audit-log.entity.ts` | API audit |
| `entities/ebay-api-error.entity.ts` | API errors |
| `entities/internal-store.entity.ts` | Internal store |
| `entities/inventory-movement.entity.ts` | Inventory movements |
| `entities/listing-action-log.entity.ts` | Action logs |
| `entities/listing-store-override.entity.ts` | Store overrides |

**Endpoints**: See `/docs/API_MAP.md` → eBay Integration

---

### Inventory Module (`inventory/`)

**Purpose**: Inventory tracking, allocations

| File | Purpose |
|------|---------|
| `inventory.module.ts` | Module definition |
| `inventory.controller.ts` | Endpoints |
| `inventory.service.ts` | Business logic |
| `processors/inventory-sync.processor.ts` | Sync processor |
| `entities/inventory-event.entity.ts` | Inventory events |
| `entities/inventory-ledger.entity.ts` | Inventory ledger |
| `entities/store-inventory-allocation.entity.ts` | Allocations |

**Endpoints**: See `/docs/API_MAP.md` → Inventory

---

### Orders Module (`orders/`)

**Purpose**: Order management, eBay import

| File | Purpose |
|------|---------|
| `orders.module.ts` | Module definition |
| `orders.controller.ts` | Endpoints |
| `orders.service.ts` | Business logic |
| `order-import-ebay.service.ts` | eBay order import |
| `processors/order-import.processor.ts` | Import processor |
| `entities/order.entity.ts` | Order |
| `entities/order-item.entity.ts` | Order line items |

**Endpoints**: See `/docs/API_MAP.md` → Orders

---

### Dashboard Module (`dashboard/`)

**Purpose**: KPIs, audit logs

| File | Purpose |
|------|---------|
| `dashboard.module.ts` | Module definition |
| `dashboard.controller.ts` | Endpoints (includes audit-logs) |
| `dashboard.service.ts` | Business logic |
| `processors/aggregation.processor.ts` | KPI aggregation |
| `entities/audit-log.entity.ts` | Audit trail |
| `entities/dashboard-cache.entity.ts` | Cached KPIs |
| `entities/sales-record.entity.ts` | Sales data |

**Endpoints**: See `/docs/API_MAP.md` → Dashboard

---

### Settings Module (`settings/`)

**Purpose**: Tenant settings, pricing rules

| File | Purpose |
|------|---------|
| `settings.module.ts` | Module definition |
| `settings.controller.ts` | Endpoints |
| `settings.service.ts` | Business logic |
| `entities/tenant-setting.entity.ts` | Settings |
| `entities/pricing-rule.entity.ts` | Pricing rules |
| `entities/shipping-profile.entity.ts` | Shipping profiles |

**Endpoints**: See `/docs/API_MAP.md` → Settings

---

### Client Settings Module (`client-settings/`)

**Purpose**: White-label branding (super_admin only)

| File | Purpose |
|------|---------|
| `client-settings.module.ts` | Module definition |
| `client-settings.controller.ts` | Endpoints |
| `client-settings.service.ts` | Business logic |
| `entities/client-settings.entity.ts` | Settings entity |

**Endpoints**: See `/docs/API_MAP.md` → Client Settings

---

### Common Modules (`common/`)

#### OpenAI (`common/openai/`)

| File | Purpose |
|------|---------|
| `openai.module.ts` | Module definition |
| `openai.service.ts` | OpenAI client |
| `openai-queue.service.ts` | Queued AI calls |

#### Scheduler (`common/scheduler/`)

| File | Purpose |
|------|---------|
| `scheduler.module.ts` | Module definition |
| `scheduler.service.ts` | Cron jobs feeding queues |

#### Feature Flags (`common/feature-flags/`)

| File | Purpose |
|------|---------|
| `feature-flag.module.ts` | Module definition |
| `feature-flag.controller.ts` | Endpoints |
| `feature-flag.service.ts` | Business logic |
| `entities/feature-flag.entity.ts` | Feature flag |

---

## BullMQ Queues

| Queue | Module | Purpose |
|-------|--------|---------|
| `ingestion` | ingestion | File/image ingestion |
| `pipeline` | ingestion | AI processing pipeline |
| `catalog-import` | catalog-import | CSV import processing |
| `fitment` | fitment | Fitment data import |
| `inventory` | inventory | Inventory sync |
| `orders` | orders | Order import/processing |
| `channels` | channels | Channel publish |
| `ebay-listing-publish` | integrations/ebay | eBay listing publish |
| `ebay-inventory-sync` | integrations/ebay | eBay inventory sync |
| `ebay-order-sync` | integrations/ebay | eBay order import |
| `openai` | common/openai | AI API calls |
| `motors-pipeline` | motors-intelligence | Motors AI processing |
| `storage-thumbnails` | storage | Thumbnail generation |
| `storage-cleanup` | storage | Asset cleanup |
| `dashboard` | dashboard | KPI aggregation |
| `listing-optimization` | listing-optimization | Listing optimization |

---

## Global Guards

Applied in order in `app.module.ts`:

1. **ThrottlerGuard** (`@nestjs/throttler`)
   - 10 requests/second
   - 100 requests/minute
   - 1000 requests/hour

2. **JwtAuthGuard** (`auth/guards/jwt-auth.guard.ts`)
   - Validates JWT token
   - Skipped with `@Public()` decorator

3. **PermissionsGuard** (`rbac/guards/permissions.guard.ts`)
   - Checks required permissions
   - Uses `@RequirePermissions()` decorator

---

## Decorators

| Decorator | Location | Purpose |
|-----------|----------|---------|
| `@Public()` | `auth/decorators/public.decorator.ts` | Skip auth |
| `@CurrentUser()` | `auth/decorators/current-user.decorator.ts` | Inject user |
| `@RequirePermissions(...)` | `rbac/decorators/require-permissions.decorator.ts` | Require permissions |

---

## Related Documentation

- **API Map**: `/docs/API_MAP.md`
- **Database Map**: `/docs/DATABASE_MAP.md`
- **Auth/RBAC**: `/docs/architecture/auth-rbac.md`
- **Codebase Map**: `/docs/CODEMAP.md`

---

*Last updated: 2026-05-29*
