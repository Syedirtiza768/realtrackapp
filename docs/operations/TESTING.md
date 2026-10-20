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

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **Note**: Lightweight stub. Omni Core has sparse automated test coverage.
> For the definition of done, see this file's checklist.

---

## Current Test Coverage

- **Backend**: 9 `.spec.ts` files (Jest), 1 e2e test (`test:e2e`)
- **Frontend**: No meaningful tests
- **Framework**: Jest (backend only)

## Running Tests

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
