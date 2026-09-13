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

## Authorization and safety

Every request resolves organization membership, the requested product vertical, team visibility, and accessible stores on the backend. Publication summaries are limited to authorized stores; private review evidence and serialized-unit secrets are never returned.

Inline updates delegate to the vertical domain service. Quarantined or manual-review records are read-only. Bulk delete is a soft-delete lifecycle transition and fails closed for published, quarantined, or manual-review records. Fashion bulk publish additionally requires authenticity approval and dedicated Fashion stores.

The operation permissions are `fashion.catalog.export|delete|assign_team|manage_policies` and the corresponding `business_industrial.catalog.*` permissions. Schema changes are delivered through the additive migrations `1790300000000` through `1790800000000`; production startup runs pending migrations before serving traffic.

## Presentation

The shared workspace is table-first on desktop (`lg` and up). Title and summary sit above the primary add action, search, active filters, results toolbar, and table. Desktop keeps a filter column; viewports below `lg` open filters in an accessible drawer and show compact result cards instead of the eleven-column table. The results table contains its own horizontal scrolling. An empty catalog is distinct from a filtered search with no matches. Selection is page-local and clears when the organization, query, filters, sort, or page change. Export and bulk actions expose pending labels, and bulk APIs that return per-record `results` show failed ids. Publish job UI maps queue statuses to submitted, processing, published, partially failed, and failed, and closing the panel does not cancel the job. Quick view and the B&I publish dialog use full-height / bottom-sheet layouts on small screens with safe-area padding.

## Verification

Focused `CatalogWorkspaceService` authorization tests pass, and the frontend production build passes. On 2026-09-13 the mocked B&I catalog browser script passed (table identity, Manufacturer/MPN/inventory/shipping labels, no Motors Make/Fitment copy, mobile Filters drawer, refresh, quick view, and publish job phases). That run is fixture-backed, not live API integration. The backend build still reports the pre-existing syntax/type errors in `backend/src/scripts/backfill-brand-images.ts`; no catalog or vertical module errors were reported.

## Runtime dependencies

The vertical publish and catalog runtime also registers the eBay Selling Metadata client, Inventory API item-group operations, retry-safe target vertical snapshots, listing vertical fields, image WebP conversion, and AI batch-total aggregation. These dependencies are included in the catalog release so the clean Docker build has the same contracts used by the vertical services.
