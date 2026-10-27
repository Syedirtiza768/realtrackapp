> ⚠️ MOVED → [/docs/context/FEATURE_REGISTRY.md](../context/FEATURE_REGISTRY.md) (2026-06-06)

# Product Features

Status legend: **Implemented** (working end-to-end) · **Partial** (present but
incomplete/unverified) · **Missing** (planned/scaffolding only) ·
**Needs verification** (code exists, behavior unconfirmed in this pass).

Derived from the route table (`src/App.tsx`), backend modules, and the prior
`docs/PRODUCT_FEATURE_CATALOG.md`. Where they disagree, trust code and re-verify.

| Feature | Frontend route | Backend module | Status | Notes |
|---------|---------------|----------------|--------|-------|
| Authentication (login/register/me) | `/login`, `/register`, `/forgot-password` | `auth` | Implemented | JWT; `forgot-password` flow **Needs verification** (no reset endpoint seen) |
| RBAC roles & permissions admin | `/settings/users`, `/settings/permissions` | `rbac` | Implemented | 8 roles, ~90 permissions, registry-driven |
| White-label / branding | `/settings/client` | `client-settings` | Implemented | Super-admin only; public branding endpoint |
| Dashboard / KPIs | `/` | `dashboard` | Implemented | Aggregation via BullMQ; cache table |
| Add Part (warehouse intake) | `/listings/new` | `listings` | Implemented | GridConnect-style: OEM/Aftermarket/Salvage, New/Used, Process SKU → inventory draft |
| Listing editor (edit) | `/listings/:id/edit` | `listings` | Implemented | AI-assisted; split preview |
| Listing revision history | `/listings/:id/history` | `listings` | Implemented | `ListingRevision` |
| AI listing generation | (in editor) | `listings` (`listing-generation.controller`) | Partial | OpenAI-backed; verify quality/limits |
| Listings v2 (cached) | — | `listings` (`listings-v2.controller`) | Partial | Redis cache interceptor |
| Export rules | — | `listings` (`export-rule.controller`) | Partial | Route on `/api/api/export-rules` ⚠️ |
| Catalog manager / search | `/catalog`, `/sku/:id` | `catalog-import` | Implemented | Faceted automotive search. Listing status badges: Published, Ready to Publish, Need Images, Needs Review (any unknown status also shows as Needs Review and never offers Publish) |
| Catalog CSV/bulk import | `/catalog/import` | `catalog-import` | Implemented | BullMQ; memory-heavy |
| Motors filters view | `/catalog/motors-filters` | `catalog-import` | Implemented | Motors-specific facets |
| Compliance audits | (catalog) | `catalog-import` (`compliance.controller`) | Partial | `catalog.compliance` |
| Ingestion (images/AI) | `/ingestion` | `ingestion` | Partial | Image enrichment + AI pipeline |
| Pipeline wizard | `/pipeline` | `ingestion` (`pipeline.controller`) | Partial | Multi-step enrichment; review queue |
| Motors Intelligence dashboard | `/motors`, `/motors/:id` | `motors-intelligence` | Partial | Candidate/attribute extraction, validation |
| Motors AI upload | `/motors/upload` | `motors-intelligence` | Partial | `motors.manage` |
| Motors review queue | `/motors/review` | `motors-intelligence` | Partial | Human-in-loop review |
| Fitment manager (YMMT) | `/fitment` | `fitment` | Implemented | Make/model/year/submodel/engine |
| VIN listings / lookup | `/fitment/vin` | `fitment` | Partial | `VinCache` |
| Inventory manager | `/inventory` | `inventory` | Implemented | Ledger, allocations, events, sync |
| Orders | `/orders` | `orders` | Implemented | eBay order import |
| eBay store integration | `/settings/integrations/ebay` | `integrations/ebay` | Implemented | Multi-account/multi-store OAuth |
| eBay store detail / policies | `/settings/integrations/ebay/:id[/policies]` | `integrations/ebay` | Partial | Business-policy mapping/sync |
| eBay publish wizard | `/catalog/products/:id/publish/ebay` | `channels/ebay` + `integrations/ebay` | Partial | Publish flow; verify against live API |
| eBay OAuth callback | `/channels/ebay/callback` | `integrations/ebay` | Implemented | Public callback |
| eBay/marketplace preview | `/preview` | `listings` | Implemented | Listing preview |
| Channels (multi-marketplace) | — | `channels` | Partial | Shopify/Amazon/Walmart scaffolding |
| AI enhancements (approve/apply) | — | `channels` (`ai-enhancement.controller`) | Partial | |
| Bulk actions | `/bulk-actions` | `listings` | Partial | `listings.update` |
| Automation rules | `/automation` | `automation` | Partial | Rule engine |
| Templates | `/templates` | `templates` | Implemented | Listing templates |
| Pricing intelligence | — (settings) | `pricing-intelligence` | Partial | Pricing rules/insights |
| Notifications (in-app + WS) | `/notifications` | `notifications` | Implemented | Socket.IO `notifications` namespace |
| Audit trail | `/audit` | `dashboard` (`audit-logs`) | Implemented | Auth + entity audit logs |
| Settings (tenant) | `/settings` | `settings` | Implemented | Pricing rules, shipping profiles |
| Storage / image assets | — | `storage` | Implemented | S3 + thumbnails + cleanup |
| Feature flags | — | `common/feature-flags` | Partial | Admin-gated; route on `/api/api/feature-flags` ⚠️ |
| Health checks | — | `health` | Implemented | `@Public()` |

## Warehouse stock and procurement (2026-10-05)

Shared by Auto Parts, Fashion and B&I at `/<workspace>/stock`. Design: [../architecture/WAREHOUSE_INVENTORY.md](../architecture/WAREHOUSE_INVENTORY.md).
- Warehouses and bins (grid generator, printable bin labels). Stock per SKU per bin. Serial and one-off unit tracking.
- Receive, adjust (with approval over a threshold), bin moves, damage/quarantine, transfers with in-transit, and blind cycle counts.
- Orders reserve stock automatically. Pick lists are grouped by warehouse and bin. Shipping deducts stock, and cancelling releases it.
- **Selling stock you don't hold yet:** SKUs can be *stocked*, *stock + source*, or *on demand*.
  - A shortfall raises a procurement request with the best supplier offer.
  - Requests become purchase orders. Received goods are reserved straight to the waiting order.
  - Suppliers can dropship directly to the buyer.
- Channel quantity per store = linked warehouse stock − buffer + capped supplier quantity. It runs in shadow mode until push is enabled per store.
- Weighted-average cost, valuation and aging reports, and a CSV-exportable ledger.

## Parts Search portal (2026-10-26)

`/parts-search` — search the whole PartsBazar360 catalogue from inside Omni Core. Anyone who can open the Auto Parts workspace can use it (same `dashboard.view` permission, same login).
- One search box understands OEM/part numbers in any separator format (`86401-12020`, `86401 12020`, `A 221 820 02 64`), partial numbers, typos and year/make/model phrases. Typeahead suggests parts, makes, categories and brands.
- Results show what the engine understood ("Part number: 8640112020"), why each part matched (OEM, interchange, superseded number), and say plainly when only related parts were found.
- Filters: make, model, year, category, brand, part type, condition, in stock, has photos; plus seller and source in the internal view. Every search is a shareable URL.
- **Internal view** (when `PARTSBAZAR360_SEARCH_API_KEY` is configured): every offer on a part, including paused/ended ones and offers hidden by the Superior priority rule, with seller, store, source tag and key, seller SKU, seller base price and per-warehouse stock, each labelled Live / Hidden / Outranked. Part pages add the import source records.
- Without the key, or if PartsBazar360's internal endpoint is unavailable, the portal shows the buyer view and says so.
- **Every sellable option (2026-10-27):**
  - **Number expansion:** a part number returns the exact part, superseded numbers, OEM and aftermarket equivalents (with a "why this part?" trail), and unverified cross-references in a collapsed group. Other-make parts that merely share digits are left out, compared by manufacturer family.
  - **Availability now:** checked against PartsBazar360's database at query time, not the search index; ended listings are hidden but counted. Omni Core's own automotive warehouse stock is listed first as "In our warehouse".
  - **Fitment:** pick make/model/year/engine or decode a VIN (or type it: "left headlight 2018 Audi Q5"). Each part gets *Fits / Likely fits / Not confirmed / Does not fit*. "Fits" needs catalogue or compatibility-table evidence for the right engine; title-derived data is at most "likely"; the wrong side is "does not fit".
  - **Never lose a sale:** searches with no results or no stock are logged as demand, staff can add a sourcing request, and `/parts-search/demand` lists top unsellable numbers, queries and vehicles plus open requests.
- Writes only to Omni Core's own `parts_search_events` (audit + demand). Nothing is written to PartsBazar360 or to fitment data. "Reserve / quote" is a placeholder.
- **Image downloads (2026-10-27):** from any result (gallery or the row's **Image** button) or the part page, download the full-size image or all images of a part as a zip. "Full size" means:
  - the original file for photos in Omni Core's storage, not a resized web copy;
  - eBay's largest rendition (1600 px) for eBay photos, or the stored size when eBay has nothing larger.

  Files are named after the part (`Toyota-86401-12020-1.jpg`).

## For each major module — quick reference

For purpose, key files, data flow, DB tables, permissions, and extension notes
per module see [/docs/architecture/codebase-map.md](../architecture/codebase-map.md),
[database.md](../architecture/database.md), and [api-map.md](../architecture/api-map.md).

Detailed business/feature narrative (sales-oriented) is preserved in
`docs/PRODUCT_FEATURE_CATALOG.md`.

## Branding note

The app shell shows "RealTrackApp"; the login screen / DB name use "ListingPro".
Standardize before external use. (Tracked in known-gaps.)
