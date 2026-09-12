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

## Verification

Focused `CatalogWorkspaceService` authorization tests pass, and the frontend production build passes. The backend build still reports the pre-existing syntax/type errors in `backend/src/scripts/backfill-brand-images.ts`; no catalog or vertical module errors were reported.
