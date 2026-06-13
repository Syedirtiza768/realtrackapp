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
**Status**: Confirmed

**Description**: `auth.service.ts` and `jwt.strategy.ts` log JWT secret prefixes and full tokens to console with `[DEBUG]` markers. Risk of token exposure in production logs.

**Affected Areas**: Security  
**Suggested Fix**: Gate behind `NODE_ENV=development` or remove entirely.

---

## High Priority Issues

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
