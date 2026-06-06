> ⚠️ MOVED → [/docs/architecture/DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (2026-06-06)

# Database

## Engine & access layer

- **Database**: PostgreSQL 16 (`postgres:16-alpine` in Docker). Default DB name
  `listingpro`.
- **ORM**: TypeORM 0.3 via `@nestjs/typeorm`.
- **Driver**: `pg`. Connection pool tuned in `app.module.ts`
  (`DB_POOL_MAX`/`DB_POOL_MIN`, 30s idle, 5s connect, 30s statement timeout).
- **Runtime config**: `app.module.ts` `TypeOrmModule.forRootAsync`.
- **CLI/migration config**: `backend/src/data-source.ts` (used by `typeorm` CLI).

> `synchronize` defaults to **false** (`DB_SYNCHRONIZE`). Schema changes must go
> through migrations. `DB_MIGRATIONS_RUN=true` runs pending migrations on boot
> (the default in Docker compose).

## Entities (79 entity files)

Entities are auto-loaded (`autoLoadEntities: true`) plus an explicit list for the
core listing tables. Grouped by module:

| Module | Key entities (table) |
|--------|----------------------|
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

## Migrations

Location: `backend/src/migrations/` (21 files), table `typeorm_migrations`.
`migrationsTransactionMode: 'each'` — each migration commits independently so a
later failure doesn't roll back earlier ones.

Phased history (chronological by timestamp prefix):

| Migration | Theme |
|-----------|-------|
| `…990-ListingRecordsBase`, `…999-InitialSchema` | Base listing tables + initial schema |
| `Phase1SafeFoundations` | Foundational tables |
| `Phase2AutomationAndTemplates` | Automation + templates |
| `Phase3PriceTypesMigration` | Price column type fixes |
| `Phase3ComplianceSatellite` | Compliance tables |
| `Phase3Partitioning` | Partitioning |
| `Phase3DeprecateChannelListings` | Channel listing deprecation |
| `Phase3MultiTenant` | Multi-tenant columns |
| `Phase4MultiStoreFoundation` | Multi-store base |
| `MotorsIntelligenceSystem` | Motors AI pipeline tables |
| `1772145877171-Migration` | Generated migration |
| `CatalogImportSystem` | Catalog import tables |
| `Phase1UpgradeSchema`, `Phase2VinCache` | Upgrade + VIN cache |
| `ListingRecordsSearchVectorTrigger` | Full-text search vector trigger |
| `EbayMultiAccountIntegration`, `EbayMultiStoreExtensions` | eBay multi-account/store |
| `ListingOptimizationPipeline` | Optimization pipeline tables |
| `RbacFoundation` | Roles/permissions tables |
| `ClientSettings` | White-label client settings |

Commands (run from `backend/`):

```bash
npm run migration:generate   # build + generate from entity diff
npm run migration:run        # apply pending
npm run migration:revert     # revert last
npm run migration:show       # status
```

A PowerShell helper exists: `scripts/run-migrations.ps1`.

## Seed data

- `listingpro.dump` (repo root) is restored into a fresh Postgres volume by
  `docker/postgres/init/01-restore-listingpro.sh` on first init. If absent,
  migrations create the schema.
- RBAC roles/permissions seeded from `rbac/permission-registry.ts` via
  `RbacSeedService` (see [auth-rbac.md](auth-rbac.md)).
- Demo seed scripts: `backend/src/scripts/seed-rbac.ts`, `seed-demo-ebay.ts`.

## Multi-tenant / org scoping

- Internal tenancy via `Organization` / `OrganizationMember` (auth module).
  `Phase3MultiTenant` added tenant columns. New users get a default org
  (`UserOrganizationService.ensureDefaultForUser`).
- eBay "stores"/"accounts" (`ConnectedEbayAccount`, `Store`, `InternalStore`) are
  a separate, marketplace-side concept — **not** the same as internal orgs.
- **Needs verification**: extent of row-level tenant isolation enforced in
  queries (the historical audit flagged inconsistent scoping).

## Known DB risks

See `docs/FULL_SYSTEM_AUDIT_AND_ROADMAP.md` (prior audit) and
[/docs/handover/risk-register.md](../handover/risk-register.md):
TEXT-typed price/quantity columns, missing foreign keys, dual channel-mapping
tables, and some tables historically created outside migrations.
