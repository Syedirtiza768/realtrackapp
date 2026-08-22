# Integrations & Background Jobs

## External integrations

| Integration | Purpose | Key code | Env vars |
|-------------|---------|----------|----------|
| **eBay Developer API** | OAuth, multi-account/multi-store listing publish, inventory & order sync, business-policy sync | `backend/src/integrations/ebay/`, `channels/ebay/` | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_DEV_ID`, `EBAY_ENVIRONMENT` (SANDBOX/PRODUCTION), `EBAY_REDIRECT_URI` |
| **OpenAI** | Image classification (vision), listing text generation, embeddings; calls queued | `common/openai/`, `ingestion/ai/`, `motors-intelligence/` | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL` |
| **AWS S3** | Product image storage + presigned URLs; thumbnails via Sharp | `storage/`, `@aws-sdk/client-s3` | `AWS_S3_BUCKET`, `AWS_S3_PREFIX`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (legacy `S3_*` aliases) |
| **Shopify** | Admin API scaffolding (`@shopify/shopify-api`) | `channels/` | — (Needs verification: not fully wired) |

> eBay is the primary, most fully implemented integration. Shopify/Amazon/Walmart
> appear in channel abstractions but are partial — verify before relying on them.

### eBay specifics

- OAuth: `ebay-integrations-oauth.service.ts`; callback route is `@Public()`
  (frontend `/channels/ebay/callback`).
- Tokens encrypted/stored in `EbayOauthToken` / `ConnectedEbayAccount`;
  refresh handled by `ebay-account-token.service.ts`.
- Multi-store: `ebay-multi-store-listing.service.ts`, `InternalStore`,
  `ListingStoreOverride`, `EbayAccountMarketplace`.
- API audit/error logging: `EbayApiAuditLog`, `EbayApiError`.
- Listing images are uploaded to eBay Picture Services through
  `EbayMediaApiService` before either the direct Inventory API or SellerPundit
  publish path runs. The store-scoped `ebay_hosted_images` cache prevents
  repeated uploads on retries and ensures published listings do not depend on
  AWS S3 URLs remaining accessible. If eBay hosting fails, that store's
  listing is not published with the source URL as a fallback.
- Durable publish targets retain the original `listing_records.id` in
  `result_payload.sourceListingId`. `CatalogPublishResolverService` therefore
  uses the exact reviewed listing row for title, description, price, quantity,
  category, condition, and image precedence even when several listing rows map
  to one canonical catalog product. A non-empty stored title is authoritative;
  structured title composition is used only when the stored title is empty.
- eBay Motors publish validates the stored category against taxonomy before
  creating the inventory offer. A cached or live verified leaf is used when
  available; if taxonomy is unavailable, the service uses the known publishable
  fallback leaf `9886` (`Other Car & Truck Parts & Accessories`) instead of
  sending an unverified parent category. The resolved ID/name is persisted to
  `catalog_products`, the exact source listing, and SKU-linked sibling listing
  rows. Recent deterministic failures can be repaired and requeued with
  `scripts/repair-ebay-publish-failures.mjs`; it is dry-run by default.
- If a durable publish target points at a historical source-listing row that
  has since been removed, `ListingBuilderService` falls back to the target's
  canonical `catalog_product_id` so the listing can still be built. The
  `scripts/repair-ebay-publish-failures.mjs --retry-skus=... --apply --retry`
  mode supports an explicit, auditable requeue after this fallback is deployed.
- The final per-store publish boundary also removes reconstructed Motors
  compatibility rows for marketplaces whose configuration sets
  `supportsMotorsFitment=false` (currently eBay DE and GB). This protects the
  multi-store publish path, where request enrichment happens before the store
  loop and could otherwise re-add catalog fitment to a non-Motors target.
- If eBay rejects a publish because the item already exists, the durable
  processor extracts the existing item ID and checks the same-account,
  same-marketplace channel mirror. When that channel is already published, the
  target is marked `skipped` with the existing item/channel IDs rather than
  remaining a false failure. The repair script can apply the same audited
  reconciliation to historical rows with
  `--reconcile-known-duplicates --apply`.
- Row-level `shippingProfileName`, `paymentProfileName`, and
  `returnProfileName` assignments are resolved by exact, case-insensitive name
  against every target eBay account and marketplace. A cache miss triggers an
  eBay Account API refresh; if the named policy is still absent or a return
  policy is incompatible with the listing, that target fails closed. Publishing
  never substitutes an unrelated marketplace default for an explicit name.
  Resolved row-level IDs are request-scoped and must not be persisted into
  `ebay_account_marketplaces.default_*`; those columns represent account
  defaults, not the most recently published listing.
- Vehicle fitment / compatibility is published as structured data via the
  eBay Inventory API `PUT /inventory_item/{sku}/product_compatibility` after
  the inventory item is created/updated. Source of truth is
  `catalog_products.fitment_data`; `fitment_rows` is used as a fallback, and
  rows tagged `rejected` (via `MvlStatus` or `validationStatus`) are skipped.
  `fitment-mvl.util.ts` normalizes both field naming conventions and expands
  `yearStart`/`yearEnd` ranges into deduplicated per-year compatibility rows.
  `EbayPublishService` applies this derivation to every publish entry point,
  including bulk `publish-by-listings`. For fitment-capable Motors categories,
  publish fails closed when no validated Year/Make/Model rows exist. When rows
  are present, SellerPundit-connected stores use the direct Inventory API path;
  the service reads `product_compatibility` back and verifies all requested
  rows before publishing the offer. Description HTML is never treated as a
  substitute for eBay's structured compatibility section.
- Compatibility is fail-closed across both eBay representations: before a
  publish, Inventory API SKU compatibility is replaced or explicitly deleted
  and read back exactly; after an offer is reused or published, the legacy
  Trading API `ItemCompatibilityList` is read, replaced with `ReviseItem` and
  `ReplaceAll=true` when necessary, and read back again. A verification failure
  withdraws the offer. The one-time repair utility is
  `backend/src/scripts/repair-ebay-compatibility.ts` (dry-run by default;
  `--apply` performs eBay and published-listing mirror updates).
- The compatibility repair utility only treats validated `fitment_data` or
  accepted `fitment_rows` as a source. Empty, rejected, or review-only catalog
  data therefore produces the exact correct zero-row compatibility set; title
  text and description HTML are never used to invent vehicle rows. The default
  scan is deliberately narrow (published Motors channels with local stale
  compatibility and no valid catalog source); sibling channels can be audited
  with `--sku`/`--sku-list`, while `--all-current` requires an explicit
  confirmation flag.
- eBay can retain a stale catalog/compatibility projection when an Inventory
  offer is reused or even recreated under the same SKU. The repair path first
  tries exact same-SKU replacement, then fails closed to a fresh per-channel
  SKU: it publishes a neutral item with `includeCatalogProductDetails=false`,
  verifies zero or the exact requested rows through both APIs, restores the
  seller title/aspects, verifies again, and only then removes the old offer.
  Listings that eBay reports as genuinely ended are marked `ended` locally
  instead of being represented as an active repaired listing.
- Pending fitment reprocessing is a durable BullMQ workflow. The maintenance
  script `backend/src/scripts/queue-pending-fitment-publish.ts --apply` queues
  every `fitment_status='pending'` product for forced MVL/fitment optimization;
  the worker publishes only validated rows to already-published eBay channels.
  Products that remain empty, rejected, or review-only are skipped and remain
  available for manual review.
- Reference docs: `docs/EBAY_MULTI_STORE_DEVELOPER_HANDOFF.md`,
  `docs/ebay-multi-store-architecture.md`, `docs/ebay-api-integration-notes.md`,
  `docs/ebay-client-onboarding.md`.

### SellerPundit (eBay connection source)

SellerPundit is **not** a separate sales channel. Imported stores remain
`channel = ebay` with `connected_ebay_accounts.connection_source = 'sellerpundit'`.

| Area | Path |
|------|------|
| Module | `backend/src/integrations/sellerpundit/` |
| HTTP / login | `sellerpundit-http.client.ts`, `sellerpundit-auth.service.ts` |
| Store import | `sellerpundit-account-sync.service.ts` → `get-all-tokens` |
| Policy sync | `sellerpundit-policy-sync.service.ts` → `get-all-policies` |
| Publish | `sellerpundit-listing.adapter.ts` → `bulk-create-using-api` |
| API | `sellerpundit-ebay.controller.ts` under `/api/integrations/ebay/sellerpundit` |

**Publish path:** `ebay-listing-publish.processor.ts` calls
`SellerpunditPolicySyncService.ensurePoliciesFresh` before bulk create for SP
accounts. Errors are stored on `ebay_listing_job_targets.error_payload` with
`source: 'sellerpundit'`, `stage`, `errors`, and optional `sellerPundit` body.

**Token refresh:** SP accounts use `SellerpunditTokenSyncService` (re-fetch
`get-all-tokens`), not eBay OAuth refresh.

**Config:** org table `organization_sellerpundit_config`; env fallbacks in
`SELLERPUNDIT_*` (see `docs/development/environment-variables.md`).

## Background jobs (BullMQ + Redis)

Queue registrations and processors (`@Processor`) discovered in code:

| Queue | Processor | Concurrency | Purpose |
|-------|-----------|-------------|---------|
| `ingestion` | `ingestion/processors/ingestion.processor.ts` | 3 | Image/data ingestion |
| `pipeline` | `ingestion/processors/pipeline.processor.ts` | 1 | Enrichment pipeline; enqueues `listing-optimization` |
| `listing-optimization` | `listing-optimization/processors/…` | 1 | Listing optimization |
| `catalog-import` | `catalog-import/processors/csv-import.processor.ts` | 1 | CSV/catalog import (memory-heavy; needs large heap) |
| `fitment` | `fitment/processors/fitment-import.processor.ts` | 1 | Fitment import |
| `inventory` | `inventory/processors/inventory-sync.processor.ts` | 1 | Inventory sync |
| `orders` | `orders/processors/order-import.processor.ts` | 1 | Order import |
| `dashboard` | `dashboard/processors/aggregation.processor.ts` | 1 | KPI aggregation |
| `channels` | `channels/processors/channel-publish.processor.ts` | 2 | Channel publish |
| `openai` | `common/openai/openai-queue.service.ts` | 3 | Queued OpenAI calls |
| `motors-pipeline` | `motors-intelligence/processors/motors-pipeline.processor.ts` | default | Motors AI pipeline |
| `storage-thumbnails` | `storage/processors/thumbnail.processor.ts` | 5 | Thumbnail generation |
| `storage-cleanup` | `storage/processors/cleanup.processor.ts` | 1 | Orphan cleanup |
| `ebay-inventory-sync` | `integrations/ebay/processors/ebay-inventory-sync.processor.ts` | default | eBay inventory sync |
| `ebay-order-sync` | `integrations/ebay/processors/ebay-order-sync.processor.ts` | default | eBay order pull |
| `ebay-listing-publish` | `integrations/ebay/processors/ebay-listing-publish.processor.ts` | default | eBay listing publish |

## Scheduled jobs

`common/scheduler/` uses `@nestjs/schedule` cron to enqueue work into the
`storage-cleanup`, `inventory`, `orders`, `dashboard`, and `channels` queues
(`scheduler.service.ts`).

## Realtime / events

- **WebSocket**: Socket.IO gateway, `notifications` namespace
  (`notifications/`). Pushes live notifications to the frontend.
- **EventEmitter2** (`@nestjs/event-emitter`) for in-process domain events.

## Extension notes

- New queue: `BullModule.registerQueue({ name })` in the owning module + a
  `@Processor(name)` class; inject with `@InjectQueue(name)`.
- Redis connection comes from `REDIS_HOST/PORT/PASSWORD` (configured globally in
  `app.module.ts`).
- New external API: add a service under the owning module, keep secrets in env
  (document the var name here and in [environment-variables.md](../development/environment-variables.md)).
