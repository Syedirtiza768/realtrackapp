# CONTEXT — Project Memory

**2026-11-05 production reconciliation:** All 90,535 supplied PrimeMotive US
source listings were reconciled against a current eBay report and independently
verified with zero mismatches. Applied 71,911 mirror updates, 18,624 inserts,
and 5,222 matching inventory publication-link updates. Physical stock and push
policies were not changed. See the [production record](docs/operations/PRIMEMOTIVE_US_RECONCILIATION_2026-11-05.md)
for the verified backup, source boundary, unknown mirror-only records, and
recurring sync completeness gap. The user-approved API reader password reset
completed on November 5; authenticated listing-state and dedicated feed checks
passed with HTTP 200. Consumer applications still need the rotated credential
in their protected configuration before their own access is verified.

**Historical 2026-11-02 candidate (superseded by the 2026-11-03 deployment):** MotoArk lifecycle APIs and stock processing are
implemented locally with atomic deduplication, partial order/return balances,
independent refunds, and ordered quantity feeds. Production inspection found
the active image lacks the earlier Primemotive routes, and a 200-row sample
had no stock mappings. The tested release overlay restores the routes and
preserves production PartsSearch. No production rollout/opening-stock writes
have occurred; see [the contract](docs/architecture/MOTOARK_ORDER_LIFECYCLE.md).

Compact, durable project memory. Read this early; follow links for depth.

## Purpose

Omni Core (`listingpro`) is a multi-channel **automotive parts listing &
operations platform**. It ingests product data/images, enriches with AI, manages
vehicle fitment, and publishes/syncs listings to marketplaces (primarily eBay),
with orders, inventory, pricing, dashboards, automation, RBAC, and audit.

## Stack

React 18 + Vite + TS + Tailwind (frontend) · NestJS 11 + TypeORM (backend) ·
PostgreSQL 16 · Redis 7 + BullMQ · Socket.IO · OpenAI · AWS S3 · Docker Compose.

Ports: backend 4191 (`/api`), Vite dev 3911, Docker frontend 8050, pg 5432, redis 6379.

## Architecture at a glance

- 23 backend NestJS modules; 82 entities (78 unique tables); 27 TypeORM migrations; 14 BullMQ queues.
- Global guard stack: `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`.
- RBAC: 8 roles, 73 permissions, defined in `backend/src/rbac/permission-registry.ts`.
- Frontend: route table in `src/App.tsx`, per-domain API clients in `src/lib/*Api.ts`,
  JWT in `localStorage` (`mk_auth_token`).
- Heavy work runs in BullMQ queues; some jobs scheduled via `@nestjs/schedule`.
- Full map: [docs/architecture/overview.md](docs/architecture/overview.md).

## Modules

auth, rbac, listings (+ v2, generation, export-rules), ingestion (+ pipeline,
image-enrichment, review), catalog-import (+ compliance), fitment,
motors-intelligence, channels (+ stores, ai-enhancements, eBay publish),
integrations/ebay (multi-account/store), inventory, orders, dashboard (+ audit),
pricing-intelligence, settings, client-settings (white-label), automation,
templates, notifications, storage, health, common/{openai,scheduler,feature-flags},
listing-optimization.

## Status

Architecture is mature; feature maturity varies. eBay is the only fully-developed
marketplace integration. See [docs/context/FEATURE_REGISTRY.md](docs/context/FEATURE_REGISTRY.md)
for per-feature Implemented/Partial/Missing status.

## Priorities (see context/NEXT_STEPS)

1. Fix double-`/api` prefix controllers (feature-flags, export-rules).
2. Triage/commit the large uncommitted working tree.
3. Raise test coverage on auth/RBAC and eBay paths.
4. Verify production secrets/config before deploy.

## Key gaps

Sparse tests; client-side-only logout; inconsistent tenant isolation; DB typing/FK
debt (prior audit); legacy internal identifiers remain separate from the Omni Core brand; non-eBay
channels are scaffolding. Details: [docs/context/KNOWN_ISSUES.md](docs/context/KNOWN_ISSUES.md),
[docs/handover/risk-register.md](docs/handover/risk-register.md).

## Conventions

- Schema changes via migrations only (`DB_SYNCHRONIZE=false`).
- New routes are protected by default; register permissions in the registry.
- Secrets in env vars only (see [docs/operations/ENVIRONMENT_VARIABLES.md](docs/operations/ENVIRONMENT_VARIABLES.md)).
- Update docs with every meaningful change (Continuous Documentation Protocol).
