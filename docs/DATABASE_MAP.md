> ⚠️ MOVED → [/docs/architecture/DATABASE_SCHEMA.md](architecture/DATABASE_SCHEMA.md) (2026-06-06)

# Database Map

> Comprehensive database schema reference for RealTrackApp.
> For TypeORM entities, see `backend/src/*/entities/`.
> For migrations, see `backend/src/migrations/`.

---

## Database Engine

- **PostgreSQL**: 16 (via `postgres:16-alpine` Docker image)
- **ORM**: TypeORM 0.3
- **Database Name**: `listingpro`
- **Migrations**: 21 files in `backend/src/migrations/`
- **Migration Table**: `typeorm_migrations`

### Connection Configuration

```typescript
// From app.module.ts
{
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'listingpro',
  autoLoadEntities: true,
  synchronize: false,  // NEVER true in production
  migrationsRun: true, // Auto-run on boot
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTransactionMode: 'each',
  extra: {
    max: 20,           // Connection pool max
    min: 5,            // Connection pool min
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
  }
}
```

---

## Entity Overview (~79 Entities)

### By Module

| Module | Entity Count | Key Entities |
|--------|--------------|--------------|
| auth | 3 | User, Organization, OrganizationMember |
| rbac | 4 | Role, Permission, RolePermission, UserRoleAssignment |
| listings | 10+ | ListingRecord, ListingRevision, ListingCompliance, EbayOffer, EbayCategory, MasterProduct, CompetitorPrice, CrossReference, MarketSnapshot, ExportRule |
| catalog-import | 4 | CatalogImport, CatalogImportRow, CatalogProduct, ComplianceAuditLog |
| fitment | 8 | FitmentEngine, FitmentMake, FitmentModel, FitmentSubmodel, FitmentYear, PartFitment, VinCache |
| ingestion | 3 | IngestionJob, PipelineJob, AiResult |
| motors-intelligence | 8 | MotorsProduct, ProductCandidate, ExtractedAttribute, ValidationResult, ReviewTask, ListingGeneration, CorrectionRule, EbayAspectRequirement, EbayCategoryMapping |
| channels | 7 | ChannelConnection, ChannelListing, ChannelWebhookLog, ListingChannelInstance, Store, AiEnhancement, DemoSimulationLog |
| integrations/ebay | 12 | ConnectedEbayAccount, EbayAccountMarketplace, EbayOauthToken, EbayBusinessPolicy, EbayListingJob, EbayListingJobTarget, EbayListingChannel, EbayListingSyncLog, EbayApiAuditLog, EbayApiError, InternalStore, InventoryMovement, ListingActionLog, ListingStoreOverride |
| inventory | 3 | InventoryEvent, InventoryLedger, StoreInventoryAllocation |
| orders | 2 | Order, OrderItem |
| dashboard | 3 | AuditLog, DashboardCache, SalesRecord |
| settings | 3 | TenantSetting, PricingRule, ShippingProfile |
| client-settings | 1 | ClientSettings |
| storage | 1 | ImageAsset |
| templates | 1 | ListingTemplate |
| notifications | 1 | Notification |
| feature-flags | 1 | FeatureFlag |

---

## Core Entity Details

### Auth Module

#### `users` (User)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `email` | varchar(200) | Unique, case-sensitive |
| `passwordHash` | text | `select: false` (never returned) |
| `name` | varchar(200) | Nullable |
| `role` | varchar(20) | Legacy enum: super_admin, admin, manager, user, viewer |
| `active` | boolean | Default: true |
| `lastLoginAt` | timestamptz | Nullable |
| `createdAt` | timestamptz | Auto-generated |

**Indexes**: `email` (unique)

#### `organizations` (Organization)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `name` | varchar | Organization name |
| `slug` | varchar | URL-friendly identifier |
| `createdAt` | timestamptz | Auto-generated |

#### `organization_members` (OrganizationMember)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `userId` | uuid | FK to users |
| `organizationId` | uuid | FK to organizations |
| `role` | varchar | Role within org |
| `joinedAt` | timestamptz | Auto-generated |

---

### RBAC Module

#### `roles` (Role)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `slug` | varchar | Unique identifier (super_admin, admin, etc.) |
| `name` | varchar | Display name |
| `description` | text | Role description |
| `isSystem` | boolean | System role vs custom |
| `createdAt` | timestamptz | Auto-generated |

**System Roles**: super_admin, admin, manager, staff, viewer, catalog_manager, listing_manager, ops_user

#### `permissions` (Permission)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `key` | varchar | Unique (module.action format) |
| `label` | varchar | Display name |
| `module` | varchar | Module/category |
| `description` | text | Description |

#### `role_permissions` (RolePermission)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `roleId` | uuid | FK to roles |
| `permissionId` | uuid | FK to permissions |

#### `user_role_assignments` (UserRoleAssignment)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `userId` | uuid | FK to users |
| `roleId` | uuid | FK to roles |
| `assignedBy` | uuid | FK to users (admin who assigned) |
| `assignedAt` | timestamptz | Auto-generated |

---

### Listings Module

#### `listing_records` (ListingRecord)

**Primary table for marketplace listings. 76+ columns.**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `organizationId` | uuid | Nullable, multi-tenant |
| `sourceFileName` | text | Import source |
| `sourceFilePath` | text | File path |
| `sheetName` | text | Default: 'Listings' |
| `sourceRowNumber` | int | Row in source file |
| `importedAt` | timestamptz | Auto-generated |
| `action` | text | eBay action (Add, Revise, etc.) |
| `customLabelSku` | text | SKU |
| `categoryId` | text | eBay category ID |
| `categoryName` | text | eBay category name |
| `title` | text | Listing title |
| `startPrice` | text | **Legacy TEXT column** |
| `quantity` | text | **Legacy TEXT column** |
| `startPriceNum` | numeric(12,2) | **Numeric version** (preferred) |
| `quantityNum` | int | **Numeric version** (preferred) |
| `conditionId` | text | eBay condition |
| `description` | text | HTML description |
| `format` | text | Listing format |
| `status` | varchar(20) | draft, ready, published, sold, delisted, archived |
| `version` | int | Version column (optimistic locking) |
| `deletedAt` | timestamptz | Soft delete |
| `updatedAt` | timestamptz | Auto-generated |
| `updatedBy` | uuid | User who last updated |
| `publishedAt` | timestamptz | When published |
| `ebayListingId` | varchar(64) | eBay item ID |
| `shopifyProductId` | varchar(64) | Shopify product ID |
| `extractedMake` | varchar(100) | AI-extracted vehicle make |
| `extractedModel` | varchar(100) | AI-extracted vehicle model |
| `searchVector` | tsvector | Full-text search (DB-managed) |

**Indexes**:
- `uq_listing_source_row` (sourceFileName, sheetName, sourceRowNumber) - Unique
- `idx_listing_sku` (customLabelSku)
- `idx_listing_category_id` (categoryId)
- `idx_listing_title` (title)
- `idx_listing_brand` (cBrand)
- `idx_listing_condition` (conditionId)
- `idx_listing_c_type` (cType)
- `idx_listing_source_file` (sourceFileName)
- `idx_listing_records_org` (organizationId)
- `idx_listing_extracted_make` (extractedMake)
- `idx_listing_extracted_model` (extractedModel)

**Note**: Price/quantity have both TEXT (legacy) and numeric (new) columns. Application should prefer `*Num` columns.

#### `listing_revisions` (ListingRevision)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `listingRecordId` | uuid | FK to listing_records |
| `version` | int | Version number |
| `data` | jsonb | Full listing data snapshot |
| `createdBy` | uuid | User who created revision |
| `createdAt` | timestamptz | Auto-generated |

#### `listing_compliance` (ListingCompliance)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `listingRecordId` | uuid | FK to listing_records |
| `complianceStatus` | varchar | Status enum |
| `issues` | jsonb | Array of compliance issues |
| `checkedAt` | timestamptz | When checked |

---

### Catalog Import Module

#### `catalog_products` (CatalogProduct)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `organizationId` | uuid | Nullable, multi-tenant |
| `sku` | varchar | Product SKU |
| `name` | text | Product name |
| `description` | text | Description |
| `brand` | varchar | Brand |
| `categoryId` | varchar | Category ID |
| `categoryName` | varchar | Category name |
| `mpn` | varchar | Manufacturer Part Number |
| `upc` | varchar | UPC code |
| `images` | jsonb | Array of image URLs |
| `attributes` | jsonb | Key-value attributes |
| `fitmentData` | jsonb | Vehicle fitment info |
| `status` | varchar | draft, active, discontinued |
| `createdAt` | timestamptz | Auto-generated |
| `updatedAt` | timestamptz | Auto-generated |

#### `catalog_imports` (CatalogImport)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `organizationId` | uuid | Nullable |
| `fileName` | text | Original filename |
| `filePath` | text | Storage path |
| `fileSize` | bigint | Size in bytes |
| `rowCount` | int | Total rows |
| `processedCount` | int | Successfully processed |
| `errorCount` | int | Errors encountered |
| `status` | varchar | pending, processing, completed, failed |
| `errorLog` | jsonb | Error details |
| `createdBy` | uuid | User who started import |
| `createdAt` | timestamptz | Auto-generated |
| `completedAt` | timestamptz | When finished |

---

### eBay Integration Module

#### `connected_ebay_accounts` (ConnectedEbayAccount)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `organizationId` | uuid | Nullable |
| `accountName` | varchar | Display name |
| `ebayUserId` | varchar | eBay username |
| `environment` | varchar | SANDBOX or PRODUCTION |
| `isActive` | boolean | Connection status |
| `createdAt` | timestamptz | Auto-generated |
| `updatedAt` | timestamptz | Auto-generated |

#### `ebay_oauth_tokens` (EbayOauthToken)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `connectedEbayAccountId` | uuid | FK to connected_ebay_accounts |
| `accessToken` | text | OAuth access token (encrypted) |
| `refreshToken` | text | OAuth refresh token (encrypted) |
| `expiresAt` | timestamptz | Token expiry |
| `scope` | text | OAuth scopes |
| `createdAt` | timestamptz | Auto-generated |
| `updatedAt` | timestamptz | Auto-generated |

#### `internal_stores` (InternalStore)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `organizationId` | uuid | Nullable |
| `connectedEbayAccountId` | uuid | FK to connected_ebay_accounts |
| `name` | varchar | Store name |
| `storeType` | varchar | ebay, shopify, etc. |
| `marketplaceId` | varchar | eBay marketplace (EBAY_US, etc.) |
| `isDefault` | boolean | Default store for account |
| `settings` | jsonb | Store-specific settings |
| `createdAt` | timestamptz | Auto-generated |

---

### Orders Module

#### `orders` (Order)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `organizationId` | uuid | Nullable |
| `channelOrderId` | varchar | Order ID from marketplace |
| `channel` | varchar | ebay, shopify, etc. |
| `status` | varchar | pending, processing, shipped, cancelled |
| `buyerUsername` | varchar | Customer username |
| `buyerEmail` | varchar | Customer email |
| `totalAmount` | numeric(12,2) | Order total |
| `currency` | varchar(3) | USD, etc. |
| `shippingAddress` | jsonb | Address object |
| `orderDate` | timestamptz | When placed |
| `createdAt` | timestamptz | Auto-generated |
| `updatedAt` | timestamptz | Auto-generated |

#### `order_items` (OrderItem)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `orderId` | uuid | FK to orders |
| `listingRecordId` | uuid | FK to listing_records |
| `sku` | varchar | Product SKU |
| `title` | text | Item title |
| `quantity` | int | Quantity ordered |
| `unitPrice` | numeric(12,2) | Price per unit |
| `totalPrice` | numeric(12,2) | Line total |
| `createdAt` | timestamptz | Auto-generated |

---

### Inventory Module

#### `inventory_ledger` (InventoryLedger)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `organizationId` | uuid | Nullable |
| `listingRecordId` | uuid | FK to listing_records |
| `sku` | varchar | Product SKU |
| `quantity` | int | Current quantity |
| `reservedQuantity` | int | Reserved for orders |
| `availableQuantity` | int | Available (calculated) |
| `updatedAt` | timestamptz | Auto-generated |

#### `inventory_events` (InventoryEvent)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `ledgerId` | uuid | FK to inventory_ledger |
| `eventType` | varchar | adjustment, sale, receipt, etc. |
| `quantityChange` | int | Delta (+/-) |
| `reason` | text | Human-readable reason |
| `referenceId` | varchar | Order ID, etc. |
| `createdBy` | uuid | User who made change |
| `createdAt` | timestamptz | Auto-generated |

---

### Motors Intelligence Module

#### `motors_products` (MotorsProduct)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `catalogProductId` | uuid | FK to catalog_products |
| `epid` | varchar | eBay Product ID |
| `categoryId` | varchar | eBay category |
| `make` | varchar | Vehicle make |
| `model` | varchar | Vehicle model |
| `year` | int | Vehicle year |
| `trim` | varchar | Vehicle trim |
| `engine` | varchar | Engine spec |
| `attributes` | jsonb | Structured attributes |
| `createdAt` | timestamptz | Auto-generated |
| `updatedAt` | timestamptz | Auto-generated |

#### `product_candidates` (ProductCandidate)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `sourceData` | jsonb | Raw source data |
| `extractedAttributes` | jsonb | AI-extracted attributes |
| `confidenceScore` | numeric | AI confidence (0-1) |
| `status` | varchar | pending, approved, rejected |
| `createdAt` | timestamptz | Auto-generated |
| `reviewedAt` | timestamptz | When reviewed |
| `reviewedBy` | uuid | User who reviewed |

---

## Migration History

| Migration | Timestamp | Purpose |
|-----------|-----------|---------|
| `ListingRecordsBase` | 1708999999990 | Base listing tables |
| `InitialSchema` | 1708999999999 | Initial schema setup |
| `Phase1SafeFoundations` | 1709078400000 | Foundational tables |
| `Phase2AutomationAndTemplates` | 1709164800000 | Automation + templates |
| `Phase3PriceTypesMigration` | 1709251200000 | Price column type fixes |
| `Phase3ComplianceSatellite` | 1709337600000 | Compliance tables |
| `Phase3Partitioning` | 1709424000000 | Table partitioning |
| `Phase3DeprecateChannelListings` | 1709510400000 | Channel listing cleanup |
| `Phase3MultiTenant` | 1709596800000 | Multi-tenant columns |
| `Phase4MultiStoreFoundation` | 1709683200000 | Multi-store base |
| `MotorsIntelligenceSystem` | 1709769600000 | Motors AI pipeline |
| `Migration` | 1772145877171 | Generated migration |
| `CatalogImportSystem` | 1772600000000 | Catalog import tables |
| `Phase1UpgradeSchema` | 1774000000000 | Schema upgrade |
| `Phase2VinCache` | 1774100000000 | VIN cache table |
| `ListingRecordsSearchVectorTrigger` | 1774300000000 | Full-text search |
| `EbayMultiAccountIntegration` | 1775200000000 | eBay multi-account |
| `EbayMultiStoreExtensions` | 1775300000000 | eBay multi-store |
| `ListingOptimizationPipeline` | 1775300000000 | Optimization pipeline |
| `RbacFoundation` | 1775400000000 | RBAC tables |
| `ClientSettings` | 1775400000001 | Client settings |

---

## Known Database Issues

### From Prior Audits

1. **TEXT-typed price columns**: `startPrice`, `quantity` in `listing_records` are TEXT. Numeric columns (`startPriceNum`, `quantityNum`) added by `Phase3PriceTypesMigration`. Application should prefer numeric columns.

2. **Missing foreign keys**: Some tables lack FK constraints (historical issue):
   - `listing_revisions` → `listing_records`
   - `order_items` → `orders`
   - `sales_records` (verify)
   - `inventory_events` → `inventory_ledger`

3. **Dual channel tables**: `channel_listings` being deprecated in favor of `listing_channel_instances` (per `Phase3DeprecateChannelListings`).

4. **Tenant isolation**: `organizationId` columns added but row-level enforcement inconsistent.

---

## Query Patterns

### Multi-tenant Queries

Most entities have `organizationId` for tenant isolation:

```typescript
// Example pattern
const listings = await listingRepo.find({
  where: { organizationId: currentUser.organizationId }
});
```

### Soft Deletes

Entities with `@DeleteDateColumn` support soft deletes:

```typescript
// TypeORM automatically excludes soft-deleted rows
const active = await listingRepo.find(); // Excludes deletedAt != null

// Include deleted
const all = await listingRepo.find({ withDeleted: true });
```

### Full-text Search

`listing_records` has `searchVector` tsvector column with DB trigger:

```sql
-- Generated by migration
-- Trigger updates searchVector on title, description changes
```

---

## Related Documentation

- **Architecture**: `/docs/architecture/overview.md`
- **API Map**: `/docs/architecture/api-map.md`
- **Codebase Map**: `/docs/CODEMAP.md`
- **Known Gaps**: `/docs/KNOWN_GAPS_AND_RISKS.md`

---

*Last updated: 2026-05-29*
