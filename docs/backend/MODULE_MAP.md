# Module Map

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

### Inventory (`inventory/`)

`inventory.controller.ts`, `inventory.service.ts`, `processors/inventory-sync.processor.ts`, entities: `inventory-event`, `inventory-ledger`, `store-inventory-allocation`

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
- **storage**: `storage.controller.ts`, thumbnail + cleanup processors
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
