# Testing

## Fashion source catalogue import

Focused regression coverage includes `backend/src/catalog-import/catalog-import.service.spec.ts`, `backend/src/catalog-import/catalog-product.service.spec.ts`, `backend/src/verticals/fashion-catalog-export.spec.ts`, `backend/src/verticals/fashion.config.spec.ts`, `backend/src/verticals/fashion-image-analysis.service.spec.ts`, and `backend/src/verticals/fashion-capture-reliability.spec.ts`. Run `cd backend; npm test -- --runInBand --runTestsByPath src/catalog-import/catalog-import.service.spec.ts src/catalog-import/catalog-product.service.spec.ts src/verticals/fashion-catalog-export.spec.ts src/verticals/fashion.config.spec.ts src/verticals/fashion-image-analysis.service.spec.ts src/verticals/fashion-capture-reliability.spec.ts` after importer or source-field changes; the current main-based run passes 33 tests. A clean backend/frontend build also checks the import, editor, and publish flow.

## Fashion capture reliability (2026-10-13)

Production follow-up: the same browser suite passed against the deployed bundle.
A separate actual Fashion upload/S3/proxy smoke passed, as did deployed UUID
validation and a live database allocator check rolled back without retained
counter changes. See [release evidence](FASHION_CAPTURE_RELEASE_2026-10-13.md).

Full screen camera follow-up: the browser suite also verifies exact viewport
coverage for the dialog/video and visible controls at 390×844, 844×390 and
1280×900; full-size review dimensions; captured JPEG aspect ratio matching the
preview; and stream replacement/release when switching cameras. Main and
cumulative production frontend builds and scoped camera lint pass.
These scenarios also pass against the deployed full screen camera bundle
`a84fa885`; the backend container was unchanged and public health remained healthy.

- Frontend and backend builds pass. The changed frontend files pass ESLint using
  a scoped TypeScript/React-hooks configuration. The root `npm run lint` remains
  blocked by the existing missing ESLint 9 configuration. Backend lint also has
  existing formatting/type-lint findings outside the changed code.
- `cd backend; npm test -- --runInBand --runTestsByPath src/verticals/fashion-capture-reliability.spec.ts src/verticals/fashion.config.spec.ts src/verticals/fashion-image-analysis.service.spec.ts`
  passes **26 tests**. Use explicit paths: a worktree name containing "fashion"
  makes Jest's path-pattern option select unrelated suites.
- `node scripts/test-fashion-capture-ui.mjs` against `FASHION_UI_URL` (default
  `http://127.0.0.1:3935`) uses authenticated API fixtures and Chromium's synthetic
  camera. It covers continuous capture, retake, concurrency, cleanup, photo roles,
  size correction, next garment, failed upload, interrupted create, camera/SKU/
  upload deadlines, late camera grants and Add Item. Set `FASHION_PLAYWRIGHT_PATH`
  and optionally `FASHION_CHROME_PATH` for the local test runtime.
- `FASHION_TEST_DATABASE_URL=<disposable PostgreSQL URL> node scripts/test-fashion-sku-postgres.cjs`
  exercises real PostgreSQL locking and 30 simultaneous reservations across three
  organizations. **Use only a disposable database**; the script creates minimal
  test tables. It requires a compiled backend.
- Broader suite run: 86 suites/704 tests passed, 9 suites/47 tests failed and 19
  tests skipped. Failures are in unchanged B&I, eBay/catalog and ingestion code;
  no Fashion test failed. Physical iOS/Android camera behavior and actual S3
  uploads are not proved by the browser fixtures.

## PrimeMotive US reconciliation — committed 2026-11-05
Data-only operational repair; application code/builds were not changed.
JavaScript syntax checks passed for the operational helpers. A production
rollback trial performed 71,911 mirror updates and 18,624 inserts and verified
all 90,535 source rows with zero mismatches before rolling back. A separate
publication-link rollback trial verified 5,222 links with zero mismatches.
The combined production transaction then committed and an independent
post-commit pass again verified all 90,535 mirror rows and 5,222 links with
zero mismatches. The verified population has 50,935 active, 37,940 out of stock,
1,660 ended, and 62,221 advertised available units. Backend health was HTTP 200.
After historical credentials returned 401, the user explicitly approved a
reader-password reset. It committed with an audit record and protected server
credential/rollback files. Authenticated checks then passed with HTTP 200 for
representative active (qty 1), out-of-stock (qty 0), and ended (qty 0) records,
and for the dedicated PrimeMotive feed. Item IDs, statuses, and quantities were
asserted; syntax checks passed for the reset and verification helpers. Roles
and permissions were unchanged. Consumer applications still need the rotated
credential before their own authentication is considered verified. See the
[production record](PRIMEMOTIVE_US_RECONCILIATION_2026-11-05.md) for scope,
backup integrity, source/live-report checksums, and remaining gates.
## MotoArk lifecycle — deployed 2026-11-03
Backend `npm run build` passes. Targeted, non-mutating ESLint on
`src/integrations/motoark/*.ts` and the two new migrations passes with
**0 errors / 0 warnings**. The normal backend lint command uses `--fix` across
the repository, so it was not used to rewrite unrelated files.
The complete focused run passed **42 tests across 4 suites**:
```bash
cd backend
# Set STOCK_IT_DATABASE_URL to an isolated disposable PostgreSQL >= 15 database.
npm test -- --runInBand --runTestsByPath \
  src/integrations/motoark/motoark.int.spec.ts \
  src/orders/orders.service.spec.ts \
  src/published-listings/published-listings.spec.ts \
  src/published-listings/published-listings-response.util.spec.ts
```
The database suite covers atomic duplicate delivery and payload conflict,
last-unit contention, partial shipments/cancellations, quarantine/inspection/
disposal, refund without restock, tracked unit identity, crash rollback and
retry, permission/store/organization boundaries, late-commit sequence cursors,
outbound organization isolation/order, successful absolute quantity pushes,
and down/up migration roundtrips in a rollback transaction. Existing
published-listing offer-resolution coverage was corrected to use an Inventory
API fixture and the current constructor dependencies. Two final snapshot UUID
cursor regression cases are also included in that suite.
Final follow-up verification passed **9 selected cases** (35 others skipped by
the explicit name filter): the revised partial-lifecycle projection, outbound
claims, acknowledged channel quantity changes, migration roundtrip, signatures,
UUID snapshot cursors, and protected generic order actions. The first attempt
at this follow-up lost its idle SSH tunnel; reconnecting with keep-alives and
rerunning passed. This was isolated test connectivity, not a production or
application database failure.
A candidate derived from `realtrackapp-backend:ebay-revise-00aad7cd` first
started against a **schema-only** production copy plus separate test
Redis/PostgreSQL, without production application data or credentials. Both
migrations applied there. Its app-module merge preserves production's
PartsSearch module, absent from this checkout.
The reviewed image was deployed to production on 2026-11-03 after a full
pre-migration backup passed archive validation. The backend and public health
checks returned 200; unauthenticated MotoArk and legacy sales routes returned
401. An existing external-reader account verified the snapshot and committed
change feed, unmapped quantity behavior, signed synthetic event handling,
deduplication, payload conflict, invalid signature, strict validation, status
lookup, and fixture-only legacy receipt. The external reader had no physical
return permissions. The test synthetic lifecycle event created zero orders and
zero stock movements. The lifecycle key is separate from the preserved legacy
key; marketplace stock pushing remains off. See the
[contract and production release record](../operations/MOTOARK_RELEASE_2026-11-02.md).
> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **Note**: Lightweight stub. Omni Core has sparse automated test coverage.
> For the definition of done, see this file's checklist.

---

## Current Test Coverage

- **Backend**: 9 `.spec.ts` files (Jest), 1 e2e test (`test:e2e`)
- **Frontend**: No meaningful tests
- **Framework**: Jest (backend only)

## Fashion catalogue import recovery (2026-10-22)

The focused worker recovery checks pass with `cd backend; npm run build` and `npm test -- --runInBand --runTestsByPath src/catalog-import/processors/csv-import.processor.spec.ts src/catalog-import/catalog-import.service.spec.ts src/storage/image-processor.service.spec.ts` (3 suites, 7 tests). They cover retained source image URLs, transient versus permanent image failures, and transient database retry classification, the default image pixel ceiling, and the Fashion-only 25 MP override that preserves the 2048-pixel WebP output. The production import remains an operational follow-up; permanent source URL failures remain row-level warnings.

## Running Tests

Fashion catalogue import (2026-10-20): backend and frontend production builds passed. `cd backend` then `npm test -- --runInBand --runTestsByPath src/catalog-import/catalog-import.service.spec.ts src/verticals/fashion-catalog-export.spec.ts src/verticals/fashion.config.spec.ts src/verticals/fashion-measurements.spec.ts` — 27 tests passed. This covers source-specific column mapping (including category ID/name), item-specific mapping, unit-unspecified measurement preservation, custom specifics publishing, and existing Fashion validation/chart behavior. No production import or S3 write was run.

Fashion bulk marketplace selection (2026-11-07). Frontend and backend builds passed. The focused `ebay-multi-store-listing.service.spec.ts` suite passed all eight tests, including enabled marketplace selection and rejection of disabled marketplaces before queueing. A local browser fixture verified that switching a Germany-default seller to the US loads the US shipping policy and submits the US marketplace and policy together. Frontend lint lacks an ESLint configuration, and the backend lint run reported formatting and typing findings in the touched files.

Fashion inventory location (2026-11-07). The inventory client, inventory-location utility, publisher and bulk publisher suites passed all 79 tests. Coverage confirms that Fashion uses the enabled location requested by the target marketplace, blocks missing or disabled keys, and sends Dallas, TX 75234 as the item location when publishing through the Trading API. eBay confirmed the new `US_Dallas_75234` warehouse on the intended production account. The RealTrack mapping depends on deployment of the location fix.

Catalog import recovery (2026-10-22): `cd backend` then `npm run build` passed; `npm test -- --runInBand --runTestsByPath src/catalog-import/processors/csv-import.processor.spec.ts src/catalog-import/catalog-import.service.spec.ts` — 5 tests passed. The focused checks cover preserving original image URLs for resume, transient versus permanent image failures, and transient database retry classification. The production worker changes remain local pending deployment; this verification made no production writes.

Add Part recovery regressions (2026-10-13): `cd backend` then `npm test -- --runInBand --testPathPatterns="part-photo-evidence|add-part-recovery"` — six tests passed. Backend build and isolated production-image checks also passed. These cover bounded default AI requests, preservation of provider errors, billing classification, complete OCR token matching, and alternate printed identifiers. Production-image checks additionally cover explicit ECU prompt parsing and high image detail; see [recovery record](ADD_PART_RECOVERY_2026-10-13.md).

```bash
# Backend
cd backend
npm run test           # Unit tests (Jest)
npm run test:e2e       # E2E tests

# Multi-user concurrency regression (subset)
npm test -- --testPathPatterns="job-visibility|scheduler-leader|heavy-job-limiter|listings.concurrency"

# B&I catalog UI with mocked authenticated API responses
# Requires a running frontend (default http://127.0.0.1:3923). Optional:
#   CATALOG_UI_URL
#   CATALOG_PLAYWRIGHT_PATH  (default .codex-fashion-test-runtime/node_modules/playwright/index.mjs)
#   CATALOG_CHROME_PATH      (default Google Chrome on Windows)
# Last local run 2026-09-13: PASS (mocked API only; not live backend integration)
node scripts/test-business-industrial-catalog-ui.mjs

# Load baseline (requires k6 — see docs/load/README.md)
k6 run scripts/load/k6-baseline.mjs
```

## Where Tests Are Needed (Priority)

From [/docs/context/NEXT_STEPS.md](../context/NEXT_STEPS.md):

1. **Auth/RBAC** — login, permission enforcement, 403 on unauthorized routes
2. **eBay publish/sync** — OAuth flow, token refresh, publish success/failure
3. **Catalog import** — CSV parsing, validation, processing
4. **Frontend route protection** — ProtectedRoute permission gating

## Test Patterns

### Backend Unit Test (Jest + NestJS Testing)

```typescript
// backend/src/auth/auth.service.spec.ts
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AuthService, ...]
    }).compile();
    service = module.get(AuthService);
  });

  it('should validate user credentials', async () => {
    // ...
  });
});
```

### E2E Test

```typescript
// backend/test/app.e2e-spec.ts
describe('Auth (e2e)', () => {
  it('/api/auth/login (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
  });
});
```

---

## Definition of Done (Task Completion)

Before completing any meaningful task:

- [ ] Code compiles / builds where applicable
- [ ] Tests/lint/build run where applicable
- [ ] Relevant docs updated
- [ ] API docs updated if routes changed
- [ ] DB docs updated if schema changed
- [ ] Auth/RBAC docs updated if permissions changed
- [ ] Product docs updated if behavior changed
- [ ] CHANGELOG.md updated
- [ ] New risks/gaps documented

---

*Created: 2026-06-06 (stub).*
