# Known Issues

> **Source**: Moved from `docs/KNOWN_GAPS_AND_RISKS.md` (2026-05-29).
> This is the master file for known issues, risks, and technical debt.
> For prioritized action items, see [NEXT_STEPS.md](NEXT_STEPS.md).

---

## Critical Issues (Fix Immediately)

### R1: Double `/api` Prefix Routing

**Type**: Bug  
**Severity**: Medium  
**Status**: Needs verification

**Description**: Two controllers declare paths with `api/` prefix that combines with global prefix:
- `feature-flag.controller.ts`: `@Controller('api/feature-flags')` → `/api/api/feature-flags`
- `export-rule.controller.ts`: `@Controller('api/export-rules')` → `/api/api/export-rules`

**Affected Areas**: API routing, frontend API clients  
**Suggested Fix**: Verify frontend clients, fix controllers to remove `api/` prefix, update clients if needed.  
**Files**: `backend/src/common/feature-flags/feature-flag.controller.ts`, `backend/src/listings/export-rule.controller.ts`

### R3: Production Secrets as Defaults

**Type**: Security Concern  
**Severity**: High  
**Status**: Ongoing risk

**Description**: `.env.example` contains default credentials (`DB_PASSWORD=postgres`, `JWT_SECRET=CHANGE_ME`). Risk of production deployments using weak credentials.

**Affected Areas**: Security  
**Suggested Fix**: Add validation script, enforce pre-deploy checklist.

### R3b: DEBUG JWT Logging

**Type**: Security Concern  
**Severity**: High  
**Status**: Resolved (2026-06-17)

**Description**: `auth.service.ts` and `jwt.strategy.ts` logged JWT secret prefixes and full tokens to console with `[DEBUG]` markers.

**Resolution**: Debug logging removed from auth service, JWT strategy, and auth module factory.

### R3c: Open Public Registration

**Type**: Security Concern  
**Severity**: High  
**Status**: Mitigated (2026-06-17)

**Description**: `POST /api/auth/register` was public and assigned Staff role.

**Resolution**: Gated by `ALLOW_PUBLIC_REGISTRATION` (default off in production/Docker); self-registered users get Viewer role; login UI hides register link when disabled. Admin invite via `POST /api/rbac/users` remains the production path.

---

## High Priority Issues

### R18: eBay Publish Changed Reviewed Titles and Business Policies

**Type**: Data-integrity bug
**Severity**: High
**Status**: Resolved (2026-07-15)

**Description**: Durable bulk targets canonicalized listing IDs to `catalog_products`, and the worker did not retain the exact source listing row. `buildEbayListingTitle` then recomposed every non-empty title from structured fields. `ListingBuilderService` started with marketplace defaults and ignored row-level shipping/payment/return profile names. Finally, `EbayPublishService` persisted the policy IDs resolved for each listing back into `ebay_account_marketplaces.default_*`, so concurrent targets could race and change the defaults used by other listings. Production pipelines `1c3a0f2a`, `5d5c2413`, and `6e30444a` exposed the combined failure.

**Resolution**: Durable targets retain `sourceListingId`; the resolver prefers that exact row; stored titles are authoritative; named profiles resolve per target account and refresh from eBay on cache misses; missing/incompatible names block instead of falling back; and request-scoped resolved policy IDs no longer mutate account defaults. Explicit zero stock is also preserved instead of being coerced to quantity `1`, and transient eBay revise/availability propagation errors use the durable worker's retry policy. Regression coverage spans title construction, source resolution, durable target identity, listing building, final policy enrichment, transient classification, and zero-stock publishing.

**Production remediation**: Created the two exact missing Primemotive fulfillment policies (`331303545021` and `331303546021`), deployed the fix, and republished all 1,960 affected channels across BLACKLINEAUTOPARTS and Primemotive. Two temporary eBay propagation failures succeeded through a targeted retry. A complete live Inventory API readback found all 1,960 inventory items and offers; title, category, price, and all three policy IDs matched. It exposed one additional zero-stock mismatch on two channels, which was fixed and republished; the final targeted live readback reported zero mismatches. Database audit: 1,960 distinct successfully repaired channels, zero unresolved named-profile assignments, zero recomposed-title warnings, and unchanged marketplace defaults.

**Files**: `backend/src/channels/ebay/ebay-listing-text.util.ts`, `backend/src/channels/ebay/ebay-publish.service.ts`, `backend/src/integrations/ebay/services/catalog-publish-resolver.service.ts`, `backend/src/integrations/ebay/services/listing-builder.service.ts`, `backend/src/integrations/ebay/processors/ebay-listing-publish.processor.ts`

### R17: Catalog Bulk Publish Exhausted Authenticated-User Throttle

**Type**: Reliability bug  
**Severity**: High  
**Status**: Resolved (2026-07-11)

**Description**: Bulk publish issued one authenticated `publish-by-listings` request per listing at concurrency 5. Large, consecutive page batches could exhaust the global 1,000-request/hour user bucket. SellerPundit also intermittently returned `Product not found` immediately after inventory creation or Core Inventory HTTP 500 responses. Targeted retry jobs reused mounted `PublishProgressPanel` state, which could show a stale 100-row summary for a smaller retry.

**Resolution**: `PublishProgressPanel` sends chunks of five listing IDs through the existing backend batch endpoint, reducing a 100-listing page from 100 authenticated requests to 20. It recognizes SellerPundit timing/500 and application throttle errors and retries only failed store IDs with exponential backoff. `CatalogManager` keys the panel by publish-job ID so each retry receives fresh state. Successful store results are never resubmitted by the automatic retry path.

**Files**: `src/components/catalog/PublishProgressPanel.tsx`, `src/components/catalog/CatalogManager.tsx`

### R16: Empty ebay_category_mappings Caused Invalid Category Publishes

**Type**: Bug  
**Severity**: High  
**Status**: Resolved (2026-07-10)

**Description**: The `ebay_category_mappings` table was empty on production because seed migration `1709769600000-MotorsIntelligenceSystem` was never run (not in `typeorm_migrations`). Combined with `isMotorsCategory()` returning `true` for unmapped categories by default, the AI taxonomy suggestion API (using tree `'0'` = all eBay US, not Motors-specific) returned non-automotive categories (e.g. "Lincoln Memorial" cat 31373, "Other Educational Toys" cat 2518, "Other Welding Equipment" cat 11774) that passed validation. These bad category IDs were stored in `listing_records.categoryId` and caused eBay `publishOffer` to fail with errorId 25005 ("invalid category ID").

**Resolution**: (1) `isMotorsCategory()` in `enterprise-listing-intelligence.service.ts` now returns `false` for unmapped/unknown categories, forcing taxonomy re-resolution. (2) Seeded `ebay_category_mappings` with 15 known Motors categories. (3) Production follow-up on 2026-07-11 showed that category `6000` is a non-publishable root; `getFallbackLeafCategory()` now uses verified leaf `9886` (`Other Car & Truck Parts & Accessories`) only when live subtree leaf discovery fails. (4) Repairs update both `listing_records` and `catalog_products` so stale category data cannot re-enter the publish path. (5) Follow-up on 2026-07-15 added a generic-identity guard: rows whose extracted type is only `Part`, `Not Specified`, `Miscellaneous`, `Automotive`, or similar cannot keep or request a specific taxonomy category unless a trusted deterministic keyword confirms the part family; they fall back to `9886` and can be marked for manual review.

**Files**: `backend/src/ingestion/enterprise-listing-intelligence.service.ts`, `backend/src/migrations/1709769600000-MotorsIntelligenceSystem.ts`

### R2: Low Test Coverage

**Type**: Technical Debt  
**Severity**: High  
**Status**: Confirmed

**Description**: 24 backend `.spec.ts` files (unit only), 0 e2e tests, 0 frontend tests. Regressions go undetected, especially in auth/RBAC and eBay paths.

**Suggested Fix**: Add tests for auth/RBAC, eBay OAuth flow, eBay publish/sync, catalog import pipeline, permission enforcement.

### R9: No JWT Revocation

**Type**: Security Concern  
**Severity**: Medium  
**Status**: Confirmed

**Description**: Logout is client-side only — tokens remain valid until expiry. No server-side token blacklist or versioning.

**Suggested Fix**: Implement short expiry + refresh tokens, or token blacklist (Redis), or token versioning.

### R10: eBay OAuth Fragility

**Type**: Risk  
**Severity**: High  
**Status**: Needs monitoring

**Description**: eBay token refresh against live API can fail due to network issues, API downtime, token expiry edge cases. Risk of integration disruption and failed publishes.

**Suggested Fix**: Monitor `EbayApiError` logs, implement exponential backoff retry, add token refresh alerting, test refresh path regularly.

---

## Medium Priority Issues

### R6: TEXT-Typed Price Columns

**Type**: Technical Debt  
**Severity**: Medium  
**Status**: Partially fixed

**Description**: `listing_records` has TEXT columns for prices/quantities (`startPrice`, `quantity`). `Phase3PriceTypesMigration` added numeric columns (`startPriceNum`, `quantityNum`). Application should prefer `*Num` columns.

**Suggested Fix**: Confirm all code uses `*Num` columns, plan migration to drop TEXT columns.

### R7: Missing Foreign Keys

**Type**: Technical Debt  
**Severity**: Medium  
**Status**: Historical issue

**Description**: Some tables lack FK constraints: `listing_revisions` → `listing_records`, `order_items` → `orders`, `sales_records`, `inventory_events` → `inventory_ledger`. Risk of orphaned rows and data integrity issues.

**Suggested Fix**: Audit all entity relationships, add missing FK constraints via migration, clean up orphaned data.

### R8: Weak Tenant Isolation

**Type**: Security Concern  
**Severity**: High  
**Status**: Confirmed

**Description**: `organizationId` columns added but row-level enforcement is inconsistent. Risk of data leakage between organizations.

**Suggested Fix**: Check all service methods filter by `organizationId`, verify repository queries include org filter, test cross-org data access.

### R11: Dual Channel Tables

**Type**: Technical Debt  
**Severity**: Medium  
**Status**: In progress

**Description**: Two channel mapping tables: `channel_listings` (deprecated) and `listing_channel_instances` (new). `Phase3DeprecateChannelListings` started consolidation.

**Suggested Fix**: Verify code uses new table, complete data migration, drop old table.

### R12: Non-eBay Channels are Scaffolding

**Type**: Risk  
**Severity**: Medium  
**Status**: Confirmed

**Description**: Shopify/Amazon/Walmart integrations are scaffolding only. eBay is the only fully-developed channel. Risk of user confusion and incomplete features.

**Suggested Fix**: Complete implementations or hide/disable UI.

---

## Low Priority Issues

### R4: Catalog CSV Import OOM

**Type**: Risk  
**Severity**: Medium  
**Status**: Mitigated

**Description**: Large CSV imports can cause out-of-memory errors. Mitigated with `NODE_OPTIONS=--max-old-space-size=8192` in Docker and concurrency caps.

### R5: Migration Failure on Boot

**Type**: Risk  
**Severity**: High  
**Status**: Mitigated

**Description**: Auto-run migrations on boot can fail and block startup. Mitigated with `migrationsTransactionMode: 'each'` and health checks.

### R13: Uncommitted Working Tree

**Type**: Risk  
**Severity**: Medium  
**Status**: Needs triage

**Description**: Large number of modified files in working tree (per `git status` snapshot 2026-05-29). Risk of lost work and merge conflicts.

**Suggested Fix**: Review, commit in coherent chunks, document what each commit contains.

### R14: Branding Inconsistency

**Type**: Bug  
**Severity**: Low  
**Status**: Confirmed

**Description**: App shows "RealTrackApp" but login screen and DB name use "ListingPro". Minor user confusion.

**Suggested Fix**: Standardize on "RealTrackApp", update login screen.

### R15: Documentation Drift

**Type**: Risk  
**Severity**: Medium  
**Status**: Ongoing

**Description**: Documentation can drift from code over time. Mitigated by Continuous Documentation Protocol in CLAUDE.md/AGENTS.md.

---

## Risk Matrix Summary

| Risk | Likelihood | Impact | Priority |
|------|-----------|--------|----------|
| R1: Double /api prefix | Medium | Medium | Critical |
| R2: Low test coverage | High | High | Critical |
| R3: Default secrets | Medium | High | Critical |
| R3b: DEBUG JWT logging | High | High | Critical |
| R8: Weak tenant isolation | Medium | High | High |
| R9: No JWT revocation | Medium | Medium | High |
| R10: eBay OAuth fragility | Medium | High | High |
| R6: TEXT price columns | Medium | Medium | Medium |
| R7: Missing FKs | Medium | Medium | Medium |
| R13: Uncommitted work | Medium | Medium | Medium |
| R4: CSV OOM | Medium | Medium | Low (mitigated) |
| R5: Migration failure | Low | High | Low (mitigated) |
| R11: Dual channel tables | Low | Medium | Low |
| R12: Non-eBay scaffolding | Medium | Medium | Low |
| R14: Branding inconsistency | High | Low | Low |
| R15: Doc drift | High | Medium | Ongoing |

---

*Last updated: 2026-06-11. Reorganized: 2026-06-06.*
