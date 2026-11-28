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

### Typed search (`q`, 2026-11-22)

A typed search matches the search document with `ILIKE '%q%'` or pg_trgm `similarity(document, q) > 0.15`. Results are ranked by relevance: 100 for an exact SKU, otherwise the similarity, ordered DESC with `id` ASC as tie-break. The document is `concat_ws(' ', sku, title, brand, mpn, category_id, category_name, description, part_type, source_file, location, vertical_attributes::text)`. Results, totals, facet counts and order are unchanged by the work below; only the speed changed.

- **Stored document.** Migration `1792000000002` stores the document in `catalog_products.search_text`, and its number of distinct trigrams in `search_trgm_count`. The trigger `trg_catalog_products_search_text` keeps both current on every insert and update. When an update leaves the document unchanged (stock, price and status writes), the trigger keeps the stored value and does not recompute the trigrams. The application never writes these columns (`insert: false, update: false, select: false` on the entity).
- **Indexes.** `idx_catalog_products_search_text_trgm` (GIN `gin_trgm_ops` on `search_text`) serves the `ILIKE`. `idx_catalog_products_search_trgm_count` on `(organization_id, vertical, search_trgm_count)` serves the fuzzy arm. The planner combines them with a `BitmapOr`.
- **Fuzzy arm bound.** pg_trgm computes similarity as c / (|q| + |doc| − c), so it never exceeds min(|q|, |doc|) / max(|q|, |doc|). A row with more than |q| / 0.15 trigrams therefore cannot pass. The predicate adds `search_trgm_count <= (|q| * 20) / 3 + 1`. It is computed in integers so it is indexable, and the `+ 1` absorbs float4 rounding at the exact bound (3/20 rounds to just above 0.15). Fashion documents have 56–2,545 trigrams, so for ordinary queries the fuzzy arm visits no rows instead of all 22k.
- **Relevance page.** `relevancePage()` returns the same page without scoring every match. Each match gets an upper bound on its score from the stored counts. Exact scores are computed for the K + 250 matches with the highest bounds (K = offset + limit). Taking the K-th best of those, only rows whose bound reaches it (with a 1.000001 float margin) are also scored. The statement returns the total and the ordered ids together, and the products are then loaded by id. Other sorts with a query (newest, title, price, SKU) use the plain paged query with the new predicate.
- **Measured on a copy of production data** (same Postgres image and locale): "dress" 11 s → 72 ms (573 matches); "black" 11 s → about 2 s (15k matches). One- or two-character queries have no indexable trigram and still read every Fashion row, about 1.5 s. An exhaustive comparison of 77 queries × 5 pages × 2 verticals found no difference against the old SQL.
- **Operations.** The migration runs the backfill and the index builds with `statement_timeout = 0`. The brief table locks are taken under a 5 s `lock_timeout` and retried. Revert with `migration:revert -t none`, because TypeORM wraps a revert in a transaction and `DROP INDEX CONCURRENTLY` would fail. Never disable triggers on `catalog_products` (`DISABLE TRIGGER`, `session_replication_role = replica`): rows written that way get no search document and are missing from typed search. After a Postgres, Alpine/musl or locale upgrade, set `search_trgm_count = NULL` in batches to recompute the counts, and `REINDEX CONCURRENTLY` the GIN index.

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
