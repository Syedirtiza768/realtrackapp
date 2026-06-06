# Services & Controllers

> **Note**: Lightweight satellite to [MODULE_MAP.md](MODULE_MAP.md).
> Extracted from `docs/architecture/codebase-map.md` backend section (2026-05-29).
> For the full module reference with entities and processors, see MODULE_MAP.

---

## Controller Map

| Controller | Module Path | Base Route | Key Endpoints |
|-----------|------------|------------|---------------|
| `AuthController` | `auth/auth.controller.ts` | `/api/auth` | login, register, me, logout |
| `RbacAdminController` | `rbac/rbac-admin.controller.ts` | `/api/rbac` | users CRUD, roles CRUD, permissions |
| `ListingsController` | `listings/listings.controller.ts` | `/api/listings` | CRUD, revisions |
| `ListingsV2Controller` | `listings/listings-v2.controller.ts` | `/api/v2/listings` | Cached listing list |
| `ListingGenerationController` | `listings/listing-generation.controller.ts` | `/api/listings` | AI generation |
| `ExportRuleController` ⚠️ | `listings/export-rule.controller.ts` | `/api/api/export-rules` | Export rules CRUD |
| `CatalogImportController` | `catalog-import/catalog-import.controller.ts` | `/api/catalog-import` | Upload, jobs |
| `CatalogProductController` | `catalog-import/catalog-product.controller.ts` | `/api/catalog-products` | Products CRUD |
| `ComplianceController` | `catalog-import/controllers/compliance.controller.ts` | `/api/catalog-import/compliance` | Check, status |
| `IngestionController` | `ingestion/ingestion.controller.ts` | `/api/ingestion` | Upload, jobs |
| `PipelineController` | `ingestion/pipeline.controller.ts` | `/api/pipeline` | Run, jobs |
| `ImageEnrichmentController` | `ingestion/image-enrichment/` | `/api/pipeline/images` | Enrich |
| `ReviewController` | `ingestion/review/` | `/api/ingestion/review` | Approve, reject |
| `MotorsIntelligenceController` | `motors-intelligence/controllers/` | `/api/motors-intelligence` | List, upload, extract |
| `ReviewQueueController` | `motors-intelligence/controllers/` | `/api/motors-intelligence/review` | Approve, correct |
| `FitmentController` | `fitment/fitment.controller.ts` | `/api/fitment` | Makes, models, years, VIN |
| `ChannelsController` | `channels/channels.controller.ts` | `/api/channels` | Connections CRUD |
| `StoresController` | `channels/stores.controller.ts` | `/api/stores` | Stores CRUD |
| `AiEnhancementController` | `channels/ai-enhancement.controller.ts` | `/api/ai-enhancements` | Request, status |
| `EbayPublishController` | `channels/ebay-publish.controller.ts` | `/api/channels/ebay` | Publish, batch, offers |
| `IntegrationsEbayController` | `integrations/ebay/controllers/` | `/api/integrations/ebay` | Accounts, sync, policies |
| `EbayMultiStoreController` | `integrations/ebay/controllers/` | `/api/ebay` | Stores CRUD |
| `InventoryController` | `inventory/inventory.controller.ts` | `/api/inventory` | List, adjust, allocate, sync |
| `OrdersController` | `orders/orders.controller.ts` | `/api/orders` | CRUD, ship, refund, import |
| `DashboardController` | `dashboard/dashboard.controller.ts` | `/api/dashboard` | KPIs, sales, audit-logs |
| `SettingsController` | `settings/settings.controller.ts` | `/api/settings` | Settings, pricing rules |
| `ClientSettingsController` | `client-settings/client-settings.controller.ts` | `/api/client-settings` | White-label (super_admin) |
| `AutomationController` | `automation/automation.controller.ts` | `/api/automation-rules` | CRUD |
| `TemplateController` | `templates/template.controller.ts` | `/api/templates` | CRUD |
| `NotificationsController` | `notifications/notifications.controller.ts` | `/api/notifications` | List, read |
| `StorageController` | `storage/storage.controller.ts` | `/api/storage` | Upload, download, delete |
| `HealthController` | `health/health.controller.ts` | `/api/health` | @Public liveness check |
| `FeatureFlagController` ⚠️ | `common/feature-flags/feature-flag.controller.ts` | `/api/api/feature-flags` | CRUD |
| `PricingIntelligenceController` | `pricing-intelligence/pricing-intelligence.controller.ts` | `/api/pricing` | Pricing rules |
| `SellerPunditEbayController` | `integrations/sellerpundit/` | `/api/integrations/ebay/sellerpundit` | Login, sync, config |

> ⚠️ = Double `/api` prefix issue — see [/docs/architecture/API_CONTRACTS.md](../architecture/API_CONTRACTS.md).

---

## Service Architecture Pattern

Services follow standard NestJS DI pattern. Each module typically has:

```
module-name.service.ts       # Primary business logic
module-name.module.ts        # Module registration + imports
controllers/                  # HTTP endpoints (thin — delegate to services)
processors/                   # BullMQ job handlers
entities/                     # TypeORM entity definitions
dto/                          # class-validator DTOs
```

### Key Services by Domain

| Domain | Primary Service | Key Responsibilities |
|--------|----------------|---------------------|
| Auth | `auth.service.ts` | JWT signing, bcrypt, login/register |
| Auth | `user-organization.service.ts` | Org creation, member management |
| RBAC | `rbac.service.ts` | Role/permission lookup and assignment |
| RBAC | `rbac-seed.service.ts` | Sync registry → DB on startup |
| Listings | `listings.service.ts` | CRUD business logic |
| Listings | `listing-generation.service.ts` | OpenAI listing generation |
| Listings | `search.service.ts` | Full-text search |
| Ingestion | `enterprise-listing-intelligence.service.ts` | AI analysis orchestration |
| eBay | `ebay-integrations-oauth.service.ts` | OAuth flow, token management |
| eBay | `ebay-sync.service.ts` | Inventory and listing sync |
| eBay | `ebay-policy-sync.service.ts` | Business policy synchronization |
| eBay | `ebay-listing.service.ts` | Listing creation/update on eBay |
| eBay | `ebay-inventory.service.ts` | Inventory API operations |
| eBay | `ebay-order.service.ts` | Order import from eBay |
| Orders | `order-import-ebay.service.ts` | eBay order import logic |
| OpenAI | `openai-queue.service.ts` | Queued AI API calls with rate limiting |
| Scheduler | `scheduler.service.ts` | Cron jobs feeding BullMQ queues |

---

## Controller Guidelines

Per AGENTS.md rules:

1. **Auth by default** — routes protected by global `JwtAuthGuard`. Use `@Public()` only deliberately.
2. **Permissions** — new routes need `@RequirePermissions('module.action')` with permission registered in `rbac/permission-registry.ts`.
3. **Validation** — DTOs use `class-validator`; global `ValidationPipe` is strict (`forbidNonWhitelisted`).
4. **Naming** — follow existing patterns: `@Controller('base-path')` without `api/` prefix (the double-prefix controllers are bugs).

---

*Created: 2026-06-06.*
