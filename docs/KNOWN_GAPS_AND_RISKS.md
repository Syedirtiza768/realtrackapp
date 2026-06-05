# Known Gaps and Risks

> Comprehensive inventory of known issues, risks, and technical debt.
> For prioritized next steps, see `/docs/handover/next-steps.md`.
> For risk register, see `/docs/handover/risk-register.md`.

---

## Critical Issues (Fix Immediately)

### R1: Double `/api` Prefix Routing

**Status**: Needs verification  
**Likelihood**: Medium  
**Impact**: Medium

**Issue**: Two controllers declare paths with `api/` prefix that combines with global prefix:
- `feature-flag.controller.ts`: `@Controller('api/feature-flags')` → `/api/api/feature-flags`
- `export-rule.controller.ts`: `@Controller('api/export-rules')` → `/api/api/export-rules`

**Verification Needed**:
- Check if frontend clients call `/api/api/...` or `/api/...`
- Verify Swagger docs show correct paths

**Fix Strategy**:
1. Check frontend API clients in `src/lib/*Api.ts`
2. If clients use `/api/api/...`, fix controllers to remove `api/` prefix
3. Update clients to use correct paths
4. Update `/docs/architecture/api-map.md`

**Files to Check**:
- `backend/src/common/feature-flags/feature-flag.controller.ts`
- `backend/src/listings/export-rule.controller.ts`
- `src/lib/featureFlagsApi.ts` (if exists)
- `src/lib/exportRulesApi.ts` (if exists)

---

### R3: Production Secrets as Defaults

**Status**: Ongoing risk  
**Likelihood**: Medium  
**Impact**: High

**Issue**: `.env.example` contains default credentials:
- `DB_PASSWORD=postgres`
- `JWT_SECRET=CHANGE_ME_to_a_random_secret`

**Risk**: Production deployments may use weak credentials.

**Mitigation**:
- [ ] Add validation script to check for defaults
- [ ] Add pre-deploy checklist enforcement
- [ ] Document strong secret generation

**See**: `/docs/operations/security-checklist.md`

---

## High Priority Issues

### R2: Low Test Coverage

**Status**: Confirmed  
**Likelihood**: High  
**Impact**: High

**Issue**: 
- 9 backend `.spec.ts` files
- 1 e2e test
- No meaningful frontend tests

**Risk**: Regressions go undetected, especially in auth/RBAC and eBay paths.

**Priority Test Coverage**:
1. Auth/RBAC (login, permissions, guards)
2. eBay OAuth flow
3. eBay publish/sync
4. Catalog import pipeline
5. Permission enforcement

**Files to Create**:
- `backend/src/auth/auth.service.spec.ts` (expand)
- `backend/src/rbac/rbac.service.spec.ts` (expand)
- `backend/src/integrations/ebay/*.spec.ts` (new)
- `src/components/auth/*.test.tsx` (new)

---

### R9: No JWT Revocation

**Status**: Confirmed  
**Likelihood**: Medium  
**Impact**: Medium

**Issue**: Logout is client-side only. Tokens remain valid until expiry.

**Current Flow**:
1. Client calls `POST /api/auth/logout` (audit only)
2. Client clears `localStorage`
3. Token still valid server-side

**Solutions**:
1. **Short expiry + refresh tokens** (recommended)
2. **Token blacklist** (Redis-based)
3. **Token versioning** (increment version on logout)

**Implementation**:
- Add `tokenVersion` to User entity
- Include version in JWT payload
- Validate version on each request
- Increment version on logout

---

### R10: eBay OAuth Fragility

**Status**: Needs monitoring  
**Likelihood**: Medium  
**Impact**: High

**Issue**: eBay token refresh against live API can fail due to:
- Network issues
- eBay API downtime
- Token expiry edge cases

**Risk**: Integration disruption, failed publishes.

**Mitigation**:
- [ ] Monitor `EbayApiError` logs
- [ ] Implement exponential backoff retry
- [ ] Add token refresh alerting
- [ ] Test refresh path regularly

**Files**:
- `backend/src/integrations/ebay/services/ebay-integrations-oauth.service.ts`
- `backend/src/integrations/ebay/entities/ebay-api-error.entity.ts`

---

## Medium Priority Issues

### R6: TEXT-Typed Price Columns

**Status**: Partially fixed  
**Likelihood**: Medium  
**Impact**: Medium

**Issue**: `listing_records` table has TEXT columns for prices/quantities:
- `startPrice` (TEXT)
- `quantity` (TEXT)
- `buyItNowPrice` (TEXT)

**Fix**: `Phase3PriceTypesMigration` added numeric columns:
- `startPriceNum` (numeric)
- `quantityNum` (int)
- `buyItNowPriceNum` (numeric)

**Verification Needed**:
- [ ] Confirm all application code uses `*Num` columns
- [ ] Verify DB trigger syncs TEXT → numeric
- [ ] Plan migration to drop TEXT columns

**Files**:
- `backend/src/listings/entities/listing-record.entity.ts`
- `backend/src/migrations/1709251200000-Phase3PriceTypesMigration.ts`

---

### R7: Missing Foreign Keys

**Status**: Historical issue  
**Likelihood**: Medium  
**Impact**: Medium

**Issue**: Some tables lack FK constraints:
- `listing_revisions` → `listing_records`
- `order_items` → `orders`
- `sales_records` (verify)
- `inventory_events` → `inventory_ledger`

**Risk**: Orphaned rows, data integrity issues.

**Action**:
- [ ] Audit all entity relationships
- [ ] Add missing FK constraints via migration
- [ ] Clean up orphaned data

---

### R8: Weak Tenant Isolation

**Status**: Confirmed  
**Likelihood**: Medium  
**Impact**: High

**Issue**: `organizationId` columns added but row-level enforcement inconsistent.

**Risk**: Data leakage between organizations.

**Verification Needed**:
- [ ] Check all service methods filter by `organizationId`
- [ ] Verify repository queries include org filter
- [ ] Test cross-org data access

**Pattern to Follow**:
```typescript
// In every service method
const listings = await this.listingRepo.find({
  where: { organizationId: user.organizationId }
});
```

---

### R11: Dual Channel Tables

**Status**: In progress  
**Likelihood**: Low  
**Impact**: Medium

**Issue**: Two channel mapping tables exist:
- `channel_listings` (deprecated)
- `listing_channel_instances` (new)

**Migration**: `Phase3DeprecateChannelListings` started consolidation.

**Action**:
- [ ] Verify all code uses new table
- [ ] Complete data migration
- [ ] Drop old table

---

### R12: Non-eBay Channels are Scaffolding

**Status**: Confirmed  
**Likelihood**: Medium  
**Impact**: Medium

**Issue**: Shopify/Amazon/Walmart integrations are scaffolding only. eBay is the only fully-developed channel.

**Risk**: User confusion, incomplete features.

**Options**:
1. **Complete implementations** (high effort)
2. **Hide/disable UI** (quick fix)
3. **Document as "Coming Soon"** (intermediate)

**Files**:
- `src/components/settings/EbayStoresSettingsPage.tsx` (only eBay visible)
- `backend/src/channels/` (has generic channel abstraction)

---

## Low Priority Issues

### R4: Catalog CSV Import OOM

**Status**: Mitigated  
**Likelihood**: Medium  
**Impact**: Medium

**Issue**: Large CSV imports can cause out-of-memory errors.

**Mitigation Applied**:
- `NODE_OPTIONS=--max-old-space-size=8192` in Docker
- Concurrency caps in processor

**Monitoring**:
- Watch memory usage during imports
- Consider streaming processing for very large files

---

### R5: Migration Failure on Boot

**Status**: Mitigated  
**Likelihood**: Low  
**Impact**: High

**Issue**: Auto-run migrations on boot can fail and block startup.

**Mitigation**:
- `migrationsTransactionMode: 'each'` (each migration commits independently)
- Health checks verify DB connectivity before starting backend

**Best Practice**:
- Run migrations manually before deploy
- Have rollback plan

---

### R13: Uncommitted Working Tree

**Status**: Needs triage  
**Likelihood**: Medium  
**Impact**: Medium

**Issue**: Large number of modified files in working tree (per `git status`).

**Risk**: Lost work, merge conflicts.

**Action**:
- [ ] Review all modified files
- [ ] Commit in coherent chunks
- [ ] Document what each commit contains

---

### R14: Branding Inconsistency

**Status**: Confirmed  
**Likelihood**: High  
**Impact**: Low

**Issue**: App shows "RealTrackApp" but login screen and DB name use "ListingPro".

**Impact**: Minor user confusion.

**Fix**:
- Standardize on "RealTrackApp"
- Update login screen
- Consider DB rename (careful!)

---

### R15: Documentation Drift

**Status**: Ongoing  
**Likelihood**: High  
**Impact**: Medium

**Issue**: Documentation can drift from code over time.

**Mitigation**:
- Continuous Documentation Protocol in `CLAUDE.md`/`AGENTS.md`
- Update docs with every meaningful change
- Periodic documentation audits

---

## Feature Gaps

### Forgot Password Flow

**Status**: UI exists, backend unverified  
**Priority**: Medium

**Current State**:
- Frontend: `/forgot-password` page exists
- Backend: Reset endpoint not confirmed

**Action**:
- [ ] Verify backend has password reset endpoint
- [ ] If missing, implement or hide UI

### Refresh Token Rotation

**Status**: Not implemented  
**Priority**: Medium

**Current State**: Single JWT with fixed expiry.

**Solution**: Implement refresh token flow:
1. Short-lived access token (15 min)
2. Long-lived refresh token (7 days)
3. Rotate refresh token on use
4. Detect refresh token reuse (possible theft)

### Frontend Tests

**Status**: None  
**Priority**: Low

**Recommendation**: Add at minimum:
- Auth flow tests (login, logout, 401 handling)
- Permission-based UI tests
- Critical path E2E tests

---

## Technical Debt

### Database

| Item | Priority | Notes |
|------|----------|-------|
| Complete price column migration | Medium | Drop TEXT columns |
| Add missing FKs | Medium | Data integrity |
| Tenant isolation audit | High | Security |
| Complete channel table consolidation | Low | Cleanup |
| Add composite indexes | Low | Performance |

### Code

| Item | Priority | Notes |
|------|----------|-------|
| Fix double /api prefix | High | Routing |
| Add comprehensive tests | High | Quality |
| Implement JWT revocation | Medium | Security |
| Standardize error handling | Low | Consistency |
| Add request logging | Low | Observability |

### Documentation

| Item | Priority | Notes |
|------|----------|-------|
| API endpoint DTO documentation | Medium | Developer experience |
| Frontend component docs | Low | Maintenance |
| Deployment runbook expansion | Low | Operations |

---

## Risk Matrix

| Risk | Likelihood | Impact | Priority |
|------|-----------|--------|----------|
| R1: Double /api prefix | Medium | Medium | Critical |
| R2: Low test coverage | High | High | Critical |
| R3: Default secrets | Medium | High | Critical |
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

## Related Documentation

- **Risk Register**: `/docs/handover/risk-register.md`
- **Next Steps**: `/docs/handover/next-steps.md`
- **Security Checklist**: `/docs/operations/security-checklist.md`
- **Architecture**: `/docs/architecture/overview.md`

---

*Last updated: 2026-05-29*
