# Shared Catalog Workspace

## Scope

Omni Core exposes a common, server-backed catalog workspace for the Fashion and Business & Industrial verticals:

- `/fashion/catalog` (legacy `/fashion/listings` remains supported)
- `/business-industrial/catalog` (legacy `/business-industrial/listings` remains supported)

Auto Parts remains under `/auto-parts/catalog` and keeps its existing catalog flow.

## API contract

The shared NestJS `CatalogModule` exposes the following vertical-aware endpoints:

- `GET /api/{vertical}/catalog/search`
- `GET /api/{vertical}/catalog/search/facets`
- `GET /api/{vertical}/catalog/search/suggest`
- `GET /api/{vertical}/catalog/products/:id`
- `PATCH /api/{vertical}/catalog/products/:id`
- `POST /api/{vertical}/catalog/bulk/team`
- `POST /api/{vertical}/catalog/bulk/policies`
- `POST /api/{vertical}/catalog/bulk/delete`
- `POST /api/{vertical}/catalog/export`

Search and export operate on the full server-side `catalog_products` dataset. Query DTOs are strict, support pagination/sorting, and include common, marketplace, stock, date, team, price, image, and vertical-attribute filters.

Publication status is derived from live `ebay_listing_channels` rows (matching or null vertical), `catalog_products.ebay_item_id`, linked `ebay_published_listings`, and `listing_records."ebayListingId"`. Successful eBay publishes stamp `ebay_item_id`. Historical mismatches are repaired by `scripts/backfill-catalog-publication-status.sql`.

The published-state predicate (`publishedSql`) is written as uncorrelated `IN` subqueries over those sources: live channel rows, legacy mirror rows, and eBay-linked listing records, scoped by organisation, vertical and the caller's stores. PostgreSQL hashes each subquery once per statement instead of re-checking per catalog row. The `ebay_item_id` match against the mirror is not repeated, because `p.ebay_item_id IS NOT NULL` already counts as published. Every subquery drops NULL keys, so the predicate is never NULL.

The partial index `idx_epl_catalog_product_id` on `ebay_published_listings (catalog_product_id) WHERE catalog_product_id IS NOT NULL` (migration `1792000000001`) keeps the mirror subquery small. Before the index, the earlier per-row `EXISTS` form ran for over 120 s on a Fashion count.

### Facets and summary (one statement each, 2026-11-22)

`facets()` builds the filtered query once (`baseQuery` + `applySearchAndFilters`) and runs a single statement. `with filtered as materialized (...)` holds the matching rows, including the wide `vertical_attributes` column, which only the attribute facets read. `narrow as materialized (...)` holds the small columns that every other facet reads. Each facet is one `UNION ALL` branch that returns `(facet, facet_key, value, label, color, count, num)`, and the rows are mapped back to the unchanged response shape. Bucket facets keep the top 100 by count, with the value as tie-breaker so equal counts have a stable order. Marketplace facets join the caller's accessible stores and are omitted when that list is empty. `summary()` counts total, with-images and published rows in one scan with `COUNT(*) FILTER`.

Before this change, facets ran about 25 statements and the summary 3, each scanning `catalog_products`. On the Fashion organisation (22k rows) that was about 25 s of database time per facets request and about 9.5 s per summary.

The facet cache is per process. Entries live 30 seconds, expired entries are dropped on each write, and the cache holds at most 200 entries.

`idx_catalog_products_org_vertical_created` (migration `1792000000000`) on `catalog_products (organization_id, vertical, "createdAt" DESC, id)` matches the default `newest` sort. The first search page reads through the index (Fashion: about 630 ms → 14 ms).

Known remaining cost: a typed search (`q`) ranks every matching row with trigram `similarity()` over long text, about 12 s on the Fashion organisation. Fixing that needs a trigram index or a narrower match field, which is a product decision.

## Authorization and safety

Every request resolves organization membership, the requested product vertical, team visibility, and accessible stores on the backend. Publication summaries are limited to authorized stores; private review evidence and serialized-unit secrets are never returned.

Inline updates delegate to the vertical domain service. Quarantined or manual-review records are read-only. Bulk delete is a soft-delete lifecycle transition and fails closed for published, quarantined, or manual-review records. Fashion bulk publish additionally requires authenticity approval and dedicated Fashion stores.

The operation permissions are `fashion.catalog.export|delete|assign_team|manage_policies` and the corresponding `business_industrial.catalog.*` permissions. Schema changes are delivered through the additive migrations `1790300000000` through `1790800000000`; production startup runs pending migrations before serving traffic.

## Presentation

The shared workspace is table-first on desktop (`lg` and up). Title and summary sit above the primary add action, search, active filters, results toolbar, and table. B&I keeps a desktop filter column and opens filters in an accessible drawer on smaller screens. Fashion places brand, category, condition, status, stock, Fashion category, department, item type, size, color, and material in horizontal dropdowns above results; its Advanced Filters drawer is available at every viewport. Smaller screens show compact result cards instead of the eleven-column table. The results table contains its own horizontal scrolling. An empty catalog is distinct from a filtered search with no matches. Selection is page-local and clears when the organization, query, filters, sort, or page change. Export and bulk actions expose pending labels, and bulk APIs that return per-record `results` show failed ids. Publish job UI maps queue statuses to submitted, processing, published, partially failed, and failed, and closing the panel does not cancel the job. Quick view and the B&I publish dialog use full-height / bottom-sheet layouts on small screens with safe-area padding.
The shared workspace is table-first on desktop (`lg` and up). Title and summary sit above the primary add action, search, horizontal filter dropdowns, active filters, results toolbar, and table. Advanced criteria open in an accessible drawer at every viewport; small screens also show compact result cards instead of the eleven-column table. Fashion's top row exposes brand, category, condition, catalog status, stock, department, item type, size, color, and material. The results table contains its own horizontal scrolling. An empty catalog is distinct from a filtered search with no matches. Selection is page-local and clears when the organization, query, filters, sort, or page change. Export and bulk actions expose pending labels, and bulk APIs that return per-record `results` show failed ids. Publish job UI maps queue statuses to submitted, processing, published, partially failed, and failed, and closing the panel does not cancel the job. Quick view and the B&I publish dialog use full-height / bottom-sheet layouts on small screens with safe-area padding.

## Verification

Focused `CatalogWorkspaceService` authorization tests pass, and the frontend production build passes. On 2026-09-13 the mocked B&I catalog browser script passed (table identity, Manufacturer/MPN/inventory/shipping labels, no Motors Make/Fitment copy, mobile Filters drawer, refresh, quick view, and publish job phases). That run is fixture-backed, not live API integration. The backend build still reports the pre-existing syntax/type errors in `backend/src/scripts/backfill-brand-images.ts` *(outdated 2026-10-07: fixed, backend build compiles clean)*; no catalog or vertical module errors were reported.

## Runtime dependencies

The vertical publish and catalog runtime also registers the eBay Selling Metadata client, Inventory API item-group operations, retry-safe target vertical snapshots, listing vertical fields, image WebP conversion, and AI batch-total aggregation. These dependencies are included in the catalog release so the clean Docker build has the same contracts used by the vertical services.
