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
