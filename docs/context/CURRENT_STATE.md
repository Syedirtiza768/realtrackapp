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

**2026-07-15** — eBay listing fidelity hardening:
- Root-caused title and business-policy mismatches on pipelines `1c3a0f2a`, `5d5c2413`, and `6e30444a`: publish-time title recomposition replaced every reviewed title, durable targets lost the exact source listing identity, row policy names were ignored in favor of target-account defaults, and concurrent publishes wrote their resolved row policies back as new defaults.
- Publish now preserves the exact listing row and stored title, resolves each named shipping/payment/return profile independently for every target account, refreshes stale policy caches, blocks absent/incompatible named policies, and leaves marketplace defaults unchanged.
- Production audit found two Primemotive channels whose assigned source shipping policies do not exist on that seller account. Similar policies have different charges, so exact Primemotive equivalents must be created before those two listings can be repaired safely; deployment and live repair require the operational confirmation recorded in the task handoff.

**2026-07-12** — High-volume catalog publishing:
- Catalog search/page size supports 500 rows.
- Bulk eBay publish submits one durable BullMQ job for up to 500 listings and 10 stores, with per-target persistence, concurrency 5, transient retries, and progress polling.
- Organization quota is 5,000 listing/store publish targets per UTC day; normal application throttles remain unchanged while job-progress polling has scoped higher limits.

**2026-07-11** — Pipeline `1c3a0f2a` two-store publish hardening:
- Repaired all 903 listing and catalog rows from non-Motors/non-leaf categories to verified eBay Motors leaf `9886` (`Other Car & Truck Parts & Accessories`) and published the complete pipeline to BLACKLINEAUTOPARTS and Primemotive.
- Catalog bulk publishing now submits five listings per authenticated backend request, retries only transiently failed store/listing pairs, and uses throttle-aware exponential backoff.
- Publish progress is keyed by job ID so targeted retries start with clean state and report accurate per-store results.

**2026-07-10** — eBay error 25005 fix (invalid category IDs):
- Root cause: `ebay_category_mappings` table empty (seed migration `1709769600000-MotorsIntelligenceSystem` never run on prod) + `isMotorsCategory()` returned `true` for unmapped categories → AI taxonomy suggestions returned non-Motors categories (31373 "Lincoln Memorial", 2518 "Other Educational Toys", 11774 "Other Welding Equipment", 34 others) → stored in `listing_records.categoryId` → eBay rejected with errorId 25005.
- Fix: (1) `isMotorsCategory()` in `enterprise-listing-intelligence.service.ts` now returns `false` for unmapped categories (was `true`), forcing taxonomy re-resolution. (2) Seeded `ebay_category_mappings` with 15 known Motors categories. (3) The emergency fallback was initially `6000`, but production follow-up on 2026-07-11 proved that eBay rejects this root as non-leaf; the emergency fallback is now leaf `9886` (`Other Car & Truck Parts & Accessories`). (4) Affected records must be repaired in both `listing_records` and `catalog_products` before retrying publish.
- See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) R16.

**2026-07-01 (continued)** — Inventory pipeline hardening:
- Auto-enrich now triggers on **2+ images only** (vision lookup runs inside the job; no longer requires part#/brand upfront).
- `PUT /inventory/:id/editor` persists marketplace version edits to sibling listing records + `catalog_products.optimization_payload`.
- Publish flow wires UI policy selections → `listing_store_overrides` → `ListingBuilderService` at publish time.
- Inventory list + detail show per-store eBay listing status (store name, offer ID, live price/qty) from `ebay_listing_channels`.

**2026-07-01** — Phase 1 of Inventory Auto-Enrich pipeline: created `InventoryAutoTriggerService` which detects when a listing reaches 2+ images with part number + brand and automatically enqueues a BullMQ `auto-enrich` job. The job runs vision lookup + pipeline enrichment + US/AU/DE optimization end-to-end. Added `enrichmentStatus` (idle/ready/enriching/completed/failed) to the inventory workbench list + detail endpoints, an enrichment status polling endpoint, and a frontend badge column with animated pulse for in-progress states.

Phase 2: Created the unified multi-marketplace editor at `/inventory/:id/edit` with 3 marketplace tabs (US/AU/DE), editable fields (title, description, price, quantity, condition), store selector scoped to user-accessible eBay stores, and cascading payment/return/fulfillment policy dropdowns. The editor is served by `InventoryEditorService` (aggregates listing siblings + catalog product + accessible stores with policies). Frontend components: `InventoryListingEditor` (main page), `MarketplaceVersionEditor` (tab editor), `StorePolicySelector` (store+policy dropdowns).

Phase 3: Added direct publish from the editor. New `InventoryPublishService` auto-creates a CatalogProduct from the listing (if none exists) and calls the existing multi-store publish flow (`EbayMultiStoreListingService.createPublishJob()`). New `POST /inventory/:id/publish` endpoint with `ebay.publish` permission gate. Frontend `PublishActionBar` shows target marketplaces with per-target progress tracking.

Phase 4: Catalog dedup and polish — the catalog grid now groups listing records by SKU (one card per part) with colored marketplace badges (US/AU/DE) in grid and list views. The existing `/catalog/products/:id` detail page already shows multi-marketplace tabs. Backend + frontend compile clean.

All 4 phases of the Inventory Auto-Enrich → Multi-Marketplace Editor → Publish pipeline are complete.

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
