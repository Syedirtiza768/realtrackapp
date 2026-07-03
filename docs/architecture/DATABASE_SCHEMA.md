# Database Schema

> **Source**: Consolidated from `docs/DATABASE_MAP.md` (513 lines, entity-focused) and `docs/architecture/database.md` (108 lines, engine/ORM config focused) — 2026-05-29. Updated: 2026-06-11.

---

## Engine & Access Layer

- **Database**: PostgreSQL 16 (`postgres:16-alpine` in Docker). Default DB name `listingpro`.
- **ORM**: TypeORM 0.3 via `@nestjs/typeorm`.
- **Driver**: `pg`. Connection pool: `DB_POOL_MAX=20`, `DB_POOL_MIN=5`, 30s idle, 5s connect, 30s statement timeout.
- **Runtime config**: `app.module.ts` `TypeOrmModule.forRootAsync`.
- **CLI/migration config**: `backend/src/data-source.ts`.

> `synchronize` defaults to **false** (`DB_SYNCHRONIZE`). Schema changes must go through migrations. `DB_MIGRATIONS_RUN=true` runs pending migrations on boot.

### Connection Configuration

```typescript
{
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'listingpro',
  autoLoadEntities: true,
  synchronize: false,
  migrationsRun: true,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTransactionMode: 'each',
  extra: { max: 20, min: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, statement_timeout: 30000 }
}
```

---

## Entities (82 Entity Files, 78 Unique Tables)

Grouped by module:

| Module | Key Entities |
|--------|-------------|
| auth | `User` (`users`), `Organization`, `OrganizationMember` |
| rbac | `Role`, `Permission`, `RolePermission`, `UserRoleAssignment` |
| listings | `ListingRecord`, `ListingRevision`, `ListingCompliance`, `EbayOffer`, `EbayCategory`, `MasterProduct`, `CompetitorPrice`, `CrossReference`, `MarketSnapshot`, `ExportRule` |
| catalog-import | `CatalogImport`, `CatalogImportRow`, `CatalogProduct`, `ComplianceAuditLog` |
| fitment | `FitmentEngine`, `FitmentMake`, `FitmentModel`, `FitmentSubmodel`, `FitmentYear`, `PartFitment`, `VinCache` |
| ingestion | `IngestionJob`, `PipelineJob`, `AiResult` |
| motors-intelligence | `MotorsProduct`, `ProductCandidate`, `ExtractedAttribute`, `ValidationResult`, `ReviewTask`, `ListingGeneration`, `CorrectionRule`, `EbayAspectRequirement`, `EbayCategoryMapping`, `MotorsFeedbackLog` |
| channels | `ChannelConnection`, `ChannelListing`, `ChannelWebhookLog`, `ListingChannelInstance`, `Store`, `AiEnhancement`, `DemoSimulationLog` |
| integrations/ebay | `ConnectedEbayAccount`, `EbayAccountMarketplace`, `EbayOauthToken`, `EbayBusinessPolicy`, `EbayListingJob`, `EbayListingJobTarget`, `EbayListingChannel`, `EbayListingSyncLog`, `EbayApiAuditLog`, `EbayApiError`, `InternalStore`, `InventoryMovement`, `ListingActionLog`, `ListingStoreOverride` |
| inventory | `InventoryEvent`, `InventoryLedger`, `StoreInventoryAllocation` |
| orders | `Order`, `OrderItem` |
| dashboard | `AuditLog`, `DashboardCache`, `SalesRecord` |
| settings | `TenantSetting`, `PricingRule`, `ShippingProfile` |
| client-settings | `ClientSettings` |
| storage | `ImageAsset` |
| templates | `ListingTemplate` |
| notifications | `Notification` |
| common/feature-flags | `FeatureFlag` |

---

## Core Entity Details

### Auth Module

#### `users` (User)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `email` | varchar(200) | Unique |
| `passwordHash` | text | `select: false` |
| `name` | varchar(200) | Nullable |
| `role` | varchar(20) | Legacy enum: super_admin, admin, manager, user, viewer |
| `active` | boolean | Default: true |
| `lastLoginAt` | timestamptz | Nullable |

**Indexes**: `email` (unique)

### RBAC Module

| Table | Key Columns |
|-------|------------|
| `roles` | `id`, `slug` (unique), `name`, `description`, `isSystem` |
| `permissions` | `id`, `key` (unique, module.action format), `label`, `module` |
| `role_permissions` | `roleId` FK, `permissionId` FK |
| `user_role_assignments` | `userId` FK, `roleId` FK, `assignedBy` FK |

### Listings Module

#### `listing_records` (ListingRecord) — Primary table, 76+ columns

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `organizationId` | uuid | Multi-tenant |
| `customLabelSku` | text | SKU |
| `categoryId` | text | eBay category ID |
| `title` | text | Listing title |
| `startPrice` | text | ⚠️ Legacy TEXT column — prefer `startPriceNum` |
| `quantity` | text | ⚠️ Legacy TEXT column — prefer `quantityNum` |
| `startPriceNum` | numeric(12,2) | Numeric version (preferred) |
| `quantityNum` | int | Numeric version (preferred) |
| `conditionId` | text | eBay condition |
| `description` | text | HTML description |
| `status` | varchar(20) | draft, ready, published, sold, delisted, archived |
| `version` | int | Optimistic locking |
| `deletedAt` | timestamptz | Soft delete |
| `ebayListingId` | varchar(64) | eBay item ID |
| `searchVector` | tsvector | Full-text search (DB-managed trigger) |

**Indexes**: SKU, categoryId, title, brand, condition, type, source file, org, extractedMake, extractedModel, searchVector (GIN).

**SKU generation**: PostgreSQL sequence `sku_seq` (migration `1785200000000`). `allocateSku()` calls `nextval('sku_seq')` and formats as `BLA-XXXXX`. Atomic under concurrency — no application-level locking needed.

#### `listing_revisions` (ListingRevision)

`id`, `listingRecordId` FK, `version`, `data` (jsonb snapshot), `createdBy`, `createdAt`

### Catalog Import Module

#### `catalog_products` (CatalogProduct)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `sku` | varchar | Product SKU |
| `name` | text | Product name |
| `brand` | varchar | Brand |
| `categoryId` | varchar | Category ID |
| `mpn` | varchar | Manufacturer Part Number |
| `images` | jsonb | Array of image URLs |
| `attributes` | jsonb | Key-value attributes |
| `fitmentData` | jsonb | Vehicle fitment info |
| `status` | varchar | draft, active, discontinued |

### eBay Integration Module

#### `connected_ebay_accounts`
`id`, `organizationId`, `accountName`, `ebayUserId`, `environment` (SANDBOX/PRODUCTION), `isActive`, `connection_source` (native / sellerpundit)

#### `ebay_oauth_tokens`
`id`, `connectedEbayAccountId` FK, `accessToken` (encrypted), `refreshToken` (encrypted), `expiresAt`, `scope`

#### `internal_stores`
`id`, `connectedEbayAccountId` FK, `name`, `storeType`, `marketplaceId`, `isDefault`, `settings` (jsonb)

### Orders Module

#### `orders`
`id`, `channelOrderId`, `channel`, `status`, `buyerUsername`, `buyerEmail`, `totalAmount` numeric(12,2), `currency`, `shippingAddress` jsonb, `orderDate`

#### `order_items`
`id`, `orderId` FK, `listingRecordId` FK, `sku`, `title`, `quantity`, `unitPrice` numeric(12,2)

### Inventory Module

#### `inventory_ledger`
`id`, `listingRecordId` FK, `sku`, `quantity`, `reservedQuantity`, `availableQuantity`

#### `inventory_events`
`id`, `ledgerId` FK, `eventType`, `quantityChange`, `reason`, `referenceId`, `createdBy`

### Motors Intelligence Module

#### `motors_products`
`id`, `catalogProductId` FK, `epid`, `make`, `model`, `year`, `trim`, `engine`, `attributes` jsonb

#### `product_candidates`
`id`, `sourceData` jsonb, `extractedAttributes` jsonb, `confidenceScore` numeric, `status`, `reviewedAt`, `reviewedBy`

---

## Migrations

Location: `backend/src/migrations/` (27 files). `migrationsTransactionMode: 'each'`.

| Migration | Theme |
|-----------|-------|
| `ListingRecordsBase`, `InitialSchema` | Base listing tables + initial schema |
| `Phase1SafeFoundations` | Foundational tables |
| `Phase2AutomationAndTemplates` | Automation + templates |
| `Phase3PriceTypesMigration` | Price column type fixes |
| `Phase3ComplianceSatellite` | Compliance tables |
| `Phase3Partitioning` | Partitioning |
| `Phase3DeprecateChannelListings` | Channel listing deprecation |
| `Phase3MultiTenant` | Multi-tenant columns |
| `Phase4MultiStoreFoundation` | Multi-store base |
| `MotorsIntelligenceSystem` | Motors AI pipeline |
| `CatalogImportSystem` | Catalog import tables |
| `Phase1UpgradeSchema`, `Phase2VinCache` | Upgrade + VIN cache |
| `ListingRecordsSearchVectorTrigger` | Full-text search trigger |
| `EbayMultiAccountIntegration`, `EbayMultiStoreExtensions` | eBay multi-account/store |
| `ListingOptimizationPipeline` | Optimization pipeline |
| `RbacFoundation` | Roles/permissions tables |
| `ClientSettings` | Client settings |
| `SellerPunditExtensions` | SellerPundit integration |
| `AddAiEnhancementConfidenceScore` | AI enhancement confidence |
| `AiRunLogsAndRoutingPolicy` | AI routing system |
| `AddComplianceScoreToAiRunLogs` | AI compliance scoring |
| `AddListingRecordPipelineMarketplace` | Pipeline marketplace |
| `AddOptimizationByMarketplace` | Optimization marketplace |

Commands (`backend/`):
```bash
npm run migration:run        # apply pending
npm run migration:generate   # generate from entity diff
npm run migration:revert     # revert last
npm run migration:show       # status
```

## Seed Data

- `listingpro.dump` restored on first Postgres volume init
- RBAC roles/permissions seeded from `permission-registry.ts` via `RbacSeedService` (`RBAC_SYNC_PERMISSIONS=true`)
- Demo seed scripts: `backend/src/scripts/seed-rbac.ts`, `seed-demo-ebay.ts`
- Demo users created from `DEFAULT_*_EMAIL` / `DEFAULT_*_PASSWORD` env vars when `SEED_DEMO_USERS=true`

## Multi-Tenant / Org Scoping

Internal tenancy via `Organization` / `OrganizationMember`. `Phase3MultiTenant` added tenant columns. eBay "stores"/"accounts" are a separate marketplace-side concept — **not** the same as internal orgs. Row-level tenant isolation is inconsistent per prior audit.

## Known DB Risks

- TEXT-typed price/quantity columns (prefer `*Num` columns)
- Missing foreign keys on some entity relationships
- Dual channel-mapping tables (`channel_listings` + `listing_channel_instances`)
- Some tables historically created outside migrations
- Full list: [/docs/context/KNOWN_ISSUES.md](../context/KNOWN_ISSUES.md)

## Query Patterns

### Multi-tenant Queries
```typescript
const listings = await listingRepo.find({
  where: { organizationId: currentUser.organizationId }
});
```

### Soft Deletes
Entities with `@DeleteDateColumn` automatically exclude soft-deleted rows. Use `withDeleted: true` to include them.

### Full-text Search
`listing_records` has `searchVector` tsvector column with DB-level trigger updating on title/description changes.

---

*Consolidated & reorganized: 2026-06-06. Updated: 2026-06-11.*
