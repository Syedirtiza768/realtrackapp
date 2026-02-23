# ListingPro Enterprise Platform Architecture

## Objective
Deliver an AI-first automotive parts platform that supports image-based ingestion, fitment intelligence, centralized catalog control, and multi-channel commerce with enterprise-grade reliability.

## Requirement Coverage Matrix

| # | Requirement | Primary Services | Key Output |
|---|---|---|---|
| 1 | Intelligent image ingestion | `ingestion-service`, `vision-service`, `enrichment-service` | Identified part + category/brand/condition |
| 2 | Automated product data generation | `enrichment-service`, `catalog-service` | SEO title, specs, description, specifics |
| 3 | Vehicle fitment detection | `fitment-service` | eBay Motors-ready YMME(T) fitment records |
| 4 | Master product catalog | `catalog-service`, `audit-service` | Normalized source-of-truth entities |
| 5 | Multi-channel listing management | `listing-service`, channel adapters | eBay/Shopify listing create/update/sync |
| 6 | Unified inventory & overselling prevention | `inventory-service`, `event-bus`, `reconciliation-worker` | Real-time stock integrity |
| 7 | Operational dashboard | `analytics-service`, `reporting-service` | Management UI + exports + bulk actions |
| 8 | High-performance search | `search-service` + OpenSearch | Fitment-aware full-text + attributes |
| 9 | Extensible marketplace architecture | `adapter-sdk`, adapter runtime | Pluggable Amazon/Walmart connectors |
| 10 | Enterprise architecture requirements | API gateway, auth, jobs, events | Secure, scalable, high-concurrency platform |

## Bounded Contexts

- **Ingestion Context**: image acquisition, CV recognition, AI enrichment pipelines.
- **Catalog Context**: normalized product records, variants, bundles, cross references, SKU mapping.
- **Fitment Context**: make/model/year/engine/trim extraction and validation.
- **Listing Context**: channel-specific listing projection and optimization.
- **Inventory Context**: real-time quantity accounting, reservation, reconciliation.
- **Analytics Context**: KPI aggregation, reporting, operational observability.

## Core API Surface (API-First)

### Ingestion APIs
- `POST /v1/ingestion/jobs` (single/bulk/bundle image sets)
- `GET /v1/ingestion/jobs/{jobId}`
- `POST /v1/ingestion/jobs/{jobId}/approve`

### Catalog APIs
- `POST /v1/catalog/products`
- `PATCH /v1/catalog/products/{productId}`
- `POST /v1/catalog/products/{productId}/variants`
- `POST /v1/catalog/products/{productId}/bundles`
- `GET /v1/catalog/products/{productId}/audit`

### Fitment APIs
- `POST /v1/fitment/extract`
- `POST /v1/fitment/validate`
- `PUT /v1/catalog/products/{productId}/fitment`

### Listing APIs
- `POST /v1/listings/publish` (bulk)
- `PATCH /v1/listings` (bulk update)
- `POST /v1/listings/sync`

### Inventory APIs
- `POST /v1/inventory/events`
- `GET /v1/inventory/{productId}`
- `POST /v1/inventory/reconcile`

### Search APIs
- `POST /v1/search/products` (full-text + fitment + facets)
- `GET /v1/search/suggestions`

## Data Model (Normalized)

Canonical entities:
- `Product`
- `ProductVariant`
- `ProductBundle`
- `ProductCrossReference`
- `FitmentRecord`
- `ListingProjection`
- `InventoryLedgerEntry`
- `AuditLogEntry`

Current frontend schema scaffold exists in:
- `src/types/platform.ts`

## Event-Driven Inventory Sync

### Core events
- `inventory.sale.recorded`
- `inventory.cancel.recorded`
- `inventory.restock.recorded`
- `listing.quantity.updated`
- `listing.ended.out_of_stock`
- `listing.duplicate.detected`

### Flow
1. Order/sale webhook emits inventory event.
2. Inventory service updates ledger and recalculates available quantity.
3. Listing sync workers push quantity updates to adapters.
4. Out-of-stock listings are delisted automatically.
5. Reconciliation workers repair drift on schedule.

## Marketplace Adapter Abstraction

Adapter contract:
- `publishListing`
- `updateListing`
- `endListing`
- `syncInventory`

Implemented frontend abstraction scaffold exists in:
- `src/lib/channelAdapters.ts`

This keeps core domain logic isolated from channel-specific implementations and enables Amazon/Walmart onboarding with minimal core changes.

## Search Architecture

### Engine
- OpenSearch index per product projection.
- Fitment nested docs (YMME + trim).
- Mixed ranking: text relevance + fitment confidence + popularity + inventory status.

### Features
- Full-text + attribute filters
- Fitment-aware filtering
- Dynamic facets
- Incremental indexing via events

Frontend fitment-aware search contract scaffold exists in:
- `src/lib/fitmentSearch.ts`

## Security, Auth, and RBAC

- OAuth2/OIDC at API gateway.
- JWT with tenant, role, scope claims.
- RBAC roles: `admin`, `catalog_manager`, `listing_operator`, `analyst`, `viewer`.
- Field-level authorization for sensitive pricing and margin metrics.

## Background Processing

- Job queue for ingestion and enrichment.
- Worker pool for listing publish/update bulk jobs.
- Scheduled reconciliation and index backfill jobs.
- Dead-letter queues with retry policies and idempotency keys.

## High-Concurrency & Scalability

- Stateless APIs behind autoscaling.
- CQRS-style split for write models and read projections where needed.
- Redis for hot cache and distributed locking.
- Outbox pattern for reliable event publication.
- SLO targets:
  - Search p95 < 300ms
  - Inventory sync lag p95 < 3s
  - Webhook processing p95 < 1s

## Rollout Plan

### Phase 1
- Finalize domain schema and API contracts.
- Ship ingestion + enrichment baseline with human-in-the-loop review.

### Phase 2
- Launch catalog + fitment services with audit logging.
- Introduce eBay and Shopify adapters.

### Phase 3
- Activate real-time inventory events and reconciliation.
- Deploy OpenSearch-backed fitment-aware search.

### Phase 4
- Add analytics dashboard exports and advanced KPI tiles.
- Onboard Amazon/Walmart via adapter SDK.

## Immediate Next Build Steps in This Repo

- Replace mocked dashboard sources with `GET /v1/*` API clients.
- Implement concrete adapter classes for eBay and Shopify.
- Add ingestion job UI for camera/upload (single, bulk, bundle).
- Add fitment extraction review queue with confidence thresholds.
