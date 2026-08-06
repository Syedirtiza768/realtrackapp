# Backend

**Last reviewed:** 2026-08-06

NestJS + TypeORM + PostgreSQL + Redis/BullMQ API. Lives at `backend/` (its own
`package.json`, own `node_modules`, own `tsconfig`).

## Stack
- NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- TypeORM 0.3 + PostgreSQL (`pg`)
- Redis + BullMQ for background jobs, `@socket.io/redis-adapter` for cross-replica
  WebSocket rooms
- `@nestjs/passport` + `passport-jwt` for auth
- `@aws-sdk/client-s3` for image storage
- `openai` for AI enrichment (vision + text)
- `sharp` for image processing
- `@shopify/shopify-api` present in dependencies — see Open questions below

## Modules (`backend/src/*`)
Top-level module directories: `auth`, `automation`, `catalog-import`, `channels`,
`client-settings`, `dashboard`, `fitment`, `health`, `ingestion`, `integrations`,
`inventory`, `listing-optimization`, `listings`, `motors-intelligence`,
`notifications`, `orders`, `pricing-intelligence`, `published-listings`, `rbac`,
`settings`, `storage`, `teams`, `templates` — plus `common/` (shared providers) and
`migrations/`. [[../context/CURRENT_STATE|CURRENT_STATE.md]] counts this as 23
modules / 82 entities / 27 migrations / 14 BullMQ queues.

*(Module responsibilities beyond the name are TODO here — see the deep-dive docs
below, which already describe several of them in detail.)*

## Commands
```bash
cd backend
npm run start:dev          # watch mode
npm run migration:generate # generate from entity diff
npm run migration:run      # apply pending
npm run migration:show     # status
npm run test                # jest unit specs
npm run test:e2e
```

`backend/scripts/` holds operational one-off scripts (audits, token probes, S3
smoke tests) — distinct from the much larger, messier `scripts/` at the repo root,
which is mostly ad-hoc pipeline/import/debug tooling accumulated over time.

## Risky areas (see also [[../../AGENTS|AGENTS.md]])
- `backend/src/app.module.ts` — global guard order, DB/Redis/queue config
- `data-source.ts` + migrations — production runs migrations on boot;
  `DB_SYNCHRONIZE` must stay off
- `backend/src/rbac/permission-registry.ts` — source of truth for RBAC
- `backend/src/integrations/` (and `channels/ebay/`) — OAuth/token handling against
  the live eBay API
- BullMQ processors + scheduler — concurrency/idempotency
- `feature-flag` and `export-rule` controllers double-declare the `api` prefix →
  routes resolve at `/api/api/...` (confirmed bug, see
  [[../context/CURRENT_STATE|CURRENT_STATE.md]] "What Is Broken")

## Deep dives (pre-existing, more detail than this note)
- [[../architecture/ARCHITECTURE|Architecture overview]] (Jul 12) — prefer this over
  the older [[../architecture/overview|architecture/overview.md]] (Jun 6)
- [[../backend/MODULE_MAP|Module map]]
- [[../backend/SERVICES_AND_CONTROLLERS|Services and controllers]]
- [[../backend/BACKGROUND_JOBS|Background jobs / BullMQ queues]]
- [[../backend/DATABASE_MODELS|Database models]] — see also [[database-and-jobs]]
- [[../architecture/AUTH_RBAC|Auth & RBAC]] (Jul 13, more recent than the
  lower-cased [[../architecture/auth-rbac|auth-rbac.md]] from Jun 6) and
  [[../RBAC_AND_SECURITY|RBAC_AND_SECURITY.md]]

## Open questions / TODO
- `@shopify/shopify-api` is a backend dependency but
  [[../context/CURRENT_STATE|CURRENT_STATE.md]] lists Shopify/Amazon/Walmart as
  "scaffolding only" — not verified how far that integration actually goes.
- Several docs pairs cover the same ground written at different times (e.g.
  `docs/architecture/api-map.md` vs `docs/architecture/API_CONTRACTS.md`,
  `docs/RBAC.md` vs `docs/architecture/AUTH_RBAC.md`). Not reconciled as part of
  this setup pass — when you touch one of these areas, prefer the most recently
  modified file and consider merging/retiring the stale one.
- Backend test coverage: 24 unit specs, 0 e2e run in CI (per
  [[../context/CURRENT_STATE|CURRENT_STATE.md]] "What Is Broken") — not
  independently re-verified here.
