# Current State

> **Source**: Moved from `docs/handover/current-state.md` (2026-05-29).
> This file is a snapshot; for live state use `git log` and run the app.

## Overall Status

**Active Development** — RealTrackApp is a substantial, actively developed full-stack platform (NestJS + React + PostgreSQL + Redis/BullMQ) focused on **eBay** automotive-parts listing, catalog import, AI enrichment, fitment, inventory, orders, and multi-store management. The architecture is mature (23 backend modules, 82 entities, 27 migrations, 14 BullMQ queues, RBAC with 8 roles / 73 permissions). Maturity of *individual features* varies — see [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md).

## What Exists Now

- Full auth + RBAC system with JWT, global guards, permission registry
- 23 backend NestJS modules covering all core domains
- React frontend with route-based permission gating
- Docker Compose full-stack deployment with healthchecks
- eBay multi-account OAuth and multi-store integration
- Catalog CSV import with BullMQ processing
- AI enrichment pipeline (OpenAI vision + text)
- Motors Intelligence attribute extraction and review
- Inventory ledger with allocation tracking
- Order import and management
- Notifications via WebSocket (Socket.IO)
- Audit trail logging

## What Works

- **Auth + RBAC** (login, register, permissions, roles, registry-driven)
- **Dashboard** with KPI aggregation
- **Listing editor** with AI assistance, revision history
- **Catalog import** (CSV/bulk, BullMQ processing, motors filters)
- **eBay multi-store** (OAuth, sync, publish, multi-account)
- **Inventory management** (ledger, allocations, events)
- **Order import** from eBay
- **Notifications** (in-app + WebSocket)
- **Audit trail**
- **White-label** branding (super_admin only)
- **Templates, settings, pricing rules**

## What Is Planned But Not Built

- Shopify/Amazon/Walmart full marketplace integration (scaffolding only)
- JWT token revocation and refresh rotation
- Frontend tests
- Comprehensive backend test coverage
- Formal acceptance criteria

## What Is Partially Working

- **AI listing generation** — quality unverified
- **Motors Intelligence pipeline** — active but needs verification
- **Ingestion pipeline** — core works, edge cases unverified
- **Forgot password flow** — UI exists, backend reset unverified
- **Feature flags** — backend exists, double-prefix route issue
- **Export rules** — backend exists, double-prefix route issue
- **Channels beyond eBay** — scaffolding only
- **Tenant/org isolation** — inconsistent row-level enforcement
- **eBay token refresh** — works but fragile against live API

## What Is Broken

- **Double `/api` prefix** on two controllers (feature-flags, export-rules) — routes resolve at `/api/api/...`
- **Sparse automated tests** — 24 backend specs (unit only), 0 e2e, 0 frontend tests
- **DB typing issues** — TEXT-typed price/quantity columns partially fixed by migration
- **Missing foreign keys** on some entity relationships
- **Branding inconsistency** — "RealTrackApp" (shell) vs "ListingPro" (login/DB)

## Latest Session Summary

**2026-06-11** — Comprehensive codebase analysis: verified all documentation counts, identified discrepancies (migrations 21→27, entities ~79→82, permissions ~90→73, specs 9→24, e2e 1→0), discovered DEBUG JWT logging security issue, confirmed double `/api` prefix bug, verified SellerPundit integration (19 files), AI routing system (39 files), and listing-optimization pipeline (transitively imported). Created `CURRENT_TRUE_STATE_OF_APPLICATION.md`. Updated all documentation files with corrected counts.

## Current Assumptions

- eBay remains the primary (only fully-developed) marketplace integration
- PostgreSQL 16 + Redis 7 remain the infrastructure stack
- Docker Compose remains the primary deployment method
- The `@Controller('api/...')` double-prefix issue has not been resolved (verify)
- Uncommitted working tree from 2026-05-29 snapshot needs triage (verify with `git status`)

## Immediate Next Step

See [NEXT_STEPS.md](NEXT_STEPS.md) for prioritized work items. Top priority: verify and fix the double `/api` prefix controllers, then raise test coverage on auth/RBAC and eBay paths.

---

*Snapshot date: 2026-06-11. Reorganized: 2026-06-06.*
