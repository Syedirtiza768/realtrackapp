# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Add an entry under **Unreleased**
for every meaningful change (Continuous Documentation Protocol).

## [Unreleased]

### Added
- **SellerPundit eBay connection source:** Import eBay stores from SellerPundit
  (`connection_source = sellerpundit`) without a new channel type. Backend module
  `backend/src/integrations/sellerpundit/` handles login, store/token sync,
  policy sync, and publish via `bulk-create-using-api`. Migration
  `1775600000000-SellerPunditExtensions`. API under
  `/api/integrations/ebay/sellerpundit/*`. Publish wizard shows per-target
  SellerPundit errors from `error_payload`. Settings UI: import/sync on eBay stores
  page; SellerPundit badge on store detail (native listing/order sync hidden).

### Fixed
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
