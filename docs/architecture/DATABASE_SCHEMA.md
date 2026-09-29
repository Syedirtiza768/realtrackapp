# Database Schema

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

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
| integrations/ebay | `ConnectedEbayAccount`, `EbayAccountMarketplace`, `EbayOauthToken`, `EbayBusinessPolicy`, `EbayHostedImage`, `EbayListingJob`, `EbayListingJobTarget`, `EbayListingChannel`, `EbayListingSyncLog`, `EbayApiAuditLog`, `EbayApiError`, `InternalStore`, `InventoryMovement`, `ListingActionLog`, `ListingStoreOverride` |
| inventory | `InventoryEvent`, `InventoryLedger`, `StoreInventoryAllocation` |
| orders | `Order`, `OrderItem` |
| dashboard | `AuditLog`, `DashboardCache`, `SalesRecord` |
| settings | `TenantSetting`, `PricingRule`, `ShippingProfile` |
| client-settings | `ClientSettings` |
| storage | `ImageAsset`, `ImageDriveFolder`, `ImageDriveAsset` |
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

**SKU generation**: PostgreSQL sequence `sku_seq` (migration `1785200000000`). `allocateSku()` calls `nextval('sku_seq')` and formats as `BLA-XXXXX`. Atomic under concurrency; the Add Part intake flow retries generated-SKU conflicts.

**Warehouse intake source rows**: PostgreSQL sequence `warehouse_intake_row_seq` (migration `1789100000000`) allocates `sourceRowNumber` for `/listings/new` Add Part rows. This avoids `MAX(sourceRowNumber)+1` races against `uq_listing_source_row` when multiple users save intake parts at nearly the same time.

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

#### `ebay_hosted_images`
Store-scoped mapping from a source image URL to the eBay Picture Services URL
used by Inventory API and SellerPundit publishes. The unique
`(store_id, source_url)` key prevents repeated uploads; `expiration_date`
tracks eBay's unused-image expiration response so stale cache entries can be
replaced.

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

## Product Vertical Pilot Tables and Columns

`AddProductVerticals1790300000000` is additive and must be applied through
TypeORM migrations; `DB_SYNCHRONIZE` remains disabled.

- `stores.vertical_config` stores enabled/default/workflow vertical settings.
- `catalog_products.organization_id`, `vertical`, `vertical_attributes`, and
  `vertical_validation_status` carry explicit product routing and validation.
- `listing_records.vertical` and `vertical_attributes` preserve the same
  routing at the source-listing boundary.
- `catalog_imports.vertical`, `pipeline_jobs.vertical`,
  `ebay_listing_job_targets.vertical`, and `ebay_listing_channels.vertical`
  keep background work and publish state vertical-aware.
- `product_families` groups non-automotive products for variation publishing;
  `product_variants` stores SKU-level price, quantity, identifiers, images, and
  variation attributes; `variant_marketplace_mappings` stores per-account
  offer/listing state; and `product_marketplace_categories` caches
  marketplace/category/aspect/condition metadata.

Legacy rows may remain null and resolve to automotive in application code.
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

## Fashion vertical schema (2026-09-09)

The additive vertical migration adds explicit vertical and vertical_attributes fields to catalog/listing/import/job tables, per-store vertical_config, and product family/variant/category metadata tables. Fashion garment identification stores category-aware clothing/footwear/accessory attributes plus `_` review-metadata keys (`_suggestedKeys`, `_confirmedKeys`, `_analysisStatus`, and related flags) in `catalog_products.vertical_attributes` JSON; underscore-prefixed keys are stored as-is and are not camel-cased. No additional table or migration was required. Migration 1790400000000-CreateFashionWorkspaceSecurity adds fashion_reviews with organization_id, catalog_product_id, status, authenticity_confirmed, private evidence_keys, reviewer, notes, and timestamps. Evidence keys are never returned by public listing payloads.

CatalogProduct retains the existing global SKU uniqueness constraint during the pilot. Fashion endpoints reject an existing SKU rather than overwriting another vertical. DB_SYNCHRONIZE remains disabled; neither vertical migration has been run by this implementation.

## Business & Industrial vertical schema (2026-09-09)

Migration `1790500000000-BusinessIndustrialWorkspaceSecurity` adds three
organization-scoped tables: `business_industrial_reviews` for provenance,
specification, testing, restricted-category, evidence, and risk decisions;
`business_industrial_units` for serialized inventory with private serials kept
out of public listing payloads; and `business_industrial_incidents` for verified
counterfeit, intellectual-property, product-safety, recall, and other
enforcement signals. Unique organization/product and organization/serial/event
constraints make review and incident ingestion idempotent.

The migration is additive and is not run by this change. Remote eBay takedown
attempts are recorded as structured incident targets for authorized manual
completion; local quarantine is immediate and fail-closed.

## B&I Drive pilot projection (2026-09-11)

The public-folder pilot intentionally adds no new tables or columns. It reuses
the image-intake job/group/asset tables above, the existing ai_run_logs
aggregation for token/cost reporting, and the existing catalog_products records
created by B&I draft application. Each created draft is also mirrored to the
existing organization-scoped listing_records table with
vertical=business_industrial, status=draft, the WebP image URLs, and the
enrichment payload. This keeps the pilot visible in the shared Inventory
workbench while preserving the normal review and eBay publish gates.

## B&I image intake schema (2026-09-10)

Migration `1790800000000-CreateBusinessIndustrialImageIntake` adds three
organization-scoped tables. `business_industrial_image_intake_jobs` tracks the
folder upload and sequential worker progress. `business_industrial_image_intake_groups`
stores one base part per run, all raw instance folder names/suffixes, AI
identification, confidence, category suggestions, item-specific metadata,
warnings, and the linked B&I draft. `business_industrial_image_intake_assets`
stores source folder/path and B&I-owned S3/CDN metadata for each image.

The group uniqueness key is `(job_id, base_part_normalized)` and the asset key
is `(job_id, relative_path)`. All three tables cascade from the organization;
assets are never read through the legacy global Image Drive tables. The
migration is additive and requires the normal production migration approval.
