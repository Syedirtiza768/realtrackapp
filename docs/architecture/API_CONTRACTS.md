# API Contracts

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **Source**: Consolidated from `docs/API_MAP.md` (557 lines) and `docs/architecture/api-map.md` — 2026-05-29.
> Complete API endpoint reference. All routes under global prefix `/api` (set in `main.ts`).

---

## Base Configuration

- **Global Prefix**: `/api` (set in `main.ts`)
- **Auth**: JWT Bearer token in `Authorization` header
- **Rate Limiting**: 10/s, 100/min, 1000/hr via `ThrottlerGuard`
- **Validation**: Global `ValidationPipe` with `forbidNonWhitelisted: true`
- **CORS**: Configured in `main.ts` from `CORS_ORIGIN` env var
- **Swagger**: Available at `/api/docs` (non-production only)

---

## FEBEST pre-enriched import

The protected pipeline upload accepts `importMode=pre_enriched_febest_v1` in addition to `legacy_gridx`. The FEBEST mode requires exact `Manifest`, `Products`, and `Fitments` sheets and is revalidated server-side before a BullMQ job is created.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/api/pipeline/pre-enriched-febest/dry-run` | `pipeline.run` | Validates the exact workbook schema and returns errors, warnings, counts, and `readyForImport`; performs no DB or eBay writes |
| POST | `/api/pipeline/upload` | `pipeline.run` | Accepts `importMode=pre_enriched_febest_v1`; invalid or non-ready workbooks are rejected before enqueue |

Trusted-mode worker behavior: approved HTML, official image URLs, item specifics, and accepted fitments are persisted as draft catalog/listing rows only after collision preflight. It bypasses legacy generation and the mandatory optimization queue; publication is never performed by this mode.

## Authentication

All endpoints require authentication unless marked with `@Public()` decorator.

### Auth Endpoints (Public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with email/password, returns JWT |
| POST | `/api/auth/register` | Register new user |

### Auth Endpoints (Protected)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Current user profile + permissions |
| POST | `/api/auth/logout` | Logout (client-side token discard) |
| PATCH | `/api/auth/change-password` | Change current user password (requires currentPassword + newPassword) |
| GET | `/api/auth/organizations` | List user's organizations |

### Auth Response Format

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "uuid", "email": "user@example.com", "name": "User Name", "role": "staff", "permissions": ["listings.view", "listings.create", ...] }
}
```

---

## Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness/readiness check (@Public) |

---

## Listings

**Base**: `/api/listings` | **Permission**: `listings.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/listings` | List all listings | listings.view |
| GET | `/api/listings/:id` | Get listing by ID | listings.view |
| POST | `/api/listings` | Create new listing | listings.create |
| PUT | `/api/listings/:id` | Update listing | listings.update |
| DELETE | `/api/listings/:id` | Delete listing | listings.delete |
| GET | `/api/listings/:id/history` | Get revision history | listings.view |
| POST | `/api/listings/:id/generate` | AI-generate listing | listings.generate |

### Listings V2 (Cached)

**Base**: `/api/v2/listings` | `listings.view`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/listings` | Cached listing list |

### Export Rules ⚠️

**Double-prefix**: `/api/api/export-rules`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/api/export-rules` | List export rules | listings.export |
| POST | `/api/api/export-rules` | Create export rule | listings.export |

---

## Catalog Import

### Import

**Base**: `/api/catalog-import` | `catalog.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/catalog-import/upload` | Upload CSV file | catalog.import |
| GET | `/api/catalog-import/jobs` | List import jobs | catalog.view |
| GET | `/api/catalog-import/jobs/:id` | Get job status | catalog.view |

### Catalog Products

**Base**: `/api/catalog-products` | `catalog.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/catalog-products` | List catalog products | catalog.view |
| GET | `/api/catalog-products/:id` | Get product details | catalog.view |
| PATCH | `/api/catalog-products/:id` | Update product | catalog.update |
| PATCH | `/api/catalog-products/by-sku/:sku` | Update product by SKU | catalog.update |
| POST | `/api/catalog-products/backfill-categories` | Backfill missing eBay category IDs via Taxonomy API | catalog.update |
| POST | `/api/catalog-products/export-templates` | Export listing templates as ZIP | catalog.export |

### Compliance

**Base**: `/api/catalog-import/compliance` | `catalog.compliance`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/catalog-import/compliance/check` | Run compliance check |
| GET | `/api/catalog-import/compliance/status` | Get compliance status |

---

## Ingestion & Pipeline

### Ingestion

**Base**: `/api/ingestion` | `ingestion.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/ingestion/upload` | Upload images/files | ingestion.create |
| GET | `/api/ingestion/jobs` | List ingestion jobs | ingestion.view |
| GET | `/api/ingestion/jobs/:id` | Get job status | ingestion.view |

### Pipeline

**Base**: `/api/pipeline` | `pipeline.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/pipeline/run` | Run pipeline job | pipeline.run |
| POST | `/api/pipeline/single-listing/add-part` | Warehouse intake — part type, condition, brand, part #, price, qty → draft listing (photos optional) | listings.create |
| POST | `/api/pipeline/single` | Submit single listing to enrichment pipeline | pipeline.run |
| GET | `/api/pipeline/single-listing/lookup-pricing` | OpenRouter cost estimates (incl. 15k parts) | listings.create |
| GET | `/api/pipeline/single-listing/brands` | Brand/make options (catalog + OEM list); `?q=` filter | listings.create |
| POST | `/api/pipeline/single-listing/part-lookup` | AI lookup: vision when 2+ images; OEM text when no photos | listings.create **or** inventory.enrich |
| GET | `/api/pipeline/jobs` | List pipeline jobs | pipeline.view |
| GET | `/api/pipeline/jobs/:id` | Get job details | pipeline.view |

### Review Queue

**Base**: `/api/ingestion/review` | `pipeline.review`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ingestion/review` | List items for review |
| POST | `/api/ingestion/review/:id/approve` | Approve item |
| POST | `/api/ingestion/review/:id/reject` | Reject item |

---

## Motors Intelligence

**Base**: `/api/motors-intelligence` | `motors.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/motors-intelligence` | List motors products | motors.view |
| GET | `/api/motors-intelligence/:id` | Get product details | motors.view |
| POST | `/api/motors-intelligence/upload` | Upload for AI processing | motors.manage |
| POST | `/api/motors-intelligence/:id/extract` | Extract attributes | motors.manage |

### Review Queue

**Base**: `/api/motors-intelligence/review` | `motors.review`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/motors-intelligence/review` | List review tasks |
| POST | `/api/motors-intelligence/review/:id/approve` | Approve extraction |
| POST | `/api/motors-intelligence/review/:id/correct` | Submit correction |

---

## Fitment

**Base**: `/api/fitment` | `fitment.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/fitment/makes` | List vehicle makes | fitment.view |
| GET | `/api/fitment/models` | List models for make | fitment.view |
| GET | `/api/fitment/years` | List years for model | fitment.view |
| GET | `/api/fitment/submodels` | List submodels | fitment.view |
| POST | `/api/fitment/import` | Import fitment data | fitment.manage |
| GET | `/api/fitment/vin/:vin` | Lookup VIN | fitment.view |
| GET | `/api/fitment/ebay-mvl/status` | Active MVL releases per marketplace (US/AU/DE/GB) | fitment.view |
| GET | `/api/fitment/ebay-mvl/releases` | List imported MVL releases | fitment.view |
| POST | `/api/fitment/ebay-mvl/import` | Import MVL workbooks from server directory | fitment.manage |
| POST | `/api/fitment/ebay-mvl/import-file` | Import single MVL workbook by path | fitment.manage |
| POST | `/api/fitment/ebay-mvl/validate-batch` | Validate fitment rows (DB-first) | fitment.view |

---

## Channels

**Base**: `/api/channels` | `channels.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/channels` | List channel connections | channels.view |
| POST | `/api/channels` | Create channel connection | channels.connect |
| GET | `/api/channels/:id` | Get channel details | channels.view |
| PUT | `/api/channels/:id` | Update channel | channels.manage |
| DELETE | `/api/channels/:id` | Delete channel | channels.manage |

### Stores

**Base**: `/api/stores` | `stores.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/stores` | List stores | stores.view |
| POST | `/api/stores` | Create store | stores.manage |
| GET | `/api/stores/:id` | Get store details | stores.view |
| GET | `/api/stores/:id/profiles` | Get available shipping, return, and payment profiles for a store | stores.view |
| PUT | `/api/stores/:id` | Update store | stores.manage |
| GET | `/api/stores/:storeId/listings/published` | Complete published listing data (title/price/images/specifics/policies) for everything live on this store — mirrors the eBay Inventory/Trading API state, kept current by `PublishedListingsSyncService`. Store-scoped wrapper around `PublishedListingsService.list` (`store-published-listings.controller.ts`) | published_listings.view |
| GET | `/api/stores/:storeId/listings/published/:id` | Complete published listing data for one item on this store (404 if the item belongs to a different store) | published_listings.view |

### eBay Publish

**Base**: `/api/channels/ebay` | `ebay.publish`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/channels/ebay/publish` | Publish listing to one or more stores (full PublishDto) |
| POST | `/api/channels/ebay/publish-batch` | Batch publish multiple payloads |
| POST | `/api/channels/ebay/publish-by-listings` | Publish by listingIds + storeIds; server enriches |
| PATCH | `/api/channels/ebay/offers/price-quantity` | Update price/qty on live offers |
| DELETE | `/api/channels/ebay/offers/:offerId` | End listing (withdraw offer) |

---

## Product Verticals

**Base**: `/api/verticals` | protected by RBAC

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/verticals/profiles` | List supported vertical profiles and attribute fields | catalog.view |
| GET | `/api/verticals/stores` | List organization eBay stores with vertical configuration | settings.view |
| GET | `/api/verticals/stores/:storeId/config` | Read a store's enabled/default/workflow vertical config | settings.view |
| PATCH | `/api/verticals/stores/:storeId/config` | Update store vertical configuration | settings.manage |
| GET | `/api/verticals/catalog/:productId/category-metadata` | Read marketplace category/aspect/condition metadata | catalog.view |
| POST | `/api/verticals/families` | Create a non-automotive product family | catalog.update |
| GET | `/api/verticals/families/:familyId/variants` | List family variants | catalog.view |
| POST | `/api/verticals/families/:familyId/variants` | Create a family variant | catalog.update |
| POST | `/api/verticals/variant-mappings` | Create or persist a variant marketplace mapping | ebay.publish |
| POST | `/api/verticals/families/:familyId/publish` | Upsert Inventory API items/offers, create an item group, and publish the family | ebay.publish |

The catalog upload endpoint also accepts multipart field `vertical`; omitted or
legacy values resolve to `automotive`. Non-automotive publishing is fail-closed
when `multi_vertical_catalog` is disabled and never receives Motors fitment or
category fallback behavior.

## eBay Integrations

**Base**: `/api/integrations/ebay` | `ebay.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/integrations/ebay` | List connected accounts | ebay.view |
| POST | `/api/integrations/ebay` | Connect new account | ebay.connect |
| GET | `/api/integrations/ebay/:id` | Get account details | ebay.view |
| DELETE | `/api/integrations/ebay/:id` | Disconnect account | ebay.manage |
| POST | `/api/integrations/ebay/:id/sync` | Sync account data | ebay.sync |
| GET | `/api/integrations/ebay/:id/policies` | Get business policies | ebay.view |

### Multi-Store

**Base**: `/api/ebay` | `ebay.*`

---

## Published Listings (live eBay mirror)

**Base**: `/api/published-listings` | `published_listings.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/published-listings` | List/filter published listings | published_listings.view |
| GET | `/api/published-listings/export` | Export published listings as CSV (query params match list endpoint) | published_listings.export |
| GET | `/api/published-listings/summary` | Dashboard counts | published_listings.view |
| GET | `/api/published-listings/sync-logs` | Sync job history | published_listings.view |
| GET | `/api/published-listings/stores` | Connected stores with listing counts | published_listings.view |
| GET | `/api/published-listings/sync-status` | Per-store sync health | published_listings.view |
| POST | `/api/published-listings/sync` | Enqueue store sync from eBay | published_listings.sync |
| GET | `/api/published-listings/trading-enrichment/budget` | Trading API rate-limit budget status | published_listings.view |
| POST | `/api/published-listings/trading-enrichment/batch` | Pre-enrich listings via Trading API (warm cache) | published_listings.sync |
| GET | `/api/published-listings/:id` | Listing detail (+ raw eBay payload) | published_listings.view |
| GET | `/api/published-listings/:id/trading-enrichment` | Trading API enrichment (images, compatibility, description, item specifics). Returns cached data (<7 days) or fetches from eBay. ~1.7s on cache miss, <10ms on hit. | published_listings.view |
| GET | `/api/published-listings/:id/revisions` | Audit/revision history | published_listings.view |
| PATCH | `/api/published-listings/:id` | Revise title/price/qty/images | published_listings.manage |
| POST | `/api/published-listings/:id/end` | End listing on eBay | published_listings.manage |
| POST | `/api/published-listings/:id/relist` | Relist ended offer | published_listings.manage |
| POST | `/api/published-listings/:id/refresh` | Re-sync single listing | published_listings.sync |
| POST | `/api/published-listings/:id/competitor-pricing` | Refresh competitor pricing for one listing | published_listings.sync |
| POST | `/api/published-listings/bulk` | Bulk price/qty/end/sync | published_listings.bulk |
| GET | `/api/published-listings/bulk/:jobId` | Bulk job status | published_listings.view |

### Trading API Enrichment (PartsBazar360 integration)

Fetches full eBay Trading API data for a listing — all gallery images, complete
vehicle compatibility (130+ rows), styled HTML description, and item specifics
(MPN, OE/OEM). Cached in DB for 7 days. Rate-limited to ~4,500 calls/day.

**`GET /api/published-listings/:id/trading-enrichment`**

Query params: `force` (`true` to bypass cache)

```json
{
  "data": {
    "enrichedAt": "2026-07-29T03:30:00.000Z",
    "source": "trading_api",
    "imageUrls": ["https://i.ebayimg.com/..."],
    "compatibility": { "compatibleProducts": [{"compatibilityProperties": [{"name":"Year","value":"2020"},{"name":"Make","value":"Cadillac"},...]}] },
    "description": "<style>...</style><div>...</div>",
    "itemSpecifics": { "Brand": ["Cadillac"], "Manufacturer Part Number": ["9597375"] }
  },
  "cached": true,
  "budget": { "used": 42, "remaining": 4458, "limit": 4500, "resetDate": "2026-07-29" }
}
```

**`POST /api/published-listings/trading-enrichment/batch`**

Body: `{ "listingIds": ["uuid-1", "uuid-2"], "force": false }`
Response: `{ "enriched": 2, "skipped": 0, "failed": 0 }`

**`GET /api/published-listings/trading-enrichment/budget`**

Response: `{ "used": 42, "remaining": 4458, "limit": 4500, "resetDate": "2026-07-29" }`

Full integration guide: `docs/integrations/partsbazar360-trading-enrichment.md`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/ebay/stores` | List eBay stores | ebay.view |
| POST | `/api/ebay/stores` | Create store | ebay.manage |
| GET | `/api/ebay/stores/:id` | Get store details | ebay.view |
| PUT | `/api/ebay/stores/:id` | Update store | ebay.manage |
| DELETE | `/api/ebay/stores/:id` | Delete store | ebay.manage |

### OAuth Callback (Public)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations/ebay/callback` | eBay OAuth callback (@Public) |

### SellerPundit

**Base**: `/api/integrations/ebay/sellerpundit`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/ebay/sellerpundit/login` | Login to SellerPundit |
| GET | `/api/integrations/ebay/sellerpundit/stores` | List imported stores |
| POST | `/api/integrations/ebay/sellerpundit/sync` | Sync stores/tokens/policies |
| GET | `/api/integrations/ebay/sellerpundit/config` | Get org-level config |
| PUT | `/api/integrations/ebay/sellerpundit/config` | Update org-level config |

---

## Inventory

**Base**: `/api/inventory` | `inventory.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/inventory/listings` | List workbench parts — one row per SKU (`page`, `limit`, `status`, `search`, `missingImages`, `dateAddedFrom`, `dateAddedTo`, `brand`, `make`, `model`, `category`) | inventory.view |
| GET | `/api/inventory/listings/:listingId/detail` | Full part detail for modal (fitments, US/AU/DE variants, pipeline job, enrichmentStage) | inventory.view |
| GET | `/api/inventory/listings/:listingId/enrichment-status` | Poll enrichment progress — returns `{ status, stage }` with stage like `vision_lookup`, `enrichment`, `generating_us`, etc. | inventory.view |
| DELETE | `/api/inventory/listings/:listingId` | Soft-delete inventory listing | inventory.delete |
| POST | `/api/inventory/listings/bulk-delete` | Soft-delete multiple inventory listings (`{ ids }`) | inventory.delete |
| PATCH | `/api/inventory/listings/:listingId/images` | Attach uploaded photo URLs to a draft listing | listings.update |
| PATCH | `/api/inventory/listings/:listingId/images/reorder` | Reorder or remove the complete image URL array for an automotive listing; the first image is primary | listings.update |
| POST | `/api/inventory/part-lookup` | Vision-first fetch details for one listing (OEM + brand + 2+ photos → title, category, SEO notes) | inventory.enrich |
| POST | `/api/inventory/part-lookup/bulk` | Vision-first fetch details for multiple listings | inventory.enrich |
| POST | `/api/inventory/inline-enrich` | **Complete inline enrichment:** vision part lookup + EnrichmentPipeline + AI content generation for US/AU/DE. Creates marketplace listing records directly — no pipeline job. | inventory.enrich |
| POST | `/api/inventory/send-to-catalog` | **Send to catalog:** Create or update `CatalogProduct` records from enriched listing data (title, brand, price, images, fitments) | inventory.enrich |
| GET | `/api/inventory/filters/brands` | Distinct brand values (`cBrand`) for filter dropdown | inventory.view |
| GET | `/api/inventory/filters/makes` | Distinct extracted make values for filter dropdown | inventory.view |
| GET | `/api/inventory/filters/models?make=X` | Distinct extracted model values, optionally filtered by make | inventory.view |
| GET | `/api/inventory/filters/categories` | Distinct category names for filter dropdown | inventory.view |
| GET | `/api/inventory/:listingId` | Get inventory ledger for a listing | inventory.view |
| POST | `/api/inventory/:listingId/adjust` | Adjust quantity | inventory.adjust |
| POST | `/api/inventory/:listingId/allocations` | Per-store allocation | inventory.allocate |
| POST | `/api/inventory/reconcile` | Reconcile inventory | inventory.reconcile |

---

## Orders

**Base**: `/api/orders` | `orders.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/orders` | List orders | orders.view |
| GET | `/api/orders/:id` | Get order details | orders.view |
| PUT | `/api/orders/:id` | Update order | orders.update |
| POST | `/api/orders/:id/ship` | Mark as shipped | orders.ship |
| POST | `/api/orders/:id/refund` | Process refund | orders.refund |
| POST | `/api/orders/import` | Import orders | orders.import |

---

## Dashboard & Audit

**Base**: `/api/dashboard` | `dashboard.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/dashboard` | Get dashboard KPIs | dashboard.view |
| GET | `/api/dashboard/sales` | Get sales data | dashboard.view |
| GET | `/api/dashboard/inventory` | Get inventory summary | dashboard.view |

### Audit Logs

**Base**: `/api/audit-logs` | `audit.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/audit-logs` | List audit logs | audit.view |
| GET | `/api/audit-logs/:entity/:id` | Get entity audit trail | audit.view |

---

## Settings

**Base**: `/api/settings` | `settings.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/settings` | Get settings | settings.view |
| PUT | `/api/settings` | Update settings | settings.manage |
| GET | `/api/settings/pricing-rules` | Get pricing rules | pricing.view |
| POST | `/api/settings/pricing-rules` | Create pricing rule | pricing.manage |

---

## Client Settings (White-Label)

**Base**: `/api/client-settings` | `client_settings.*` (super_admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/client-settings` | Get client settings |
| PATCH | `/api/client-settings` | Update settings |
| GET | `/api/client-settings/branding/public` | Get public branding (@Public) |

---

## RBAC Admin

**Base**: `/api/rbac` | `users.*`, `roles.*`

### Users

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/rbac/users` | List users | users.view |
| POST | `/api/rbac/users` | Create user | users.create |
| PATCH | `/api/rbac/users/:id/role` | Assign primary role | roles.assign |
| PATCH | `/api/rbac/users/:id/deactivate` | Deactivate user | users.deactivate |
| PATCH | `/api/rbac/users/:id/reset-password` | Admin reset user password | users.reset_password |

### Roles

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/rbac/roles` | List roles | roles.view |
| POST | `/api/rbac/roles` | Create role | roles.manage |
| PUT | `/api/rbac/roles/:id` | Update role | roles.manage |
| DELETE | `/api/rbac/roles/:id` | Delete role | roles.manage |
| POST | `/api/rbac/roles/:id/permissions` | Assign permissions | roles.assign_permissions |
| POST | `/api/rbac/users/:id/roles` | Assign roles to user | roles.assign |

---

## Other Modules

### Durable eBay bulk publishing

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| POST | `/api/ebay/listings/publish-bulk` | Enqueue 1–500 listing IDs against 1–10 stores as one durable job; enforces the 5,000 target/day organization quota | `ebay.publish` |
| GET | `/api/ebay/listing-jobs/:id` | Read durable publish-job status | `ebay.view` |
| GET | `/api/ebay/listing-jobs/:id/targets` | Read per-listing/per-store progress and results | `ebay.view` |

Bulk jobs persist in `ebay_listing_jobs` / `ebay_listing_job_targets` and run
through the `ebay-listing-publish` BullMQ queue at bounded concurrency. The
submission request is idempotent when `idempotencyKey` is supplied.

### Automation

**Base**: `/api/automation-rules` | `automation.*`

CRUD for automation rules (GET, POST, GET/:id, PUT/:id, DELETE/:id).

### Templates

**Base**: `/api/templates` | `templates.*`

CRUD for listing templates (GET, POST, GET/:id, PUT/:id, DELETE/:id).

### Notifications

**Base**: `/api/notifications` | `notifications.*`

GET list, PUT `/:id/read`, PUT `/read-all`, DELETE `/:id`. WebSocket on `notifications` namespace.

### Storage

**Base**: `/api/storage` | `storage.*`

GET list, POST `/upload`, GET `/:id`, GET `/:id/download`, DELETE `/:id`.
The public `GET /api/storage/serve/{s3Key}` image proxy prefers a sibling
`.webp` object for original JPEG/PNG/GIF/BMP/HEIC/AVIF keys and responds with
a temporary redirect to the original key when the WebP object is absent.
Responsive `_thumb.webp`, `_sm.webp`, `_medium.webp`, and `_lg.webp`
requests retain their existing on-demand self-healing behavior.

### Image Drive

**Base**: `/api/image-drive` | `image_drive.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/image-drive/folders` | List all folders (with thumbnail URLs, file counts) | image_drive.view |
| POST | `/api/image-drive/folders` | Create folder (name, optional linkedPartNumber) | image_drive.manage |
| PATCH | `/api/image-drive/folders/:id` | Update folder name or linked part number | image_drive.manage |
| DELETE | `/api/image-drive/folders/:id` | Delete folder + all S3 files | image_drive.manage |
| GET | `/api/image-drive/folders/:id/files` | List files in folder (paginated) | image_drive.view |
| POST | `/api/image-drive/folders/:id/upload` | Upload files to folder (multipart, up to 50) | image_drive.upload |
| POST | `/api/image-drive/upload` | Upload with auto-create folder (folderId="auto") | image_drive.upload |
| POST | `/api/image-drive/upload-folder` | Upload up to 50 images from a folder-tree chunk; `filePaths` preserves relative paths and part-number directories are mapped to linked Image Drive folders | image_drive.upload |
| DELETE | `/api/image-drive/files/:id` | Delete single file (+ S3 cleanup) | image_drive.manage |
| GET | `/api/image-drive/files/:id` | Get single file details | image_drive.view |
| POST | `/api/image-drive/files/bulk-delete` | Bulk delete files by IDs | image_drive.manage |
| GET | `/api/image-drive/lookup/:partNumber` | Auto-attach lookup by part number | image_drive.view |
| POST | `/api/image-drive/lookup` | Batch lookup by part numbers | image_drive.view |
| GET | `/api/image-drive/search` | Search folders by name or linked part number | image_drive.view |
| GET | `/api/image-drive/stats` | Get stats (totalFolders, totalFiles, totalSizeBytes) | image_drive.view |

`POST /api/image-drive/upload-folder` accepts multipart `files`, a JSON
`filePaths` array aligned with those files, and `topLevelFolderName`. The
frontend chunks larger folder trees into requests of 50 files or fewer. The
response reports `uploaded`, retry-safe `skipped`, `unassigned`, and per-folder
counts.

### Feature Flags ⚠️

**Double-prefix**: `/api/api/feature-flags` | `feature_flags.*`

CRUD at `/api/api/feature-flags`. Manage restricted to `feature_flags.manage` (super_admin only).

---

## Known Issues

### Double `/api` Prefix

Two controllers have paths that combine with the global prefix:

| Controller | Declared Path | Effective Path |
|------------|---------------|----------------|
| `feature-flag.controller.ts` | `api/feature-flags` | `/api/api/feature-flags` |
| `export-rule.controller.ts` | `api/export-rules` | `/api/api/export-rules` |

**Action Required**: Verify frontend client calls before fixing.

---

## Frontend API Clients

Located in `src/lib/`:

| Client | File | Base Path |
|--------|------|-----------|
| Auth | `authApi.ts` | `/api/auth` |
| Listings | `listingsApi.ts` | `/api/listings` |
| Catalog | `catalogImportApi.ts` | `/api/catalog-import` |
| Motors | `motorsApi.ts` | `/api/motors-intelligence` |
| eBay | `ebayIntegrationsApi.ts` | `/api/integrations/ebay` |
| Multi-Store | `multiStoreApi.ts` | `/api/ebay` |
| Orders | `ordersApi.ts` | `/api/orders` |
| Inventory | `inventoryApi.ts` | `/api/inventory` |
| Fitment | `fitmentApi.ts` | `/api/fitment` |
| Channels | `channelsApi.ts` | `/api/channels` |
| Settings | `settingsApi.ts` | `/api/settings` |
| RBAC | `rbacApi.ts` | `/api/rbac` |
| Image Drive | `imageDriveApi.ts` | `/api/image-drive` |
| Templates | `templateApi.ts` | `/api/templates` |
| Pipeline | `pipelineApi.ts` | `/api/pipeline` |

---

*Consolidated & reorganized: 2026-06-06. Updated: 2026-08-19.*

## Fashion workspace API

All Fashion routes remain under the normal /api prefix and require JWT plus the listed Fashion permission.

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| POST | /api/auth/login with vertical=fashion | fashion.access | Fashion-specific login authorization |
| GET | /api/fashion/workspace | fashion.dashboard.view | Fashion metrics and enabled stores |
| GET | /api/fashion/listings | fashion.listings.view | Organization-scoped Fashion catalog |
| POST/PATCH | /api/fashion/listings and /api/fashion/listings/:id | fashion.listings.create/update | Create or edit a Fashion draft |
| POST | /api/fashion/listings/photos | fashion.listings.create | Multipart Fashion garment photo upload via existing storage; returns CDN URLs |
| POST | /api/fashion/listings/analyze-images | fashion.listings.create | Analyze a complete photo set; `confirmedKeys` and saved `_confirmedKeys` are not overwritten; photos are kept if analysis fails |
| POST | /api/fashion/listings/generate-content | fashion.listings.create | Build Fashion title/description from confirmed attributes and reported defects |
| POST | /api/fashion/listings/:id/review | fashion.review | Approve or reject authenticity review |
| GET | /api/fashion/listings/:id/review | fashion.authenticity.review | Read private review metadata |
| POST | /api/fashion/listings/:id/quarantine | fashion.incidents.manage | Local quarantine; remote takedown is reported unavailable unless an integration supports it |
| GET/PATCH | /api/fashion/stores and /api/fashion/stores/:storeId/config | fashion.stores.view/settings.manage | View and configure Fashion store enablement |
| POST | /api/fashion/ebay/oauth/start | fashion.stores.manage | Start a vertical-tagged eBay OAuth flow |
| POST | /api/fashion/ebay/listings/validate or /publish | fashion.publish | Validate or enqueue an approved Fashion listing against Fashion-enabled seller targets |
| GET | /api/fashion/users | fashion.users.manage | List Fashion workspace members |
| PATCH | /api/fashion/users/:userId/role | fashion.roles.manage | Assign a Fashion role |

Catalog import upload/start accepts Fashion only when the caller has fashion.import; non-Fashion imports still require catalog.import. Vertical is selected server-side from the request and persisted on the import.

## Business & Industrial workspace API (2026-09-09)

All B&I routes are organization-scoped, require JWT, and use the dedicated
`business_industrial.*` permission namespace. The local workspace is separate
from automotive and Fashion; eBay seller accounts are tagged with an owning
vertical during OAuth.

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/api/business-industrial/workspace` | business_industrial.dashboard.view | Metrics, category families, and authorized stores |
| GET | `/api/business-industrial/categories` | business_industrial.listings.view | Deliberate category-family choices |
| GET/POST/PATCH | `/api/business-industrial/listings[/:id]` | business_industrial.listings.view/create/update | Create and edit explicit B&I drafts |
| GET/POST | `/api/business-industrial/review[/listings/:id/review]` | business_industrial.review / review.private | Review queue and private evidence record |
| POST | `/api/business-industrial/listings/:id/quarantine` | business_industrial.incidents.manage | Immediate local quarantine plus verified eBay offer withdrawal where a tracked offer exists |
| POST | `/api/business-industrial/units/:unitId/allocate` or `/sold` | business_industrial.listings.update | Atomically allocate a serialized unit to an authorized B&I store, then mark it sold once |
| POST | `/api/business-industrial/webhooks/ebay-enforcement` | signed public webhook (`EBAY_WEBHOOK_SECRET`) | Verify an eBay enforcement signal, quarantine local state, and attempt verified remote withdrawal |
| GET/POST/POST | `/api/business-industrial/incidents`, `/incidents/:id/takedown`, `/incidents/:id/release` | business_industrial.incidents.view/manage/release | Verified incident intake, retryable takedown, release, and audit state |
| GET | `/api/business-industrial/stores` | business_industrial.stores.view | List dedicated B&I seller stores |
| POST | `/api/business-industrial/ebay/oauth/start` | business_industrial.stores.manage | Start vertical-tagged eBay OAuth |
| GET | `/api/business-industrial/ebay/accounts` and `/accounts/:id/policies` | business_industrial.stores.view | List dedicated seller accounts and read stored marketplace policies |
| POST | `/api/business-industrial/ebay/accounts/:id/policies/sync` | business_industrial.stores.manage | Synchronize payment, return, and fulfillment policies |
| GET | `/api/business-industrial/ebay/accounts/:id/categories` and `/categories/:categoryId/metadata` | business_industrial.listings.view | Search category leaves and retrieve required aspects/policies |
| POST | `/api/business-industrial/ebay/listings/validate`, `/publish`, `/publish-bulk` | business_industrial.publish | Validate or enqueue approved listings against B&I stores |
| GET | `/api/business-industrial/ebay/listing-jobs/:id` and `/listings` | business_industrial.listings.view | Inspect publish jobs and organization-scoped publication channels |
| POST | `/api/business-industrial/ebay/listings/:id/end` | business_industrial.publish | End a B&I publication and verify the remote offer is unpublished |
| GET/POST/PATCH | `/api/business-industrial/users`, `/users/:userId/role`, `/users/:userId/deactivate`, `/users/:userId/stores` | business_industrial.users.manage | Create temporary-password accounts, role-manage, assign dedicated stores, or deactivate B&I members |

B&I publishing fails closed unless the product is approved, not quarantined,
has a mapped eBay leaf category, complete measurement units, and the required
shipping evidence. Verified incidents quarantine local state immediately. For
tracked Inventory API offers, the integration withdraws the offer and re-reads
it until eBay reports `UNPUBLISHED`; failed or untracked targets remain
escalated with retry evidence. Signed enforcement webhooks remain fail-closed
until `EBAY_WEBHOOK_SECRET` is configured.

The catalog publish dialog reads the selected account's cached policies from
`/accounts/:id/policies` and sends optional connected-store target fields
(`fulfillmentPolicyId`, `paymentPolicyId`, `returnPolicyId`, profile names, and
`merchantLocationKey`) with single-target validation/publish requests. The
durable target stores these values in its JSON result payload and the worker
applies them when building the offer, so connected-store mappings take
precedence over stale catalog profile text. Bulk publish continues to resolve
each selected store's marketplace defaults server-side.

## B&I AI image intake (2026-09-10)

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| POST/GET | `/api/business-industrial/image-intake/jobs` | business_industrial.import | Create and list organization-scoped image intake runs |
| GET | `/api/business-industrial/image-intake/jobs/:id` | business_industrial.import | Read upload and AI-processing progress |
| POST | `/api/business-industrial/image-intake/jobs/:id/upload` | business_industrial.import | Upload up to 50 images with relative folder paths per request |
| POST | `/api/business-industrial/image-intake/jobs/:id/start` | business_industrial.import | Queue sequential vision/OCR identification |
| GET | `/api/business-industrial/image-intake/jobs/:id/groups` and `/groups/:id` | business_industrial.import | Review grouped parts, source folders, evidence images, confidence, warnings, category, and item specifics |
| GET | `/api/business-industrial/image-intake/jobs/:id/export.xlsx` | business_industrial.import | Export Listings, Source Folders, and Image Assets worksheets |
| POST | `/api/business-industrial/image-intake/groups/:id/apply` | business_industrial.listings.create | Create one B&I draft from a reviewed image group |

The upload contract preserves relative paths and treats a final numeric dot
suffix as an instance marker (`Valve.1` and `Valve.2` belong to `Valve`). AI
identification, price estimates, and categories are advisory. Draft creation
requires a deliberate B&I category family and may carry a reviewer-confirmed
eBay condition ID; existing B&I compliance approval and eBay publish validation
remain mandatory before publication. Starting a partial/failed job creates a
new queue attempt and processes only pending or failed groups; completed groups
are preserved.

The listing validation endpoint returns one `results[]` entry per seller target,
with its own `blockingErrors` and `warnings`. Publishing fails closed when the
explicit condition ID is not supported by the selected eBay leaf category.

Serialized unit transitions are conditional database updates: only `available`
units can be allocated and only `allocated` units can be sold, preventing double
allocation or sale under concurrent requests. Private serial values are returned
only through the private review endpoint.

## Generic Auto Parts API scope (2026-09-11)

`/api/catalog-products*`, `/api/listings*`, and listing search/facet/export
queries are Auto Parts APIs. Authenticated requests are filtered server-side by
the user’s organization memberships, `vertical=automotive`, and existing
store/team access. Lookup-by-ID/SKU, edits, status changes, deletion, restore,
bulk profile changes, exports, revisions, and SKU sibling synchronization use
the same boundary and return not-found for inaccessible rows.

Historical rows with nullable organization/vertical fields are compatibility
data, not globally shared data: NULL-organization rows are included only when
the requester belongs to `LEGACY_AUTOMOTIVE_ORGANIZATION_ID`. New interactive
listing records are written with organization ownership and an automotive
vertical. Global catalog maintenance endpoints (`fix-condition-titles`,
`sanitize-titles`, and `backfill-categories`) require `catalog.clear`.

## B&I image intake Drive extension (2026-09-11)

POST /api/business-industrial/image-intake/jobs/from-drive requires
business_industrial.import and accepts folderUrl, optional maxItems from 1 to
200, optional skipFolderNames, and autoCreateDrafts. It queues the server-side worker, which prefers
BNI-1…BNI-N direct child folders, caps images at 12 per item, converts sources
to WebP before S3, and runs the same vision/enrichment flow. Job polling
returns aiInputTokens, aiOutputTokens, aiCostUsd, aiRuns, aiModel, and webpStorage.
Drafts are projected into shared listing_records and never
published automatically.
The create, list, polling, group review, apply, upload, start, and export
endpoints accept organizationId and enforce the selected organization boundary.
For link-shared Drive files, the worker prefers each file's public
`webContentLink` for binary download and falls back to Drive `files.get` media;
this supports Drive security-update links when API-key media access is rejected.
B&I API score fields remain percentages from 0–100; Catalog persists the same
values as 0–1 ratios in its `numeric(5,4)` score columns.

## Shared vertical catalog API (2026-09-12)

The NestJS `CatalogModule` exposes the same contract for Fashion and Business & Industrial while retaining the vertical-specific domain services for edits, review, quarantine, and publish eligibility.

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/api/fashion/catalog/search` or `/api/business-industrial/catalog/search` | `<vertical>.access` + `<vertical>.listings.view` | Server-side search, pagination (`limit` 1–500, `offset`), sort, facets, q, price/image/stock/date/team/store filters, and `validationStatuses`. |
| GET | `.../search/suggest` | view | Debounced SKU/title/brand/category/MPN suggestions scoped to the caller. |
| GET | `.../search/facets` | view | Filtered common, vertical-attribute, team, marketplace, stock, catalog-status, validation-status, and price facets. |
| GET | `.../products/:id` | view | Common product projection, safe review status, team metadata, and authorized publication summaries. |
| PATCH | `.../products/:id` | `<vertical>.listings.update` | Inline common-field/attribute/image updates delegated to the vertical service. |
| POST | `.../bulk/team` | `<vertical>.catalog.assign_team` | Assign selected IDs to an authorized active team or unassign. |
| POST | `.../bulk/policies` | `<vertical>.catalog.manage_policies` | Apply shipping/payment/return profiles to selected IDs. |
| POST | `.../bulk/delete` | `<vertical>.catalog.delete` | Soft-delete selected unpublished, non-quarantined catalog products; published items fail closed. |
| POST | `.../export` | `<vertical>.catalog.export` | Server-side CSV of the filtered dataset or explicit product IDs; private evidence is excluded. |
| POST | `/api/fashion/ebay/listings/publish-bulk` | `fashion.access` + `fashion.publish` | Durable Fashion multi-store publish job for approved products and dedicated Fashion stores. |

All query/body DTOs are strict under the global `ValidationPipe`. Every query resolves organization membership, vertical, team scope, and accessible store IDs server-side. Publication facets and summaries never count or expose channels from inaccessible stores. Quarantined/manual-review records cannot be inline-edited, bulk-mutated, or published through the shared workspace.
Facet category buckets return the stable category ID as `value` and the human category name as `label`; the query accepts either ID or legacy name values for compatibility with saved links. Imported date bounds are ISO timestamps, with the client sending the day after `importedTo` because the server applies an exclusive upper bound. The publish-job target response includes the original `errorPayload` plus normalized `errorMessage`/`lastErrorMessage` fields, and `completed_with_errors` is terminal. When the caller has no accessible publication stores, the marketplace facet is returned as an empty array rather than generating an invalid empty `IN ()` predicate; other product and vertical-attribute facets remain available.

For Business & Industrial, the curated attribute-facet allowlist follows the
fields populated by the importer and image-intake pipeline:
`categoryFamily`, `manufacturer`, `model`, `mpn`, `inventoryMode`,
`shippingMode`, `inputVoltage`, `inputFrequency`, `mounting`,
`countryOfOrigin`, `ratedVoltage`, `ratedCurrent`, `series`, and
`enclosureRating`. Empty automotive fields are not presented in the B&I UI.

All query/body DTOs are strict under the global `ValidationPipe`. Every query resolves organization membership, vertical, team scope, and accessible store IDs server-side. Publication facets and summaries never count or expose channels from inaccessible stores. Quarantined/manual-review records cannot be inline-edited, bulk-mutated, or published through the shared workspace.
