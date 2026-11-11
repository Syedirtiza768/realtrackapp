# Integrations & Background Jobs

## External integrations

| Integration | Purpose | Key code | Env vars |
|-------------|---------|----------|----------|
| **eBay Developer API** | OAuth, multi-account/multi-store listing publish, inventory & order sync, business-policy sync | `backend/src/integrations/ebay/`, `channels/ebay/` | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_DEV_ID`, `EBAY_ENVIRONMENT` (SANDBOX/PRODUCTION), `EBAY_REDIRECT_URI` |
| **OpenAI** | Image classification (vision), listing text generation, embeddings; calls queued | `common/openai/`, `ingestion/ai/`, `motors-intelligence/` | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL` |
| **AWS S3** | Product image storage + presigned upload/download URLs; Fashion vision uses short-lived signed GET URLs for private images; thumbnails via Sharp | `storage/`, `@aws-sdk/client-s3` | `AWS_S3_BUCKET`, `AWS_S3_PREFIX`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (legacy `S3_*` aliases) |
| **PartsBazar360 search** (read) | Parts Search portal (`/parts-search`): proxies PartsBazar360 universal search. With the key, uses the internal endpoint (every offer, seller, source, stock); without it, the public buyer search | `backend/src/parts-search/` | `PARTSBAZAR360_API_URL` (shared with publishing), `PARTSBAZAR360_SEARCH_API_KEY` (must equal `REALTRACK_SEARCH_API_KEY` on PartsBazar360; separate from the publish key), `PARTS_SEARCH_TIMEOUT_MS` (8000), `PARTS_SEARCH_CACHE_TTL_SECONDS` (30) |

| **Shopify** | Admin API scaffolding (`@shopify/shopify-api`) | `channels/` | — (Needs verification: not fully wired) |
Catalog image rendering proxies only recognized first-party S3 bucket hosts and
CloudFront URLs through `/api/storage/serve/:key`. S3 URLs from other buckets
remain direct source URLs; this is required because the proxy reads only the
bucket configured by `AWS_S3_BUCKET` and must not reinterpret an external key
as a local object. Production stores objects only in the account-qualified
bucket (`solarrisebackupbucket-<12-digit>`). The retired `solarrisebackupbucket`
hostname is treated as an alias of that bucket: `StorageService` extracts the
same object key and rewrites catalog/listing URLs onto the configured host
instead of downloading from the dead alias. Apply historical rows with
`scripts/repoint-s3-bucket-alias-urls.mjs`. The bucket-owning AWS account
(`530142863136`) is not the app-server account (`976773964927`). The bucket
policy must grant the app `bucketuser` `s3:GetObject`/`PutObject` on
`mhn/catalog-images/*` as well as `mhn/business-industrial/*`; a B&I-only
policy returns AccessDenied and `/api/storage/serve` maps that to HTTP 404.

> eBay is the primary, most fully implemented integration. Shopify/Amazon/Walmart
> appear in channel abstractions but are partial — verify before relying on them.

### eBay specifics

- All new standard single-item fixed-price listings use Trading API
  `AddFixedPriceItem`, with `Item.SKU` retained as the seller's Custom Label
  and `InventoryTrackingMethod=ItemID` so Seller Hub can manage them. The
  `EBAY_LISTING_API_MODE` override is retired; configuration cannot route new
  standard listings back to the Inventory API. Existing offer-backed channels
  continue through the Inventory API for in-place changes, and multi-SKU
  variation-family publishing is paused and fails closed until it can create
  Trading API listings.
- Business & Industrial image intake resolves categories through the live US
  eBay Taxonomy API. It tries the AI category query first and, for industrial
  inventory where a manufacturer/model query is too narrow, retries with
  deliberate combinations of manufacturer, model, part type, B&I family label,
  and source part name. Each accepted result must be a verified leaf and has
  its item aspects persisted with the intake group; the fallback does not
  invent or substitute a category ID.
- OAuth: `ebay-integrations-oauth.service.ts`; callback route is `@Public()`
  (frontend `/channels/ebay/callback`).
- Tokens encrypted/stored in `EbayOauthToken` / `ConnectedEbayAccount`;
  refresh handled by `ebay-account-token.service.ts`.
- Multi-store: `ebay-multi-store-listing.service.ts`, `InternalStore`,
  `ListingStoreOverride`, `EbayAccountMarketplace`.
- The Auto Parts catalog's durable bulk-publish dialog scopes its store choices
  to the active workspace's connected eBay accounts and sends that same
  `organizationId` with the job. The API validates membership and checks that
  every selected primary store belongs to an active account in that workspace.
- API audit/error logging: `EbayApiAuditLog`, `EbayApiError`.
- Listing images are uploaded to eBay Picture Services through
  `EbayMediaApiService` before either the direct Inventory API or SellerPundit
  publish path runs. The store-scoped `ebay_hosted_images` cache prevents
  repeated uploads on retries and ensures published listings do not depend on
  AWS S3 URLs remaining accessible. For URLs in the configured S3 bucket,
  `StorageService.keyFromUrl` resolves the key and `getObjectBuffer` reads the
  private object with backend credentials. The Media API receives those bytes
  through multipart `create_image_from_file`; its anonymous URL fetch cannot
  read a private bucket. External image hosts still use `create_image_from_url`.
  Transient EPS errors are retried; one rejected source may be skipped when
  another image succeeds. Authentication and other unexpected errors fail the
  store publish, and no source URL is substituted for an EPS URL.
  AWS S3 URLs remaining accessible. When a source image belongs to the
  configured private S3 bucket, the service downloads the bytes server-side and
  uploads them with eBay Media API `create_image_from_file`; the durable
  unsigned URL remains the cache identity and is never sent to eBay. External
  sources continue to use `create_image_from_url`. Transient EPS failures are retried with
  bounded backoff; a source-specific invalid-image response is skipped when
  other valid images remain, while authentication/configuration/database
  failures still fail the store publish closed. Known PartsFinder rotating
  image templates are converted to their stable primary details image; other
  unresolved URL templates are discarded. The source URL is never used as a
  fallback, and a listing with no usable images remains unpublished.
- Business & Industrial eBay publish normally requires
  `verticalValidationStatus=approved` and `manualReview=false`. For a temporary
  operator-led publishing window, `BUSINESS_INDUSTRIAL_ALLOW_UNAPPROVED_PUBLISH=true`
  bypasses that B&I compliance gate and allows bulk policy/profile edits on
  those records; it does not alter review records or
  bypass RBAC, store authorization, eBay account/policy checks, image handling,
  SKU ownership, or post-publish validation. The flag defaults to `false` and
  should be removed after the window closes.
- B&I condition handling preserves imported eBay condition ID 3000 as the
  USED_EXCELLENT Inventory API condition. When a category policy does not
  expose the preferred condition ID, publish validation selects a supported
  condition from the same semantic family (new, used, refurbished, or parts)
  before the request reaches SellerPundit or eBay.
- The B&I catalog publication projection merges current channel rows with the
  published-listings sync table, treating `published`, `active`, and
  `out_of_stock` as live marketplace states. The catalog exposes Published,
  Unpublished, and Blocked filters and derives a usable eBay item URL from the
  stored listing ID when the source row has no URL. Its bulk policy editor loads
  and merges every local and synced shipping, return, and payment profile from
  all connected B&I eBay stores into select controls.
- Durable publish targets retain the original `listing_records.id` in
  `result_payload.sourceListingId`. `CatalogPublishResolverService` therefore
  uses the exact reviewed listing row for title, description, price, quantity,
  category, condition, and image precedence even when several listing rows map
  to one canonical catalog product. A non-empty stored title is authoritative;
  structured title composition is used only when the stored title is empty.
  The same source-listing precedence applies to the eBay SKU: a reviewed
  listing's `customLabelSku` is sent to eBay when publishing by listing ID;
  catalog-only publishes use `catalog_products.sku`. A mismatch is surfaced as
  a resolver warning instead of silently sending the other SKU, which avoids
  eBay ManageBySKU mismatches.
- New fixed-price Trading API listings still send that value as `Item.SKU` for
  eBay's Custom Label, but set `InventoryTrackingMethod=ItemID` so the seller
  can edit the label after listing. eBay does not let a live ManageBySKU listing
  switch tracking methods; listings created under the old SKU-tracking mode
  must be relisted before their custom label can be changed.
- eBay Motors publish validates the stored category against taxonomy before
  creating the inventory offer. A cached or live verified leaf is used when
  available; if taxonomy is unavailable, the service uses the known publishable
  fallback leaf `9886` (`Other Car & Truck Parts & Accessories`) instead of
  sending an unverified parent category. The resolved ID/name is persisted to
  `catalog_products`, the exact source listing, and SKU-linked sibling listing
  rows. A stale generic Engine category or transmission-fluid category is also
  replaced with that fallback when the text does not describe a complete engine
  or a genuine fluid product.
  Deterministic part keywords are also applied at the final publish boundary for
  legacy rows. For example, a BMW X5 coolant-hose title resolves to the live
  Car & Truck Motors leaf `33601` (`Coolant Hoses`) rather than allowing a
  valid-but-wrong motorcycle leaf such as `177983` (`Radiators`) to reach
  compatibility validation; the corrected category is persisted to the
  catalog and SKU-linked source rows.
  If `getOffer` returns Inventory API error 25713 (This Offer is not available),
  the publisher reads the channel's mapped listing through Trading API GetItem.
  It only replaces an offer after eBay reports that listing as `Completed` or
  `Ended`; active or unknown listings stop without creating another listing.
  Recovery deletes only the stale offer and keeps the Inventory item/SKU. If
  `createOffer` reports error 25002, the publisher fetches the exact offer ID (or
  lists offers for the SKU), verifies SKU and marketplace, and reuses the offer.
  A published offer's listing ID comes from `listing.listingId` when eBay nests
  it in the response.
  Recent deterministic failures can be repaired and requeued with
  `scripts/repair-ebay-publish-failures.mjs`; it is dry-run by default.
- If a durable publish target points at a historical source-listing row that
  has since been removed, `ListingBuilderService` falls back to the target's
  canonical `catalog_product_id` so the listing can still be built. The
  `scripts/repair-ebay-publish-failures.mjs --retry-skus=... --apply --retry`
  mode supports an explicit, auditable requeue after this fallback is deployed.
- eBay inventory SKUs are account-scoped. If the canonical SKU is already owned by another remote item, the publisher first reuses a previously persisted effective channel SKU when present; otherwise it checks a deterministic alternate namespace. The historical BLA-to-BLAP rule is preserved, and other valid imported SKU families use a bounded hash-suffixed alternate. Every alternate is still preflighted for ownership before any Inventory API write.
- eBay merchant-location resolution is UAE-only for the account: `default`, `USA`, `US_77001`, Houston, and other legacy US placeholders are normalized to the required enabled Dubai location `AE_Dubai`; location-list selection accepts only enabled locations whose address country is AE/ARE/United Arab Emirates. If no UAE location can be verified or provisioned, publishing fails closed rather than submitting a US location.
- eBay error 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block is a permanent seller-country policy block, not a transient revise outage. Publish and published-listing bulk-revise failures preserve the detailed reason and tell operators to use an enabled merchant location in the seller registered country or request forward-deployed inventory authorization. Physical warehouse country is never changed automatically to bypass eBay policy.
- New listings default to Trading API `AddFixedPriceItem`, so their Custom Label remains editable in Seller Hub. `EBAY_LISTING_API_MODE=inventory` is an explicit override for new non-FEBEST listings. Existing listings created in eBay's Inventory API model cannot be revised through Seller Hub's standard editor or Trading API; operators can use the Published Listings detail page's Quick revise action, which writes through Inventory API. A publish request that matches a stored channel with an Inventory API `offerId` and SKU also stays on the Inventory API path, regardless of the new-listing mode: `PUBLISHED` offers are updated in place with `updateOffer`; `UNPUBLISHED` offers are updated and published again using the same offer ID; any other returned state stops before writing. This prevents Trading API `ReviseFixedPriceItem` errors `21919474` and `291` for Inventory-managed listings and avoids creating duplicates. A legacy Trading-only channel with a listing ID but no offer mapping is revised by that ID while active. If eBay returns error 291 because that legacy listing has ended, the publisher calls `RelistFixedPriceItem` with the current requested listing fields and persists eBay's new ItemID and URL. A relist rejection is returned to the operator; if the relist response or local mapping write is uncertain, the durable target is not automatically retried, to avoid creating duplicate listings. FEBEST also uses Trading API. Trading compatibility serialization sends unique Year/Make/Model rows first and retries without the compatibility block when eBay returns `21917122` / “All compatibilities are invalid”; fitment remains in the listing description and the item is not left unpublished because of stale optional Trim/Engine values. Trading failures expose eBay's specific `Message` and `ShortMessage` alongside the `LongMessage`; seller or category policy restrictions still require resolution with eBay.
- Trading API error 240 handling includes the first `ErrorParameters.Value`
  when eBay supplies a seller/content policy reason. If the response contains
  only the generic rejection, the seller or listing policy must be resolved
  with eBay before retrying; the publisher does not bypass that restriction.
- The Trading default applies to the standard single-item publisher. The
  separate variation-family item-group publisher still creates multi-SKU
  listings through the Inventory API; existing Inventory offers also continue
  through their owning Inventory API path for in-place changes.
- eBay publish boundaries cap a listing's submitted available quantity at 10.
  The queued channel record stores that capped amount; inventory and later
  quantity-revision workflows remain separate from initial publication.
- When a remote SKU exists but has no local channel and no published remote
  offer/listing, the publish boundary may reclaim that unpublished orphan for
  the current canonical catalog product. It never reclaims a locally-owned or
  published remote SKU; those collisions remain fail-closed. Reclaim writes the
  existing canonical request and the post-publish projection check verifies
  title, image count, description, policies, location, and compatibility.
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
  publish fails closed when no validated Year/Make/Model rows exist. Untagged
  legacy fitment data is omitted until MVL validation marks it `valid`, while
  explicitly validated `fitmentData` rows remain supported. When rows are
  present, SellerPundit-connected stores use the direct Inventory API path;
  the service reads `product_compatibility` back and verifies all requested
  rows before publishing the offer. Description HTML is never treated as a
  substitute for eBay's structured compatibility section.
- If eBay publish returns error `25002` stating that all compatibilities are
  invalid even though Inventory API readback succeeded, the publisher retries
  once with only the unique Make/Model/Year properties
  (`toCoreCompatibilityPayload`). Optional Trim, Engine, Submodel, and notes
  are omitted because the local MVL check does not validate those
  marketplace-specific vocabularies. The offer projection and final
  verification use the reduced payload. Production 2026-09-15 showed the
  previous retry rewrote the same payload; the strip is now applied before
  the second `publishOffer`. `fitmentDataToCompatibilityPayload` also omits
  `Submodel`, which is not a US Motors Inventory API compatibility property.
- Compatibility is fail-closed across the Inventory API representation: before
  a publish, Inventory API SKU compatibility is replaced or explicitly deleted
  and read back exactly; after an offer is reused or published, the Inventory
  offer is refreshed with `updateOffer` and verified again. Normal publishing
  does not call Trading API `ReviseItem` for Inventory-managed listings. A
  verification failure withdraws the offer. Trading read/replace remains an
  explicit legacy-repair path in `backend/src/scripts/repair-ebay-compatibility.ts`
  (dry-run by default; `--apply` performs eBay and published-listing mirror
  updates).
- eBay returns error `21919474` when Trading API `ReviseItem` is attempted on
  an Inventory-managed listing, and can return `21919233` when a legacy
  compatibility projection exceeds its category limit. Both are handled as
  read-only legacy-projection limitations, not as successful Trading writes:
  Inventory compatibility is still replaced and verified exactly, the
  Inventory offer is updated and verified, and the source title, images,
  policies, fitment rows, and compatibility rows are not rewritten. Other
  Trading errors still fail closed. SellerPundit errors in these classes fall
  back to the direct Inventory API path.
- Individual Add Part/New listing audits use
  `backend/src/scripts/audit-add-part-ebay.ts`. The audit excludes
  `pipeline_import`, FEBI/FEBI Bilstein, and Lemförder/Lemforder rows, then
  reads the live Inventory and Trading APIs to compare the source title,
  buyer-facing description, image counts, exact compatibility/MVL rows,
  business-policy IDs, and merchant location. It is read-only and emits
  JSONL results with fetch failures separated from confirmed mismatches. Use
  `--skip-trading` when the eBay Trading API application quota is exhausted and
  `--channel-id=...` for a bounded post-repair verification. Internal warehouse
  bin codes are not compared to the eBay merchant-address projection.
- `backend/src/scripts/repair-add-part-ebay.ts` consumes the completed audit
  JSONL and is dry-run by default. Its apply mode is serial and guarded by
  canonical source-row resolution, exact title/MPN identity for orphaned
  remote SKUs, eBay-hosted image resolution, compatibility/policy checks, and
  post-publish verification. A per-store `success=false` result is logged as
  a repair error rather than being counted as a completed repair.
  Successful repairs transactionally persist the effective eBay SKU and
  offer/listing pointers. The runner retries bounded eBay availability
  propagation failures and cleans up only unpublished, no-listing partial
  alternate-SKU artifacts proven to belong to that repair attempt.
  Fresh/noncanonical SKUs are skipped for a separate canonical recovery
  workflow.
- `backend/src/scripts/repair-add-part-fresh-ebay.ts` is the separate,
  dry-run-by-default recovery for those audited noncanonical channels. It
  uses the deterministic `BLA-<suffix>` → `BLAP-<suffix>` Seller SKU for
  Blackline conflicts (with no postfix), after verifying that the replacement
  item and offers are absent on the target eBay account. It creates the new
  offer from the canonical Add Part source, neutralizes
  catalog identifiers during the initial projection, verifies the final eBay
  item/offer, and only then swaps `ebay_listing_channels` and
  `ebay_published_listings` pointers. A failed local pointer transaction never
  triggers another eBay offer creation automatically. Use `--channel-id=...`
  for a single canary before applying the remaining target set.
- New Add Part and warehouse-intake records with an omitted SKU now receive
  the `BLAP-<sequence>` prefix. Existing catalog/listing SKUs are not renamed;
  the `BLA-<suffix>` → `BLAP-<suffix>` rule remains the first deterministic
  fallback for legacy BLA conflicts. If an alternate is occupied, the target
  remains fail-closed until another candidate is proven unused, so the publisher
  never overwrites an active eBay item.
- The normal publish boundary applies deterministic fallback candidates when a
  canonical SKU is occupied: it reuses a persisted effective SKU when present,
  otherwise preflights up to four bounded candidates (preserving the historical
  `BLA-` → `BLAP-` first candidate), publishes only under an unused candidate,
  returns the effective Seller SKU, and persists it for new queue-created
  channel rows. If all candidates are occupied by unrelated remote items,
  publishing fails closed.
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
  tries exact same-SKU replacement, then may use a fresh per-channel SKU only
  when the caller supplies a canonical local inventory item. Recovery refuses
  to copy the remote item under the collided SKU, publishes a neutral item
  with `includeCatalogProductDetails=false`, verifies zero or the exact
  requested rows through both APIs, restores the canonical seller fields,
  verifies again, and only then removes the old offer. Listings that eBay
  reports as genuinely ended are marked `ended` locally instead of being
  represented as an active repaired listing.
- Every successful direct or SellerPundit publish performs a post-publish
  projection check for the canonical title, image count, description, policy
  IDs, location, and compatibility. A failed check withdraws the new offer
  so a partially or incorrectly projected listing is not accepted as a
  successful publish.
- Publishing authorization is organization-wide: every RBAC role receives
  `listings.publish`, `channels.publish`, and `ebay.publish`, and new/active
  users receive all-store access. Deactivated users remain blocked by the
  authentication guard. Store access does not bypass eBay account, policy,
  source-data, or remote-SKU ownership safeguards.
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
| `catalog-import` | `catalog-import/processors/csv-import.processor.ts` | 1 | CSV/catalog import with persisted row checkpoints, idempotent resume, transient retries, and incomplete Fashion image repair with a 25 MB/25 MP source cap and 2048-pixel WebP quality-85 output (memory-heavy; needs large heap) |
| `catalog-import` | `catalog-import/processors/csv-import.processor.ts` | 1 | CSV/catalog import; commits row checkpoints before Fashion image mirroring, resumes saved row outcomes and incomplete WebP copies, retries transient failures, and recovers stalled long-running jobs (memory-heavy; needs large heap) |
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
