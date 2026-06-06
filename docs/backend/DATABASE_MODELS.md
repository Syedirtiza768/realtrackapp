# Database Models

> **Note**: Lightweight satellite to [/docs/architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md).
> Extracted from entity details in `docs/architecture/database.md` (2026-05-29).
> For the complete schema with columns and indexes, see DATABASE_SCHEMA.

---

## Entity Organization

~79 TypeORM entity files, auto-loaded via `autoLoadEntities: true` in `app.module.ts` and `data-source.ts`. Each entity uses `@Entity()` decorator with TypeORM column decorators (`@Column`, `@PrimaryColumn`, `@ManyToOne`, etc.).

### By Module

| Module | Entity Count | Key Entities |
|--------|--------------|--------------|
| auth | 3 | User, Organization, OrganizationMember |
| rbac | 4 | Role, Permission, RolePermission, UserRoleAssignment |
| listings | 10+ | ListingRecord, ListingRevision, ListingCompliance, EbayOffer, EbayCategory, MasterProduct, CompetitorPrice, CrossReference, MarketSnapshot, ExportRule |
| catalog-import | 4 | CatalogImport, CatalogImportRow, CatalogProduct, ComplianceAuditLog |
| fitment | 8 | FitmentEngine, FitmentMake, FitmentModel, FitmentSubmodel, FitmentYear, PartFitment, VinCache |
| ingestion | 3 | IngestionJob, PipelineJob, AiResult |
| motors-intelligence | 10 | MotorsProduct, ProductCandidate, ExtractedAttribute, ValidationResult, ReviewTask, ListingGeneration, CorrectionRule, EbayAspectRequirement, EbayCategoryMapping, MotorsFeedbackLog |
| channels | 7 | ChannelConnection, ChannelListing, ChannelWebhookLog, ListingChannelInstance, Store, AiEnhancement, DemoSimulationLog |
| integrations/ebay | 14 | ConnectedEbayAccount, EbayAccountMarketplace, EbayOauthToken, EbayBusinessPolicy, EbayListingJob, EbayListingJobTarget, EbayListingChannel, EbayListingSyncLog, EbayApiAuditLog, EbayApiError, InternalStore, InventoryMovement, ListingActionLog, ListingStoreOverride |
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

## TypeORM Patterns in Use

### Column Types

```typescript
@PrimaryGeneratedColumn('uuid') id: string;
@Column({ type: 'varchar', length: 200, unique: true }) email: string;
@Column({ type: 'text', select: false }) passwordHash: string;
@Column({ type: 'numeric', precision: 12, scale: 2 }) totalAmount: number;
@Column({ type: 'jsonb', nullable: true }) data: Record<string, any>;
@Column({ type: 'tsvector', select: false }) searchVector: string;
```

### Timestamps

```typescript
@CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
@UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
@DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date;  // Soft delete
```

### Relations

```typescript
@ManyToOne(() => ListingRecord)
@JoinColumn({ name: 'listingRecordId' })
listingRecord: ListingRecord;

@OneToMany(() => OrderItem, (item) => item.order)
items: OrderItem[];
```

### Indexes

```typescript
@Index()  // Single-column
@Index(['sourceFileName', 'sheetName', 'sourceRowNumber'], { unique: true })  // Composite
```

### Optimistic Locking / Concurrency

```typescript
@VersionColumn() version: number;
```

---

## Critical Entities

### `ListingRecord` — Central entity, 76+ columns

The most important entity in the system. All listings, eBay publish targets, and channel associations trace back to this table. Contains both legacy TEXT columns (`startPrice`, `quantity`) and numeric equivalents (`startPriceNum`, `quantityNum`) — prefer `*Num` variants.

### `User` — Auth entity

`select: false` on `passwordHash` prevents accidental exposure. Legacy `role` column bridged to RBAC via `LEGACY_USER_ROLE_TO_SLUG`.

### `ConnectedEbayAccount` + `EbayOauthToken` — eBay auth

Tokens stored encrypted. Separate from user auth. Links to `InternalStore` (logical store within platform) and `EbayAccountMarketplace` (marketplace-specific settings).

### `InventoryLedger` + `InventoryEvent` — Inventory

Ledger tracks current quantities; events provide the audit trail of all changes. `StoreInventoryAllocation` links to stores for per-store allocation tracking.

---

## Entity Creation Checklist

When adding a new entity:

1. Create entity file in module's `entities/` directory
2. Use `@Entity('table_name')` with explicit table name
3. Add proper column types (not TEXT for numbers)
4. Add indexes for query patterns
5. Add FK relations with `@ManyToOne` / `@OneToMany`
6. Add `@CreateDateColumn` / `@UpdateDateColumn` for timestamps
7. Generate migration: `cd backend && npm run migration:generate`
8. Review migration SQL before applying
9. Update [/docs/architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md)

---

*Created: 2026-06-06 (satellite).*
