# Testing

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
