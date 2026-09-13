# Current State

**2026-09-13 (deployed to `app.omnicoreholding.com`)** — The B&I
catalog follows the Auto Parts table-first catalog interface and reads its
filters from fields actually populated in production. Facets include brand,
eBay category, condition (label when ID is null), review/validation status,
stock, and populated B&I attributes while omitting automotive and empty legacy
facets. Category/condition facet `OR` predicates are fully parenthesized so they
cannot escape organization/vertical scope. Results show manufacturer/brand,
model, category family, condition, image count, created date, assignment,
validation, and publishing state. Quick view hydrates the canonical product,
shows every stored image with thumbnail/lightbox navigation, and supports image
ordering/upload. Single publish loads the selected dedicated store's policies
and inventory location, passes those overrides through validation and the
publish worker, and shows blockers/warnings; bulk publish uses each selected
store's defaults. Production verification on 2026-09-13 confirmed healthy
backend/database checks, HTTP 200 catalog route, scoped facets (77 B&I rows),
and a logged-in catalog UI with populated filters plus a 12-image quick view.

**2026-09-13** — Shared catalog filters now use loading-safe, searchable checkbox
facets with collapsed secondary groups; category facet selections match the
server's ID filter, imported-to dates include the chosen day, and partial eBay
publish jobs stop polling while exposing target errors. The shared quick view
now has the Auto Parts drag/keyboard image ordering pattern with an explicit
primary image and deduplicated upload batches. These changes are inherited by
all verticals using CatalogWorkspace.

**2026-09-12** — Shared Fashion and Business & Industrial catalog workspaces
now carry the active organization through search, facets, suggestions, edits,
and exports. Catalog publish controls require approval before enqueueing the
existing durable eBay publish job; production B&I rows remain review-gated.
The Auto Parts sidebar Catalog link also resolves to the canonical
`/auto-parts/catalog` route.

> **Source**: Moved from `docs/handover/current-state.md` (2026-05-29).
> This file is a snapshot; for live state use `git log` and run the app.

**2026-08-30** — Pipeline Image Drive matching now runs for every bulk pipeline listing with a manufacturer or OEM part number. It treats only HTTP(S) values as images, replaces warehouse/bin placeholders, prepends matched Image Drive CDN URLs, preserves valid source URLs, updates both `listing_records.itemPhotoUrl` and `catalog_products.image_urls`, and records match/link counts in job `stageDetails.imageDrive`. Image Drive folder/file thumbnails now return browser-safe CDN URLs and raw thumbnail displays use the backend image proxy.

## Overall Status

**Active Development** — Omni Core is a substantial, actively developed full-stack platform (NestJS + React + PostgreSQL + Redis/BullMQ) focused on **eBay** automotive-parts listing, catalog import, AI enrichment, fitment, inventory, orders, and multi-store management. The architecture is mature (23 backend modules, 82 entities, 27 migrations, 14 BullMQ queues, RBAC with 8 roles / 73 permissions). Maturity of *individual features* varies — see [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md).

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
- **Listing editor** with AI assistance, revision history. Catalog inventory price/qty edits now sync to `catalog_products` and US/AU/DE sibling `listing_records` (not only the opened row). SKU renames from inventory/catalog detail modals update `customLabelSku`, linked `catalog_products.sku`, and siblings (collision-checked). Published-listing price revise resolves Inventory `offerId` when Trading sync left it null.
- **Catalog import** (CSV/bulk, BullMQ processing, motors filters)
- **eBay multi-store** (OAuth, sync, publish, multi-account). Inventory location defaults are **Dubai / `AE_Dubai`** (not Houston/`US_77001`); policy sync prefers AE warehouse keys. Before an offer is created, publish now verifies the configured merchant location against live eBay locations, ignores disabled and non-UAE keys, selects or provisions an enabled UAE location, and caches the verification briefly for bulk jobs. Repaired marketplace defaults are persisted; the source location fix and UAE-only hardening were deployed and verified in production on 2026-09-03. Publish fails closed when eBay cannot verify or provision a UAE location. Publish sanitizes item-specific values to eBay's 65-char aspect limit (fixes Type-too-long rejects on long OEM descriptions). eBay Motors publishing now rejects no unverified parent category: it resolves a cached/live leaf and persists the known leaf fallback `9886` when taxonomy is unavailable. Legacy rows with deterministic part keywords are corrected at the final publish boundary; coolant hoses resolve to live car leaf `33601` rather than motorcycle leaf `177983`. Pipeline MVL fitment is **donor-year scoped** (±5/±8) and refuses full make/model dumps when year is missing. Publish sends only **MVL-valid** compatibility rows (`needs_review`/`rejected` omitted; empty fitment still allowed). Title/make-model parsing skips junk tokens and maps Mercedes series codes (`C350`→`C-Class`) so optimizers cannot lock in corrupted models like `170`. Pipeline / enterprise US-AU titles use Gemini 3.1 Flash Lite **only** for Position + Part Name slots; the rest of the house title structure stays deterministic.
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
- **Branding** — Omni Core is now consistent across the user-facing shell and login; `listingpro` remains the internal database identifier.

## Latest Session Summary

**2026-08-10** — Published-listings sync prune timeout fixed (Blackline):
- Every Blackline Auto Parts sync since 2026-08-07 **failed at the very end** with `canceling statement due to statement timeout` — the post-upsert prune (`markUnseenActiveAsEnded`) `find()` used only `idx_epl_account` → a lossy bitmap heap scan over the 1.5GB / 78k-block heap (150k active rows) took ~58s, exceeding the 30s pool `statement_timeout`. The 124k-row upsert loop finished first, so the mirror partially refreshed but the sync log showed `failed` and the watermark never advanced.
- **Fix:** (1) new partial index `idx_epl_active_acct_mp_item (ebay_account_id, marketplace_id, ebay_item_id) WHERE listing_status = 'active'` (migration `1790000000000`); (2) prune rewritten to index-only-scan active `ebay_item_id`s + batch-UPDATE unseen rows by `ebay_item_id` via `uq_epl_account_item`, in a txn with `SET LOCAL statement_timeout = 300s` + `work_mem = 64MB`; (3) one-off prod `VACUUM (ANALYZE, PARALLEL 0)` reclaimed 86,917 dead tuples. Files: `backend/src/published-listings/services/published-listings-sync.service.ts`, `backend/src/migrations/1790000000000-PublishedListingsActiveAcctMpItemIndex.ts`. See [docs/decisions.md](../decisions.md) → 2026-08-10.
- **Before re-trigger:** Blackline mirror = 150,349 active / 7,249 ended / 9,614 out_of_stock; 123,842 active rows refreshed within 1 day (the Aug 9 partial run). Last successful full sync watermark = 2026-08-07 07:40 UTC.

**2026-07-23** — PartsBazar360 English list backfill running on prod:
- Script `scripts/backfill-published-listings-english.cjs` (Browse US) converting EU-host `listing_url` rows to English title + `ebay.com` URL.
- Order: SalvageA (~11k) then Blackline (~40k); ~300ms/row. Log: container `/tmp/english-backfill.log`. Resume-safe.
- Detail on-demand enrich already rewrites locale; this backfill makes **list** English without per-item waits.

**2026-07-23** — PartsBazar360 published-listings ops + watermark root cause:
- Production Blackline/SalvageA mirrors were **not empty** (83,986 / 24,899 active rows) but reader API returned `total: 0` because `lastSuccessfulSyncAt` was stamped ahead of every listing by **policy sync** (shared watermark field).
- Rolled watermarks back → reader totals restored: Blackline **83,986**, SalvageA **24,899**, default **108,885**.
- Code: stop non-Trading writers from touching `lastSuccessfulSyncAt`; hard-gate self-heals on watermark drift; optional `PUBLISHED_LISTINGS_SYNC_DISABLED`.
- Ops: Trading API usage limit exceeded — published-listings cron reduced to weekly (`0 3 * * 0`) until limits recover. New reader endpoints / enrichment payload still need image rebuild+deploy.
- Enrichment fill still thin on prod (description/specifics ~0%; multi-image ~500/150) until GetItem enrich runs after deploy + rate-limit recovery.
- **Follow-up:** bounded public `listingUrl` scrape enrich (`PUBLISHED_LISTINGS_SCRAPE_ENRICH`) + on-demand detail enrich (`PUBLISHED_LISTINGS_ON_DEMAND_ENRICH`) + skip Trading enrich flag — Browse/scrape fill thin payloads without burning GetItem quota.

**2026-07-23** — PartsBazar360 published-listings API contract:
- Reader discovery: `GET /api/published-listings/stores` + `GET /api/published-listings/sync-status` (works with `published_listings.view` only).
- Detail enrichment fields: `descriptionHtml`/`descriptionText`, large ordered `imageUrls`/`images[]`, `brand`/`mpn`/`oeNumbers`, `salvageDetails`.
- Trading GetItem now persists description + item specifics; enrich budget default 500/sync; health flags `missing_description` + `sync_stale`.
- Ops still: confirm Blackline + SalvageA full Trading sync + tokens after deploy (empty mirrors show as `empty_active_mirror` on sync-status).

**2026-07-22** — Published-listings reader feed restored on production:
- Default `GET /api/published-listings` had dropped to total `0` because `lastSuccessfulSyncAt` was ahead of almost every row’s `lastSyncedAt` (hard-gate).
- Rolled watermarks back to `MIN(active last_synced_at)` per active eBay account; default Blackline+Salvage feed returned ~108,885 again.
- Code: targeted `listingIds` syncs no longer advance the live sync watermark.

**2026-07-22** — Soft-delete + donor re-import contract locked in:
- Soft-delete hides that listing instance; it stays deleted.
- Same donor re-upload with no active SKU creates a **new** listing row; pipeline never recovers soft-deleted rows.
- Routing helper + regression tests: `pipeline-listing-routing.util.ts`.

**2026-07-22** — Manual title edits no longer revert after save:
- Root cause: `CatalogProductService.syncToListingRecord` always copied `catalog_products.title` onto every matching listing on *any* catalog PATCH (brand, images, country, etc.). Editors saved corrected titles only to `listing_records`, so the next shared-field save resurrected the stale catalog title (and could also fail the listing PUT on a bumped `@VersionColumn`).
- Fix: sync only DTO-present fields via `listingRepo.update` (no version bump); inventory/catalog detail editors also write title to the catalog product when the title changes.

**2026-07-15** — eBay listing fidelity hardening:
- Root-caused title and business-policy mismatches on pipelines `1c3a0f2a`, `5d5c2413`, and `6e30444a`: publish-time title recomposition replaced every reviewed title, durable targets lost the exact source listing identity, row policy names were ignored in favor of target-account defaults, and concurrent publishes wrote their resolved row policies back as new defaults.
- Publish now preserves the exact listing row and stored title, resolves each named shipping/payment/return profile independently for every target account, refreshes stale policy caches, blocks absent/incompatible named policies, and leaves marketplace defaults unchanged.
- Production remediation created the two exact missing Primemotive fulfillment policies, deployed the fix, and republished all 1,960 affected BLACKLINEAUTOPARTS/Primemotive channels. Transient eBay revise/availability failures now retry, and an audit-discovered zero-stock coercion bug was fixed so quantity `0` remains zero.
- Complete eBay Inventory API readback found every affected inventory item and offer. Titles, categories, prices, quantities, and fulfillment/payment/return policy IDs now match Omni Core; named-profile coverage is complete, marketplace defaults were not mutated, and the final mismatch count is zero.
- Pipeline `52292964-b8c5-4443-a076-088ed292a5a1` exposed a separate part-identity issue: generic types such as `Part`, `Not Specified`, `Miscellaneous`, and `Automotive` were allowed to keep AI/taxonomy categories like Fuel Injectors, ECUs, Hood Panels, and Liftgates. Added script and backend guards so generic identities fall back to verified leaf `9886` unless a trusted keyword confirms the part family; repaired the production batch across `listing_records` and `catalog_products`, with uncertain rows marked for manual review.

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

**2026-07-20** — Pipeline now skips Excel-hidden rows on GridX/XLSX upload and enrichment (`sheetToVisibleAoa` + `ebay-enrichment-pipeline.mjs`). Soft-deleted / Hide Rows content is no longer imported. Bulk `propagateSourceImages` is per-SKU only. Job `1d561867` (VW Jetta) cleaned: 323 hidden Bentley listings soft-deleted; Bentley catalog restored from prior Bentley-branded listings.

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

## Shared catalog parity implementation (2026-09-12)

Implemented shared Fashion and Business & Industrial catalog workspaces and
canonical routes. The server now provides paginated search, suggestions,
facets, safe publication summaries, detail projection, inline edits, bulk
team/policy/delete actions, and server-side CSV export from catalog_products.
Frontend state is URL/session-persistent and uses debounced suggestions,
responsive facets, consistent tables, quick view image management, and durable
publish progress. Fashion bulk publish now uses the shared multi-store job path.
Focused catalog authorization tests pass. The frontend production build passes;
the backend build remains blocked by pre-existing TypeScript errors in
`backend/src/scripts/backfill-brand-images.ts`; the repository
root lint command still fails because ESLint 9 finds no root eslint.config file,
and the backend repository-wide lint baseline contains unrelated existing errors.
No migration was added because the implementation uses existing catalog and audit
columns; shared soft-delete is the existing vertical_validation_status=deleted
lifecycle value.

## Immediate Next Step

See [NEXT_STEPS.md](NEXT_STEPS.md) for prioritized work items. Top priority: verify and fix the double `/api` prefix controllers, then raise test coverage on auth/RBAC and eBay paths.

---

*Snapshot date: 2026-06-11. Reorganized: 2026-06-06.*
