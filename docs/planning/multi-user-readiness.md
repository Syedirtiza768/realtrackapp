# Multi-User Concurrency Readiness Plan

> Status tracker for production multi-user hardening. See audit in agent session 2026-06-17.

## Deployment model

**Model A — Single tenant** (one business, shared catalog). Multi-tenant (`organizationId` enforcement) deferred until Model B is required.

## Phase 0 — Blockers

| ID | Task | Status |
|----|------|--------|
| P0.1 | Tenancy decision documented | Done (Model A) |
| P0.2 | Gate public registration (`ALLOW_PUBLIC_REGISTRATION`) | Done |
| P0.3 | Remove JWT debug logging | Done |
| P0.4 | WebSocket JWT verification | Done (backend); frontend client must pass `auth.token` when Socket.IO is wired |
| P0.5 | Channel connection scoping (`@CurrentUser`) | Done |
| P0.6 | JWT TTL default 4h (`JWT_EXPIRY_SECONDS`) | Done; revocation/blacklist still open (R9) |

## Phase 1 — Concurrency correctness

| ID | Task | Status |
|----|------|--------|
| P1.1 | Listing SKU unique index + create race fix | Done (sequence `sku_seq` — migration `1785200000000`) |
| P1.2 | Optimistic locking on PATCH status / bulk | Done |
| P1.3 | `createdBy` on all job paths | Done |
| P1.4 | Job list scoping by user/role | Done |
| P1.6 | Multi-tenant enforcement | Deferred (Model B) |

## Phase 2 — Scale

| ID | Task | Status |
|----|------|--------|
| P2.1 | PgBouncer + higher `max_connections` / pool tuning | Done (`docker-compose.prod.yml`) |
| P2.2 | Redis 512MB + queue health endpoint | Done (`GET /api/health/queues`, admin) |
| P2.3 | Heavy job concurrency limits | Done (`MAX_CONCURRENT_*`) |
| P2.4 | Job-scoped pipeline uploads | Done (`uploads/pipeline/{jobId}/`) |
| P2.5 | Socket.IO Redis adapter + scheduler leader election | Done |
| P2.6 | Per-user throttling on expensive routes | Done (`UserThrottlerGuard` + `@Throttle`) |
| P2.7 | `docker-compose.prod.yml` | Done |

**Prod compose:** `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`

**Multi-replica:** add `--scale backend=2` (requires shared `uploads` volume or S3 — P2.4 partial for pipeline only).

## Phase 3 — Testing

| ID | Task | Status |
|----|------|--------|
| P3.1 | Concurrency unit tests | Done (`job-visibility`, `scheduler-leader`, `heavy-job-limiter`, `listings.concurrency`) |
| P3.2 | k6 load baseline | Done (`scripts/load/k6-baseline.mjs`, `docs/load/README.md`) |
| P3.3 | Observability | Done (`X-Response-Time-Ms`, `GET /api/health/runtime`, slow-request logging) |

**Run tests:** `cd backend && npm test -- --testPathPatterns="job-visibility|scheduler-leader|heavy-job-limiter|listings.concurrency"`

**Load baseline:** `k6 run scripts/load/k6-baseline.mjs`

## Env vars

| Variable | Default (prod/Docker) | Purpose |
|----------|----------------------|---------|
| `ALLOW_PUBLIC_REGISTRATION` | `false` | Allow `POST /api/auth/register` |
| `JWT_EXPIRY_SECONDS` | `14400` | Access token lifetime |
| `REDIS_SOCKET_ADAPTER` | `true` in prod overlay | Socket.IO Redis pub/sub across replicas |
| `SCHEDULER_LEADER_ENABLED` | `true` | Only one instance runs `@Cron` producers |
| `MAX_CONCURRENT_PIPELINE_JOBS` | `2` | Cap active pipeline jobs |
| `MAX_CONCURRENT_CATALOG_IMPORTS` | `2` | Cap active catalog imports |
| `DB_POOL_MAX` | `25` in prod overlay | TypeORM pool per backend instance |
| `SLOW_REQUEST_MS` | `2000` | Log warning when request exceeds threshold |
