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
| Listing editor (create/edit) | `/listings/new`, `/listings/:id/edit` | `listings` | Implemented | AI-assisted; split preview |
| Listing revision history | `/listings/:id/history` | `listings` | Implemented | `ListingRevision` |
| AI listing generation | (in editor) | `listings` (`listing-generation.controller`) | Partial | OpenAI-backed; verify quality/limits |
| Listings v2 (cached) | — | `listings` (`listings-v2.controller`) | Partial | Redis cache interceptor |
| Export rules | — | `listings` (`export-rule.controller`) | Partial | Route on `/api/api/export-rules` ⚠️ |
| Catalog manager / search | `/catalog`, `/sku/:id` | `catalog-import` | Implemented | Faceted automotive search |
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

## For each major module — quick reference

For purpose, key files, data flow, DB tables, permissions, and extension notes
per module see [/docs/architecture/codebase-map.md](../architecture/codebase-map.md),
[database.md](../architecture/database.md), and [api-map.md](../architecture/api-map.md).

Detailed business/feature narrative (sales-oriented) is preserved in
`docs/PRODUCT_FEATURE_CATALOG.md`.

## Branding note

The app shell shows "RealTrackApp"; the login screen / DB name use "ListingPro".
Standardize before external use. (Tracked in known-gaps.)
