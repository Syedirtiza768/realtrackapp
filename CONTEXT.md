# CONTEXT — Project Memory

Compact, durable project memory. Read this early; follow links for depth.

## Purpose

RealTrackApp (`listingpro`) is a multi-channel **automotive parts listing &
operations platform**. It ingests product data/images, enriches with AI, manages
vehicle fitment, and publishes/syncs listings to marketplaces (primarily eBay),
with orders, inventory, pricing, dashboards, automation, RBAC, and audit.

## Stack

React 18 + Vite + TS + Tailwind (frontend) · NestJS 11 + TypeORM (backend) ·
PostgreSQL 16 · Redis 7 + BullMQ · Socket.IO · OpenAI · AWS S3 · Docker Compose.

Ports: backend 4191 (`/api`), Vite dev 3911, Docker frontend 8050, pg 5432, redis 6379.

## Architecture at a glance

- 23 backend NestJS modules; ~79 entities; 21 TypeORM migrations; ~16 BullMQ queues.
- Global guard stack: `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`.
- RBAC: 8 roles, ~90 permissions, defined in `backend/src/rbac/permission-registry.ts`.
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
marketplace integration. See [docs/product/features.md](docs/product/features.md)
for per-feature Implemented/Partial/Missing status.

## Priorities (see handover/next-steps)

1. Fix double-`/api` prefix controllers (feature-flags, export-rules).
2. Triage/commit the large uncommitted working tree.
3. Raise test coverage on auth/RBAC and eBay paths.
4. Verify production secrets/config before deploy.

## Key gaps

Sparse tests; client-side-only logout; inconsistent tenant isolation; DB typing/FK
debt (prior audit); branding inconsistency (RealTrackApp vs ListingPro); non-eBay
channels are scaffolding. Details: [docs/product/known-gaps.md](docs/product/known-gaps.md),
[docs/handover/risk-register.md](docs/handover/risk-register.md).

## Conventions

- Schema changes via migrations only (`DB_SYNCHRONIZE=false`).
- New routes are protected by default; register permissions in the registry.
- Secrets in env vars only (see [docs/development/environment-variables.md](docs/development/environment-variables.md)).
- Update docs with every meaningful change (Continuous Documentation Protocol).
