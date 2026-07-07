# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Add an entry under **Unreleased**
for every meaningful change (Continuous Documentation Protocol).

## [Unreleased]

### Fixed
- **Catalog date filters:** "Today" and "Yesterday" under Date Added now map to the correct local calendar day (yesterday previously used today's range). Search uses `importedAt::date` for inclusive day matching.
- **MVL import on Linux Docker:** Password-protected US/UK workbooks now resolve `python3` (with `python` symlink in the backend image) for `decrypt_xlsx.py`. Large US workbooks import in parse chunks (`EBAY_MVL_PARSE_CHUNK_SIZE`, default 5000) to avoid Node heap OOM.
- **Production MVL Docker setup:** `docker-compose.yml` mounts `drive-download-…` as `/app/mvl-data`, sets `EBAY_MVL_*` and `FITMENT_*` env defaults, and defaults `PIPELINE_SKIP_MVL_ON_IMPORT=false`. `PATCH /api/rbac/roles/sidebar-config` was matched by `@Patch(':id')` first, so the body was validated as `UpdateRoleDto` and rejected with "property configs should not exist". Static `sidebar-config` routes are now registered before parameterized `:id` routes.
- **Add Part export template failure:** Parts added via "Add Part" (warehouse intake) only created a `ListingRecord` but no corresponding `CatalogProduct`, causing export templates to fail with "No catalog products found for given IDs". Now creates a catalog product on intake. Backfill script: `scripts/backfill-intake-catalog-products.sql`.
- **Pipeline exit code 1 crash:** `categoryAiMinConfidence` variable was referenced in the AI category classifier setup but never declared, causing `ReferenceError` at line 643 and every pipeline job to exit with code 1. Added the missing `const categoryAiMinConfidence = Number(env.PIPELINE_CATEGORY_AI_MIN_CONFIDENCE)` declaration alongside `categoryAiModel` and `categoryAiBatchSize`.

### Added
- **Pipeline upload provisioning:** Bulk upload requires marketplace (US, UK, AU, DE), eBay store, and shipping/return/payment profiles. Choices persist on `pipeline_jobs` and stamp output rows + catalog import (row values win when present). Store selection filters by marketplace for cross-list anchoring. Queue table shows marketplace and store columns. UK category template is generated alongside US/AU/DE outputs (`output_uk_path`, `GET /api/pipeline/jobs/:id/download/uk`).
- **Settings → Store policies:** New tab on `/settings` lists every connected eBay store with configured/incomplete status, per-store policy sync, and inline default fulfillment/payment/return/location mapping (`StoreDefaultPoliciesTab`, shared `EbayAccountPolicyEditor`). Requires `ebay.view`; saving requires `ebay.manage`.
- **MVL-driven fitment expansion:** Enrichment prompt v4 (`enrichment-v4-mvl-fitment`) removes AI `compatibility[]` output; fitment is expanded deterministically from platform generation + local `ebay_mvl_entries` (`MvlFitmentExpanderService`, `scripts/lib/mvl-fitment-expander.mjs`). Optional interchange micro-call when row count is thin (`FITMENT_AI_INTERCHANGE=auto`). Env: `FITMENT_EXPANSION_MODE` (default `hybrid`), `FITMENT_MIN_MVL_ROWS`, `FITMENT_SIBLING_EXPANSION`, `FITMENT_MVL_REQUIRED`. `ai_run_logs` tracks `fitment_source`, `tokens_saved_estimate`. Migration: `1785600000000-AddFitmentSourceToAiRunLogs`.
- **eBay MVL reference database:** Official Master Vehicle List spreadsheets (US/AU/DE/GB) import into `ebay_mvl_releases` + `ebay_mvl_entries`. `EbayMvlService` validates and cascades Make/Model/Year from PostgreSQL first (Taxonomy API fallback). CLI: `cd backend && npm run mvl:import`. API: `POST /api/fitment/ebay-mvl/import`, `GET /api/fitment/ebay-mvl/status`. Env: `EBAY_MVL_DATA_DIR`, `EBAY_MVL_WORKBOOK_PASSWORD`. Pipeline catalog import auto-validates fitment when local MVL is loaded (`PIPELINE_SKIP_MVL_ON_IMPORT` defaults to off in that case).
- **Catalog inventory summary modal:** Clicking a row title on `/catalog` opens `CatalogInventoryDetailModal` — structured read-first view with inline **Edit Details**, **eBay Store & Policies**, and full **image management** (drag reorder, delete, upload up to 24). Title links to full editor when not editing field details. `teams` and `team_members` tables, RBAC permissions (`teams.view`, `teams.manage`), Settings → Teams admin UI, and team assignment on pipeline upload. Every part in an upload inherits the selected team; catalog search supports `teamIds` filter with membership-scoped access; pipeline queue shows upload ID, team, condition, and uploader.
- **Pipeline page redesign:** Single-page layout matching the operations mockup — bulk upload card (condition + team + drag-drop), rules explainer, and paginated pipeline queue with status filters.
- **Docker migration entrypoint:** Backend container runs pending TypeORM migrations on start when `DB_MIGRATIONS_RUN=true` (uses `DB_MIGRATION_HOST` for direct Postgres, avoiding PgBouncer for DDL).
- **Catalog bulk policy edit:** "Edit Policies" action on selected listings respects the active team filter; server validates team scope via `POST /api/listings/bulk-profiles`.

### Changed
- **Catalog operations redesign:** `/catalog` now uses a table-first layout matching the operations mock — horizontal quick filters (stock, brand, condition, team, shipping, date added), inline bulk action bar, header actions (Refresh, Export, Edit Policies, Add Part), and paginated dense table with Team badges and workflow Status column (Publish / Published / Need Images). Advanced facets moved to a slide-over panel.
- **Catalog search API enrichment:** `GET /api/listings/search` and facets now return `teamId`, `teamName`, `teamColor`, `catalogStatus`, and `shippingProfileName` per row. New query filters: `stockLevel`, `shippingProfiles`, `catalogStatus`, `importedFrom`, `importedTo`. Team facet includes `color`.
- **AI category classifier default:** `PIPELINE_CATEGORY_AI_MODEL` defaults to `google/gemini-2.5-flash` (90% benchmark accuracy on Motors leaf categories). Marketplace-aware prompts and per-tree Taxonomy resolution for AU/DE.

### Added
- **AI category mapping tier:** When eBay Taxonomy quota is exhausted (`PIPELINE_CATEGORY_MODE=auto`), pipeline batches category classification via OpenRouter (`google/gemini-2.5-flash` default), resolves to real eBay IDs via Taxonomy API per marketplace tree, and caches 90 days. Benchmark: `node scripts/model-comparison/category-model-benchmark.mjs`.

### Changed
- **Pipeline output stage reliability (659+ part jobs):** Cap export fitment rows (`PIPELINE_EXPORT_MAX_FITMENT_ROWS=80`, description HTML `PIPELINE_DESC_MAX_FITMENT_ROWS=30`) to avoid multi-hundred-thousand-row XLSX files. Write US/AU/DE templates sequentially with progress sub-stages. Skip redundant marketplace AI backfill when all three regional outputs exist. Skip per-row eBay MVL re-validation on catalog import by default (`PIPELINE_SKIP_MVL_ON_IMPORT=true`). Post-output steps now report sub-stages (`mirror_images`, `catalog_import`, `finalizing`) instead of appearing stuck on Output.
- **Pipeline speed & progress accuracy:** Fixed misleading `output_generation` stage during AU/DE localization and image fetch (now stays on `validation` with `subStage` labels). Default localization mode `copy` AI-translates titles and descriptions for AU/DE; fitment/compatibility data (`_fitments`, `Compatibility`, `fitment_flat`) is built before localization and preserved in all marketplaces. `PIPELINE_FAST_MODE=1` enables rule-only localization, skips validation, and skips post-pipeline marketplace AI backfill.
- **Neutral processing UI (Tier A):** Pipeline job view no longer shows AI token counts or OpenRouter messaging; stale-progress hint and enrichment status panel use generic “processing / content service” language. Inventory enrichment badges and stage labels de-emphasize AI. Removed `Sparkles` icon app-wide (replaced with contextual icons).

### Added
- **ECU vision identification prompt:** Specialised AI vision prompt for ECUs, TCMs, BCMs, and electronic control modules. Extracts hardware numbers, software numbers, OE/OEM numbers, and all visible label text instead of hallucinating vehicle make/model. Auto-detected from part type keywords (ECU, TCM, BCM, Steuergerät, etc.).
- **eBay catalog lookup by MPN in fitment discovery:** When no catalog fitment data exists, searches eBay Browse API for existing listings of the same part number. Extracts category ID, EPID, and Year/Make/Model from item specifics. Applied to both fitment rows and category resolution. Confidence: 0.70.
- **Image reorder and remove:** Drag-and-drop reordering of listing images via `@dnd-kit/sortable`. Remove button on each thumbnail. "Save image order" button updates the pipe-delimited URL string and syncs `image_assets.sort_order` for eBay publish. New `PATCH /inventory/listings/:id/images/reorder` endpoint.

### Fixed
- **Pipeline upload 503:** Upload no longer counts queued `pending` jobs against `MAX_CONCURRENT_PIPELINE_JOBS` (only actively processing stages). Stale jobs with no progress for 6h are auto-failed to free slots. Upload UI now shows the backend error message (e.g. capacity reached) instead of generic "503 Service Unavailable".
 `POST /api/inventory/inline-enrich` enqueues BullMQ `auto-enrich` (no blocking HTTP). `updateListingImages` auto-enqueues at 2+ photos. `POST /api/inventory/listings/:id/retry-enrichment` forces re-run. `enrichmentStage=failed` on errors; `needs_review` when category ID or fitment missing after run.
- **eBay Taxonomy 429 during inline enrich:** Category suggestions retry with exponential backoff; in-memory cache + 800ms spacing between US/AU/DE lookups. Improved category query strings (skip generic `OEM` part type).
- **Inline enrich fitment:** Runs `FitmentDiscoveryService` and writes `catalog_products.fitmentData`. `completed` requires both resolved `categoryId` and fitment rows.

### Fixed
- **SKU allocation race condition:** Replaced application-level `readMax + check + retry` SKU allocation with a PostgreSQL `SEQUENCE` (`sku_seq`). Concurrent listing creation now gets guaranteed-unique `BLA-XXXXX` SKUs via `nextval()`. Removed `GET /pipeline/single-listing/next-sku` endpoint (SKU is now assigned server-side at save time). Frontend shows "Auto-assigned on save" instead of a pre-fetched SKU. Migration `1785200000000-CreateSkuSequence` seeds the sequence from existing data.
- **Catalog product field persistence:** Fixed field name mismatch where frontend sent `countryOfManufacture` but backend expected `countryOfOrigin`. Added missing `cMaterial`, `cPlacement`, `countryOfOrigin`, and `conditionLabel` columns to `listing_records` entity. Updated `syncToListingRecord()` to sync these fields from catalog products to listing records. Migration `1785100000000-AddFieldsToListingRecord`.

### Added
- **Catalog bulk profile selection:** When listing on channels or downloading export templates from the catalog bulk action bar, users can pick shipping, return, and payment profiles from store-fetched dropdowns. Profiles apply to eBay publish (`publish-by-listings` policy IDs + profile names) and export templates (`export-templates` overrides with optional persist). Components: `ProfileSelectors`, `ExportTemplatesModal`; `PublishModal` bulk/single flows updated.
- **Published Listings Management Module:** Central dashboard at `/published-listings` with Inventory API sync, **Trading API GetSellerList fallback** for legacy listings, **Browse API competitor pricing**, health flags (including price vs market), bulk actions, audit revisions, and scheduled 6h sync. Permissions: `published_listings.view|sync|manage|bulk`. Migration `1785000000000-PublishedListingsModule`.

### Fixed
- **Pipeline jobs queued serially:** BullMQ `pipeline` worker concurrency was hardcoded to `1`, so only one enrichment job ran at a time even when `MAX_CONCURRENT_PIPELINE_JOBS` allowed two. Worker concurrency now follows `MAX_CONCURRENT_PIPELINE_JOBS` (default `2`); per-job progress debouncing is isolated for safe parallel runs. (`PipelineProcessor`)
- **Per-marketplace category resolution & fitment (US/AU/DE):** Inline enrichment now resolves each marketplace's eBay category against its **own category tree** (US→`0`, AU→`15`, DE→`77`) instead of always using the US tree. Empty category resolution no longer silently marks enrichment `completed` — it now surfaces `needs_review`. Inline enrichment also upserts the `catalog_products` master row so the catalog detail page has a `categoryId`/`fitmentData` source even without a batch pipeline run. (`InventoryWorkbenchService.inlineEnrichListing`)
- **AU category tree ID corrected:** `CategoryLookupService.KNOWN_TREE_IDS.EBAY_AU` was `'100'` but eBay's `get_default_category_tree_id` for `EBAY_AU` returns `'15'`. AU category lookups now return correct results (e.g. `261899 Fuel Vapour Canisters`). (`CategoryLookupService`)
- **AU motors fitment enabled:** `EBAY_AU.supportsMotorsFitment` was `false` but AU tree `15` supports `Year/Make/Model/Trim/Engine` compatibility. Now `true`. (`EbayMarketplaceConfigService`)
- **Fitment discovery per-marketplace:** `FitmentDiscoveryService.discover()` now accepts `marketplace` + `categoryId` options and resolves the correct category tree for compatibility checks and MVL validation, instead of hardcoding the US tree (`'0'`). `ListingOptimizationService.optimizeProduct()` resolves the per-marketplace `categoryId` from the matching `listing_records` row. (`FitmentDiscoveryService`, `ListingOptimizationService`)
- **MVL validation tree threading:** `EbayMvlService.validateFitmentData()`, `validateParsedRows()`, `getMakes()`, `getModels()`, `getYears()`, `resolveCanonicalMakeModel()` now accept an optional `treeId` parameter so fitment validation can run against AU/DE trees, not just US. (`EbayMvlService`)
- **Shared marketplace→tree utility:** New `resolveCategoryTreeId()` helper provides canonical eBay category tree IDs per marketplace. (`ebay-marketplace-tree.util.ts`)

- **Published listings sync:** Trading API fallback failed because `GetSellerList` omitted required `EndTimeFrom`/`StartTimeFrom`; sync now uses **GetMyeBaySelling ActiveList** as the primary source for all live listings, with Inventory API enrichment afterward. Inventory API `GET /offer?sku=` 404 no longer aborts sync.

- **Pipeline-grade enrichment with stage tracking:** `inlineEnrichListing` now runs the full flow — vision part lookup → `EnrichmentPipeline.enrich()` (AI enrichment with category mapping, item specifics) → marketplace content generation (US/AU/DE). Stages written to new `enrichmentStage` column on `listing_records`. Frontend polls `GET /inventory/listings/:id/enrichment-status` and shows human-readable labels ("Detecting part from photos...", "Running AI enrichment...", "Generating US eBay listing..."). (`InventoryWorkbenchService`, `InventoryAutoTriggerService`)
- **Inline enrichment (`POST /api/inventory/inline-enrich`):** Runs complete enrichment synchronously — creates marketplace `listing_records` directly, no BullMQ pipeline job. (`InventoryWorkbenchService.inlineEnrichListing`)
- **Auto-trigger enrichment on 2 images:** Background `auto-enrich` job calls inline enrichment instead of pipeline. (`InventorySyncProcessor.handleAutoEnrich`)
- **Elaborate inventory filters:** New query params on `GET /inventory/listings`: `dateAddedFrom`, `dateAddedTo`, `brand`, `make`, `model`, `category`. Metadata endpoints: `GET /inventory/filters/brands`, `/makes`, `/models?make=X`, `/categories`. Frontend collapsible filter panel with date pickers and cascading make/model dropdowns. (`InventoryWorkbenchService`, `InventoryListingsQueryDto`)
- **Send to catalog (`POST /api/inventory/send-to-catalog`):** Creates/updates `CatalogProduct` records from enriched listing data. Replaces "Send to pipeline" as the primary action. (`InventoryWorkbenchService.sendToCatalog`)
- **Frontend hooks:** `useFilterBrands`, `useFilterMakes`, `useFilterModels`, `useFilterCategories`, `useSendToCatalog`, `useInlineEnrichListing`. (`inventoryApi.ts`)
- **Migration `1784000000000-AddEnrichmentStageToListingRecords`:** Adds `enrichmentStage` varchar column with index to `listing_records`.

### Removed
- **"Fetch details" button** removed from modal and table — enrichment auto-fires on 2 images.
- **"Send to pipeline"** toolbar action — replaced by "Send to catalog".
- **`useInventoryPartLookup`, `useInventoryBulkPartLookup`** hooks removed.
- **Per-row "Actions" column** removed from inventory table.

### Changed
- **Inventory heading description** updated to reflect auto-enrich + send-to-catalog flow.
- **Photo upload hint:** "2 required: label close-up + overall shot for automatic enrichment".
- **`EnrichmentBadge`** now shows stage hints (e.g. "Vision...", "AI Enrich...", "US...") during enriching.
- **Catalog column** replaces Pipeline column in the inventory table.

### Fixed
- **Inventory auto-enrich trigger:** When a listing reaches **2+ images**, a background BullMQ job auto-fires vision lookup (part#/brand discovery) followed by pipeline enrichment (US/AU/DE). No button clicks needed. Added `enrichmentStatus` (idle/ready/enriching/completed/failed) to the workbench list + detail endpoints, a polling endpoint, and animated status badges in the table. (`InventoryAutoTriggerService`, `auto-enrich` job handler)
- **Inventory multi-marketplace editor (`/inventory/:id/edit`):** New full-page editor replacing the read-only modal. Shows 3 tabs (US/AU/DE) with editable title, description, price, quantity, and condition. Store selector dropdown scoped to user's accessible eBay stores, with cascading payment/return/fulfillment policy dropdowns from cached policy data. Part summary card shows SKU, brand, category, images, fitments. **Save persists** edits to sibling `listing_records` + `catalog_products.optimization_payload`. Accessible via "Open full editor →" link in the detail modal. (`InventoryEditorService`, `InventoryListingEditor`, `MarketplaceVersionEditor`, `StorePolicySelector`)
- **Direct publish from editor:** New `POST /inventory/:id/publish` endpoint auto-creates a catalog product (if needed) and invokes the multi-store publish flow. UI policy selections are saved to `listing_store_overrides` and applied at publish via `ListingBuilderService`. Sticky publish action bar at the bottom of the editor shows target marketplaces and per-target progress (queued → success/failed/skipped). (`InventoryPublishService`, `PublishActionBar`)
- **Inventory per-store eBay status:** List and detail endpoints expose `storeListings` (store name, marketplace, offer ID, live price/qty, status) from `ebay_listing_channels`.
- **Catalog dedup + marketplace badges:** Catalog grid groups listing records by SKU — one card per part. Each card shows colored marketplace badges (US/AU/DE) in both grid and list views. The existing `CatalogProductDetail` page at `/catalog/products/:id` already had multi-marketplace tabs, completing the catalog polish. (`CatalogManager` dedup logic, `ListingCard`/`ResultsGrid` badge display)
- **Add Part GridConnect intake (`/listings/new`):** Two-column form with part type (OEM / Aftermarket / Salvage), condition (New / Used), brand, optional vehicle make, price, and qty. **Process SKU** runs text AI lookup (when available) and saves a draft to inventory — photos are optional at intake. Salvage auto-defaults condition to Used.
- **Inventory photo upload:** `PATCH /api/inventory/listings/:id/images` attaches S3-uploaded photos to draft listings (`listings.update`). Detail modal includes upload zone + **Attach photos** action; min 2 photos still required for Fetch details / Send to pipeline.
- **AI enrichment: platform generation alignment:** Shared `shared/automotive-platform-ranges.json` + `platform-generation.util.ts` validate chassis codes against year ranges (e.g. Lexus RX AL20 ≠ 2013–2021). Pipeline and enterprise listing builders auto-align titles/specifics for **US, AU, and DE**; quality gates hard-fail `GENERATION_YEAR_MISMATCH`. German titles include RX350/RX450h-style variant tokens; English US/AU titles use the same platform builder (`ebay-english-listing.util.ts`). Dashboard trim maps to category 33717. `/listings/new` is now **Add Part** (OEM + brand + min 2 photos → draft `listing_records` with `sourceFileName=warehouse-intake`; form resets for next part). `/inventory` is the selection hub: one row per SKU, part detail modal, **Send to pipeline** (creates pipeline CSV with vision on photos; auto-navigates to `/pipeline?job=…`). Re-queue warns when a part already has a completed pipeline job. Enrich/publish removed from inventory — use `/pipeline` and `/catalog`. Permission `inventory.enrich` gates send-to-pipeline. APIs: `POST /api/pipeline/single-listing/add-part`, `GET /api/inventory/listings`, `GET /api/inventory/listings/:id/detail`, `POST /api/inventory/send-to-pipeline` (alias `POST /api/inventory/enrich`).
- **Multi-marketplace listing generation (`ensureMissingMarketplaceListings`):** Pipeline now auto-creates US, AU, and DE listing records for every catalog product, regardless of which marketplace the source data was from. When only DE data is imported, English AI-optimized listings (US/AU) and native German listings (DE) are generated using marketplace-specific prompts. Language is maintained throughout — titles, descriptions, and SEO content are properly localized per marketplace.
- **Composite unique index on `listing_records` (`customLabelSku`, `marketplace`):** Replaced the single-column unique index on `customLabelSku` with a composite index that allows the same SKU to have separate listing records per marketplace. Migration `1783000000000-ListingSkuMarketplaceUniqueIndex`.

### Fixed
- **Pipeline catalog publish readiness (images + identity):** Enrichment cache keys now include intake fingerprint (part name, seller note, upload URLs) so the same MPN with different warehouse identity is not reused as stale AI copy. Source/upload images are preserved when the image API fails; `propagateSourceImages` copies intake photos onto `catalog_products.image_urls` and all US/AU/DE `listing_records` after pipeline save. Catalog master upsert uses **US output only** (DE/AU no longer overwrite shared title/images). Listing upserts keep existing `itemPhotoUrl` when pipeline output is empty.
- **Inventory Fetch details restored (vision-first):** `/inventory` again supports per-row and bulk **Fetch details** using OEM + brand + photos together (vision-first AI). Updates title, category, brand, model, and SEO-oriented description notes on the draft before **Send to pipeline**. `lookupPart()` now runs vision when 2+ images are present; OEM text is only used when no photos are supplied.
- **Add Part (`/listings/new`) 500 on second part:** Warehouse intake used a fixed `sourceRowNumber=0` for every part, violating `uq_listing_source_row`. Each intake now gets the next row index; duplicate-key errors return 409 with a clear message.
- **Inventory detail modal crash:** `startPriceNum` from the API can arrive as a string; price display now coerces safely before `.toFixed()`.
- **Pipeline listing upsert:** Raw SQL upsert in `saveMarketplaceToCatalog` was missing
  the `version` column (`@VersionColumn`), causing every listing record insert to fail
  with "null value in column 'version' violates not-null constraint".
- **Pipeline listing upsert:** Backfilled `pipeline_job_id` on existing listing records
  for completed pipeline jobs that had 0 listing records due to previous `orIgnore()` behavior.

### Added
- **eBay MVL integration (end-to-end):** Pipeline catalog import now validates AI/export fitment rows against live eBay Taxonomy MVL before saving (`MvlStatus` on each row). Catalog publish builds `product_compatibility` from `fitmentData` (or store fitment override) via Inventory API. Part lookup on `/listings/new` canonicalizes brand/model against MVL after AI inference. Shared utilities in `fitment-mvl.util.ts`; validation centralized in `EbayMvlService.validateFitmentData`.
- **Add Part form (`/listings/new`, superseded):** Previously a full enrichment form with Fetch details + pipeline submit; moved to inventory workbench (see warehouse intake split above). SKU/brands APIs unchanged.
- **Password management:** Users can change their own password via `PATCH /api/auth/change-password` (Settings → Account tab). Admins/super-admins can reset any user's password via `PATCH /api/rbac/users/:id/reset-password` using the `users.reset_password` permission (Users admin → Manage user modal). Both actions are audit-logged.
- **Multi-user Phase 3 (testing/observability):** Concurrency unit tests for job visibility, scheduler leader, heavy job limiter, and listing version conflicts; k6 baseline script; `GET /api/health/runtime`; global `X-Response-Time-Ms` header and slow-request logging (`SLOW_REQUEST_MS`).
- **Multi-user Phase 2 (scale):** PgBouncer + prod compose overlay; Redis 512MB in prod; `GET /api/health/queues` (admin); heavy job caps (`MAX_CONCURRENT_PIPELINE_JOBS`, `MAX_CONCURRENT_CATALOG_IMPORTS`); job-scoped pipeline uploads; Socket.IO Redis adapter (`REDIS_SOCKET_ADAPTER`); scheduler leader election (`SCHEDULER_LEADER_ENABLED`); per-user rate limits on pipeline/catalog heavy routes.
- **Multi-user P0 hardening (Sprint 1):** `ALLOW_PUBLIC_REGISTRATION` env gate (default off in production/Docker); self-registered users receive Viewer role; `GET /api/auth/public-config` for login UI; JWT default expiry reduced to 4h (`JWT_EXPIRY_SECONDS=14400`).
- **Channel connection scoping:** `GET /api/channels` uses JWT user id (removed `userId` query param); disconnect/test scoped to owner.
- **WebSocket auth:** Notification gateway verifies JWT from `handshake.auth.token` before joining user rooms.
- **Job attribution:** Pipeline, ingestion, and catalog-import uploads record `createdBy` from JWT; review endpoints record reviewer id.

### Fixed
- **Pipeline listing records not saved to catalog:** `orIgnore()` on listing record inserts silently skipped all rows when `customLabelSku` already existed in `listing_records` (due to `idx_listing_sku_unique_active` partial unique index). Replaced with raw SQL upsert (`ON CONFLICT ("customLabelSku") WHERE ... DO UPDATE SET`) to properly update existing records with the new `pipeline_job_id`.
- **Multi-user P1.3:** `createdBy` wired on all job creation/mutation paths (ingestion, pipeline, catalog-import start/retry/cancel, motors product create, fitment bulk-import queue); legacy null `createdBy` backfilled on retry/cancel/start; review reject records `reviewedBy`.
- **Multi-user Phase 1:** Partial unique index on active listing SKUs; pessimistic lock + retry on create; `version` required for PATCH status and optional per-id in bulk update; ingestion/pipeline/catalog job lists scoped by `createdBy` (admins with `users.view` see all).
- **Security:** Removed DEBUG JWT/secret logging from auth module and JWT strategy.
- **CURRENT_TRUE_STATE_OF_APPLICATION.md**: Comprehensive codebase analysis document covering architecture, database, APIs, frontend, backend, integrations, deployment, testing, and documentation accuracy. Generated 2026-06-11.

### Fixed (Documentation)
- **Corrected documentation counts**: Migrations (21→27), entities (~79→82), permissions (~90→73), backend specs (9→24), e2e tests (1→0). Updated across ARCHITECTURE.md, CONTEXT.md, CURRENT_STATE.md, KNOWN_ISSUES.md, AGENT_SYSTEM_MEMORY.md, DATABASE_SCHEMA.md, AUTH_RBAC.md, FEATURE_REGISTRY.md.
- **Added new security finding**: DEBUG JWT logging in `auth.service.ts` and `jwt.strategy.ts` exposes full tokens to console. Added as R3b to KNOWN_ISSUES.md.

### Fixed
- **User management (`/settings/users`) create/role assign failures:** `POST /api/rbac/users`
  and `PATCH /api/rbac/users/:id/role` returned 400 because inline DTOs lacked
  `class-validator` decorators and were rejected by the global `ValidationPipe`. Added
  `CreateRbacUserDto` / `AssignRoleDto` with proper validation; frontend `rbacApi` now
  surfaces API errors instead of leaving the modal stuck on "Creating…".
  (`ebay-german-listing.util.ts`) replaces word-substitution localization. DE AI prompt,
  interior-vs-exterior category correction (e.g. door armrest → Interior Door Panels),
  expanded German item specifics (`Hersteller`, `Einbauposition`, `Universelle Kompatibilität`),
  US-seller transparency in DE shipping copy, and pre-publish DE validation rules.
- **EBAY_DE SellerPundit publish auth + Hersteller errors:** Direct eBay Inventory API fallback
  now localizes item specifics (`Brand` → `Hersteller`) for German marketplace listings.
  SellerPundit store sync probes each imported token against eBay Inventory API (not Identity,
  which returns 404 without scope) so `connection_status` reflects eBay acceptance, not only
  SellerPundit connectivity. Pre-publish validation live-checks SellerPundit tokens and blocks
  with `reconnect_sellerpundit_ebay` when eBay returns invalid access token. Publish failures
  after invalid-token retry mark the account `reconnect_required` with guidance to refresh eBay
  OAuth inside SellerPundit admin (RealTrack re-sync alone cannot fix tokens issued to SP's app).
- **Pipeline mandatory listing optimization stuck:** Catalog upsert after enrichment used
  camelCase column names in `ON CONFLICT DO UPDATE` (`brandNormalized` etc.) while PostgreSQL
  expects snake_case (`brand_normalized`), so products never saved and optimization ran on 0
  listings. Parallel US/AU/DE optimization jobs also raced on `optimization_by_marketplace`
  JSONB updates, leaving `optimization_status` stuck at `running`.

### Changed
- **AI token optimization (models unchanged):** Compact Motors enrichment prompts
  (`enrichment-v2-compact`), year-range fitment output with code-side expansion,
  MPN enrichment file cache (`config/.enrichment-cache.json`), compact JSON inputs,
  low-value SKUs (&lt;$50, `AI_LOW_VALUE_MAX_PRICE`) skip LLM fitment generation,
  localization translates metadata fields only (not full HTML descriptions),
  vision defaults to `OPENAI_VISION_DETAIL=auto`, and backend `EnrichmentCacheService`
  for duplicate MPN hits.
- **AWS t3.medium tuning:** Default env profile for 2 vCPU / 4 GB RAM — Node heap
  **1536 MB** (was 8192), DB pool **10/2** (was 20/5), pipeline concurrency **3**
  (was 6–8), catalog import concurrency **2**, Postgres `shared_buffers=128MB`,
  Redis `maxmemory 128mb`. See `.env.example` and `docker-compose.yml`.
- **Pipeline eBay taxonomy hardening:** Category tree ID is cached on disk
  (`output/.ebay-taxonomy-cache.json`), rate-limit failures use negative cache
  with backoff (15 min for HTTP 429), tree resolution is single-flight, default
  taxonomy concurrency lowered to **3**, and taxonomy errors surface in the
  enrichment report + pipeline UI when keyword fallback is used for all categories.
- **Pipeline parallel processing:** Enrichment, localization (AU+DE), and image
  fetch stages now use a continuous concurrency pool (default **8** AI batches in
  flight). Removed global `CONFIG` mutation race in batch routing. OpenRouter
  429 responses get longer exponential backoff. Post-enrichment: validation runs
  first, then **images + localization in parallel** (was sequential). Tunable via
  `PIPELINE_AI_CONCURRENCY`, `PIPELINE_LOCALIZATION_CONCURRENCY`, etc.

### Fixed
- **Pipeline zombie jobs after Docker restart:** On backend boot, pipeline jobs still
  marked in-flight but absent from the BullMQ queue are failed with a retry hint
  instead of showing endless `enrichment` at 0/N. Stats API now returns
  `processing` / `pending` counts expected by the UI (was only `byStatus`).
- **Pipeline processing UX:** Processing view shows time since last progress update
  and a stale-progress hint when enrichment pauses for several minutes.
- **Pipeline enrichment progress frozen at 0%:** `[PROGRESS]` markers were only
  emitted after *all* AI batches finished (`Promise.allSettled` then loop), so
  large jobs (e.g. 958 parts) showed `0 / N` for the entire enrichment phase.
  Progress now updates as each batch completes. UI shows a clear **queued**
  message when status is `pending` (worker concurrency is 1).
- **Docker OpenRouter probe failures:** Backend `NODE_OPTIONS` now sets
  `--dns-result-order=ipv4first` and `--no-network-family-autoselection` so Node
  reaches `openrouter.ai` inside Docker Desktop (IPv6 connect was timing out with
  `Connection error` / `ETIMEDOUT`). Pipeline script imports the same IPv4
  bootstrap before OpenAI calls.
- **eBay Taxonomy API fallbacks:** Production `EBAY_CLIENT_*` credentials added to
  root and `backend/.env`; backend container restarted via Compose. Enrichment
  pipeline now resolves `EBAY_MOTORS_US` category tree (not hardcoded tree `0`)
  for `get_category_suggestions` and `get_item_aspects_for_category`.
- **RBAC sync race on boot:** `RbacService.syncFromRegistry()` is now single-flight
  and tolerates duplicate `role_permissions` inserts so backend starts cleanly
  when permissions are added.
- **Pipeline OpenRouter validation:** `validateOpenAiKey()` uses `max_tokens: 16`
  (gpt-4.1-mini minimum) instead of 5, which blocked all enrichment runs. Probes
  a fallback model list when the configured default is unavailable.
- **GridX / fallback listing quality:** `extractPartNameFromDescription()` strips
  donor boilerplate (VIN, year/make noise) so fallback titles and item specifics
  use the actual part name. Fitment export now maps Mercedes C350/C300-style
  donor models to eBay MVL `C-Class` with trim preserved. Enrichment report
  adds `totalListingsGenerated`, `totalAiEnriched`, and `enrichmentMode` so
  fallback runs are not misread as zero listings.

### Added
- **AU/DE marketplace copy localization:** Post-enrichment pass translates titles,
  descriptions, and tabbed policy shells for AU (`en-AU`) and DE (`de-DE`) outputs.
  Rule-based German enum mapping applies when OpenRouter is unavailable.
- **Pipeline enrichment status panel:** `/pipeline` job view surfaces `enrichmentMode`,
  AI vs fallback counts, OpenRouter probe errors, and localization stats from the
  enrichment report via `stageDetails`.
- **Production AI routing enablement scripts:** `scripts/import-ai-run-logs.mjs`,
  `scripts/seed-ebay-categories-from-mappings.mjs`, and SQL helpers to seed
  `ebay_categories` from mappings and bulk-load pipeline `ai-run-logs.json` into
  PostgreSQL for the optimizer dashboard.
- **AI routing dashboard + Phase 4 completion:** `/settings/ai-routing` UI for segment
  stats, optimizer recommendations, and policy JSON. `EbayTaxonomyTruthService`
  (opt-in via `AI_TAXONOMY_VALIDATION_ENABLED`) validates cached eBay category
  leaf + required aspects. Optimizer reward uses `compliance_score`, `hardFailRate`,
  and `publishErrorRate` from `ai_run_logs`. Compliance outcomes backfilled from
  catalog `EbayComplianceService` and motors `ComplianceEngineService`. Unit tests
  for reward, canary hash, and listing guards. Migration `1775710000000`.
- **Ingestion routing parity:** `VisionEnrichmentPipeline` routes vision ingestion through
  `ModelRouter`, guards, validator, and `ai_run_logs`; image enrichment uses `text` lane
  with run logging. Offline regression gate `scripts/model-comparison/regression-check.mjs`
  + GitHub workflow `ai-routing-regression.yml`. Pipeline `ai-run-logs.json` includes
  per-lane attempt/cost summary.
- **AI routing API + backlog wiring:** `GET/POST /api/ai/routing/*` for segment stats,
  recommendations, policy read, and optimizer run (`ai.routing.view` /
  `ai.routing.manage`). Optimizer writes `ai_routing_policy_history`; guard fixes
  log to `compliance_audit_logs` when product/import context exists;
  `AiRunLog.enhancement_id` set on enrichment create; per-lane session cost
  tracking; CLI `--apply` appends `config/ai-routing-policy-history.json`.
- **eBay Motors AI model comparison:** Benchmark harness + report under
  `scripts/model-comparison/` and `docs/model-comparison/`. Runs the production
  enrichment prompt over a representative 8-part sample from
  `docs/2008 Mercedes C350 AMG.xlsx` across 8 OpenRouter models, scoring
  title/description/specifics/fitment, schema reliability, live cost, and latency.
  Finding: recommend switching default from `minimax/minimax-m3` to
  `openai/gpt-4.1-mini` (deeper legitimate fitment, faster, ~$2.10/1k); use
  `deepseek/deepseek-chat-v3-0324` for low-cost bulk and `google/gemini-2.5-flash`
  for flagship listings. `nova-lite`, `claude-3.5-haiku`, and `llama-3.3-70b`
  failed to return valid JSON at batch size 8. See `docs/model-comparison/REPORT.md`.
- **AI optimization implementation plan:** `docs/ai-optimization/IMPLEMENTATION_PLAN.md`
  — multi-model router, quality gates, escalation, `ai_run_logs` learning loop,
  nightly optimizer, and phased rollout (5 phases).
- **AI optimization plan status:** `docs/ai-optimization/IMPLEMENTATION_PLAN.md` updated
  with Phase 0–3 completion markers, file map, backlog (§9.4), and ops reference (§22).
- **AI optimization system (Phase 1–3 foundation):** Multi-model `ModelRouter`
  (`backend/src/common/openai/model-router.ts`, `scripts/lib/model-router.mjs`)
  with seeded policy `config/ai-routing-policy.json`. Default lane
  `openai/gpt-4.1-mini`; flagship `google/gemini-2.5-flash`; bulk
  `deepseek/deepseek-chat-v3-0324`. Deterministic guards + `ListingQualityValidator`
  with one-shot escalation. `ai_run_logs` table + `AiRunLogService`; approve/reject
  backfill in `AiEnhancementService`; publish outcome hook in `EbayComplianceService`.
  Pipeline writes `output/ai-run-logs.json`. Advisor CLI:
  `scripts/ai-optimize-routing.mjs`. Nightly `AiOptimizerService` (opt-in via
  `AI_OPTIMIZER_ENABLED`). Operator guide: `docs/ai-optimization/README.md`.
- **SellerPundit eBay connection source:** Import eBay stores from SellerPundit
  (`connection_source = sellerpundit`) without a new channel type. Backend module
  `backend/src/integrations/sellerpundit/` handles login, store/token sync,
  policy sync, and publish via `bulk-create-using-api`. Migration
  `1775600000000-SellerPunditExtensions`. API under
  `/api/integrations/ebay/sellerpundit/*`. Publish wizard shows per-target
  SellerPundit errors from `error_payload`. Settings UI: import/sync on eBay stores
  page; SellerPundit badge on store detail (native listing/order sync hidden).

### Fixed
- OpenRouter AI calls now use **MiniMax M3 only** (`minimax/minimax-m3`):
  enrichment pipeline no longer falls back to GPT-4o/GPT-5.x; pipeline script
  routes through `OPENAI_BASE_URL`; model env vars added to `backend/.env`.
- Bulk/stub eBay publish no longer forces `condition: NEW` over
  `listing_records.conditionId`, which incorrectly required seller-paid P&A return
  policies for used salvage parts (buyer-paid 30-day returns are valid for Used).
- Publish enrichment and the inventory Publish modal no longer default missing
  condition to `NEW`; salvage listings keep `3000` / Used so buyer-paid 30-day
  return policies (e.g. `287569277015`) are accepted.
- SellerPundit policy sync no longer assigns cross-geo defaults (e.g. `EBAY_DE`
  return policy `287569277015` on `EBAY_MOTORS_US`). US P&A return blocking is
  scoped to US marketplaces only; blocked messages include listing condition and
  geo mismatch hints.
- SellerPundit import/publish now infers marketplace from account names like
  `(SVG-DE) German Salvage Dismantlers` → `EBAY_DE`, fixing "Missing business
  policy IDs after sync" when DE-only policies were synced against a US default
  marketplace row.
- Catalog → SellerPundit store publish no longer hits `API 504: Gateway Time-out`
  as often: removed redundant policy sync on every publish, parallelized SP
  `get-all-policies` fetches, stopped forcing full `get-all-tokens` refresh before
  each bulk-create, skip eBay Account API overlay when cached REST policy ids are
  valid, retry SP bulk-create once on 504, extended nginx/Vite timeouts for
  `/api/channels/ebay/publish*`, and treat SP 504 as a platform error with direct
  eBay fallback in `auto` mode.
- Catalog → store publish for SellerPundit-linked eBay accounts no longer fails with
  `eBay authorization failed` / OAuth `Invalid access token` when the cached token
  is stale. SellerPundit token expiry now respects `lastTokenRefreshDate`, tokens
  refresh aggressively before direct eBay Inventory API fallback, and publish retries
  once after a forced SellerPundit re-fetch.
- Catalog → Motors store publish no longer fails at `publishOffer` with
  `invalid shipping policy` / invalid fulfillment policy when SellerPundit sync
  stored internal policy ids (e.g. `2770043`) instead of eBay REST ids
  (e.g. `410665908022`). SellerPundit policy sync now extracts REST ids from
  `policy_details`, re-syncs when marketplace defaults are invalid, overlays
  eBay Account API policies when the token allows, and direct publish refreshes
  policies + retries `updateOffer`/`publishOffer` on policy rejection.
- Direct eBay Inventory API publish no longer fails with `Could not serialize field
  [marketplaceId]` for Motors stores. Offer payloads now map internal `EBAY_MOTORS_US`
  to eBay's `EBAY_MOTORS` MarketplaceEnum while request headers keep `EBAY_MOTORS_US`.
- Motors P&A catalog publish no longer fails with error `25021` (invalid item condition)
  for legacy `3000-Used` imports. File Exchange id `3000` now maps to `USED_EXCELLENT`
  (not `USED_GOOD`), with an automatic retry when eBay rejects other used enums.
  Republish also reuses existing unpublished offers (error `25002`) instead of failing.
- All eBay publish entry points now converge on `EbayPublishService` (catalog wizard
  processor, Motors channel queue, multi-store production publish). Inventory Manager
  bulk publish calls `POST /api/channels/ebay/publish-by-listings` with server-side
  enrichment instead of sending `{ listingIds }` to the wrong batch shape.
- Catalog eBay publish for Parts & Accessories scopes seller-paid return rules to
  **New / New Other only** (per eBay June 2025 Seller Center). Used Motors listings
  may publish with buyer-paid 30-day return policies again; mandatory seller-paid
  enforcement, pre-flight blocks, and auto-upgrade apply only when condition is
  New or New Other. If eBay still returns a P&A return error on a used listing,
  publish surfaces a condition-mismatch hint (verify `3000` / `USED_EXCELLENT` is
  sent to SellerPundit/eBay).
- SellerPundit `bulk-create-using-api` no longer fails user-facing publish in `auto`
  mode when SP returns the known `tokens.marketplaceId` SQL defect. Adapter
  force-refreshes tokens, sends `marketPlaceId`/`tokenId` aliases, tags platform
  errors, and `EbayPublishService` transparently completes via direct eBay Inventory
  API (including errors previously only present in the `errors[]` array).
- Catalog eBay publish no longer fails with `Invalid value for title` when
  catalog titles are empty or longer than 80 characters. Titles are normalized,
  truncated at word boundaries, and fall back to brand/MPN/SKU before publish
  (listing builder, validation warnings, direct eBay API, and SellerPundit paths).
- Catalog eBay publish no longer fails with `imageUrls cannot be null or empty`
  when products have blank, invalid, or pipe-delimited image entries. Image URLs
  are normalized to valid http(s) links, deduped, capped at 12, and blocked at
  validation/build time when none remain.
- Legacy catalog publish modal (`POST /api/channels/ebay/publish`) now backfills
  images from `listing_records.itemPhotoUrl` or `catalog_products.image_urls`
  when the client sends an empty or pipe-wrapped `imageUrls` array. SKU detail
  page splits pipe-delimited photos, shows a thumbnail strip, and links to the
  eBay publish wizard (`/catalog/products/:id/publish/ebay`).
- Catalog → store publish no longer fails with `Invalid value for description`
  (eBay requires 1–4000 characters). Imported HTML descriptions with embedded
  `<style>` blocks are stripped, long text is truncated at safe boundaries, and
  empty descriptions get a title/SKU-based fallback (`buildEbayListingDescription`).
- Catalog → store publish no longer fails with generic **The request has errors**
  from eBay when offers omit required Motors fields. Legacy publish now backfills
  Brand/MPN/Type aspects, sets `listingDuration: GTC`, adds used-item condition
  descriptions, refreshes SellerPundit policy IDs from the live eBay Account API
  for the target marketplace, and surfaces eBay `parameters` in error messages.
- Catalog → store publish no longer fails with **Missing inventory location**
  when a SellerPundit store has policies but no `default_inventory_location_key`.
  Publish and policy sync now list eBay inventory locations via the store token,
  auto-provision a default warehouse location when none exist, and persist the key
  on `ebay_account_marketplaces` and `stores.location_key`.
- Catalog → store publish no longer fails with eBay `Invalid request` when legacy
  condition codes (`3000-Used`, numeric File Exchange IDs) or missing
  `merchantLocationKey` are sent to the Inventory API. Conditions map to valid
  enums; listing records backfill SKU/title/category when the modal sends stubs;
  direct eBay publish validates policies and location before `createOffer`; and
  inventory locations are fetched for all stores when not mapped.
- Catalog → store publish no longer fails with `At least one valid image URL
  (http/https) is required to publish` when the catalog browse ID is a
  `listing_records` row (images in `itemPhotoUrl` or `image_assets`) rather than
  `catalog_products.image_urls`. `CatalogPublishResolverService` resolves either
  ID type, **materializes a `catalog_products` row** when missing (required for
  publish-job FK), backfills empty catalog images from the listing, and merges
  image sources; `EbayMultiStoreListingService` stores the canonical catalog id on
  job targets. Channel publish processor splits pipe-delimited `itemPhotoUrl`
  values; publish wizard loads listing title when catalog product lookup misses.
- Catalog eBay publish for SellerPundit-linked stores tries SellerPundit
  `bulk-create-using-api` first, then **falls back to direct eBay Inventory API**
  when SellerPundit returns the known platform error
  (`column tokens.marketplaceId does not exist`). Uses synced SellerPundit eBay
  tokens + marketplace policy defaults from `ebay_account_marketplaces`.
- Catalog eBay publish (`POST /api/channels/ebay/publish`) failed with
  `Invalid value for header Content-Language` because Inventory API calls did
  not send `Content-Language` (BCP-47, e.g. `en-US`) or
  `X-EBAY-C-MARKETPLACE-ID` derived from each store's marketplace.
- Catalog eBay publish (`POST /api/channels/ebay/publish`) returned opaque
  `401` for SellerPundit-linked stores: legacy `EbayAuthService` now refreshes
  tokens via SellerPundit and targets each store's production/sandbox API host
  instead of always using the global `EBAY_ENVIRONMENT` default.
- SellerPundit Docker: pass `SELLERPUNDIT_*` env vars through `docker-compose.yml`
  (container ignores `backend/.env`; use project root `.env`).
- SellerPundit missing credentials now returns HTTP 400 with a clear message instead of 500.
- Client settings save (`PATCH /api/client-settings`) returned 400 because the UI
  posted the full entity (`id`, `createdAt`, etc.). PATCH now sends only DTO
  fields; empty support email is normalized to `null`.
- Frontend API clients now send the JWT `Authorization` header on protected routes
  (catalog import, pipeline, listings, channels, orders, notifications, and
  others). Unauthenticated `fetch` calls were causing `401 Unauthorized` after
  RBAC was enabled.

### Documentation
- **Documentation reorganization (2026-06-06):** Reorganized all documentation into the
  Self-Sustaining AI Project Context framework. Created 4 new directories
  (`docs/context/`, `docs/planning/`, `docs/frontend/`, `docs/backend/`) with 37
  target files, consolidating content where there was genuine redundancy (e.g.,
  `docs/RBAC_AND_SECURITY.md` + `docs/architecture/auth-rbac.md` →
  `docs/architecture/AUTH_RBAC.md`). Anchor files preserved intact
  (`API_MAP.md` → `API_CONTRACTS.md`, `DATABASE_MAP.md` → `DATABASE_SCHEMA.md`,
  `BACKEND_MAP.md` → `MODULE_MAP.md`, `FRONTEND_MAP.md` → `COMPONENT_MAP.md`).
  12 new-gap stubs created with honest scope notes. Marked 30+ superseded files
  with redirect headers and 13 legacy files with LEGACY REFERENCE headers.
  Updated AGENTS.md, CLAUDE.md, README.md, CONTEXT.md, and
  AGENT_SYSTEM_MEMORY.md with all new paths. No existing content deleted.
- Established a documentation/memory system as the authoritative project handover
  (2026-05-29): added `CONTEXT.md`, `AGENTS.md`, this `CHANGELOG.md`; rewrote
  `README.md` as a full-stack overview with a docs map and first-read order;
  expanded `CLAUDE.md` with first-read list, risky areas, and the Continuous
  Documentation Protocol.
- Added `/docs/architecture/` (overview, codebase-map, api-map, database,
  auth-rbac, integrations, deployment).
- Added `/docs/development/` (setup, environment-variables, agent-workflow,
  task-completion-checklist).
- Added `/docs/product/` (features, known-gaps, user-roles).
- Added `/docs/operations/` (deployment-runbook, security-checklist).
- Added `/docs/decisions/` (adr-index, ADR 0001: Documentation as Project Memory).
- Added `/docs/handover/` (current-state, next-steps, risk-register).
- Preserved prior reference docs (audits, eBay handoffs, product catalog) as-is.
