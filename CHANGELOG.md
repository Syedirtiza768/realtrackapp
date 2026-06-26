# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Add an entry under **Unreleased**
for every meaningful change (Continuous Documentation Protocol).

## [Unreleased]

### Fixed
- **StoreAccessPanel (user store assignment):** Deduplicate stores by `storeName` so the same store isn't listed multiple times when choosing stores for a user.
- **Pipeline listing upsert:** Raw SQL upsert in `saveMarketplaceToCatalog` was missing
  the `version` column (`@VersionColumn`), causing every listing record insert to fail
  with "null value in column 'version' violates not-null constraint".
- **Pipeline listing upsert:** Backfilled `pipeline_job_id` on existing listing records
  for completed pipeline jobs that had 0 listing records due to previous `orIgnore()` behavior.

### Added
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
