# Feature Registry

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **2026-07-12 publish-readiness update:** A completed enrichment pipeline automatically enqueues its mandatory US/AU/DE listing optimization pass. That pass discovers and validates structured fitment before eBay Motors publishing; the queue handoff is idempotent and retries transient worker failures.

> **Source**: Extracted from `docs/product/features.md` (2026-05-29).
> Status legend: **Implemented** (working end-to-end) · **Partial** (present but incomplete/unverified) · **Missing** (planned/scaffolding only) · **Needs Verification** (code exists, behavior unconfirmed).

Derived from the route table (`src/App.tsx`), backend modules, and prior audits. Where docs and code disagree, trust code and re-verify.

| Feature | Frontend route | Backend module | Status | Notes |
|---------|---------------|----------------|--------|-------|
| Authentication (login/register/me) | `/login`, `/register`, `/forgot-password` | `auth` | Implemented | JWT; `forgot-password` flow **Needs verification** (no reset endpoint seen) |
| RBAC roles & permissions admin | `/auto-parts/settings/users`, `/auto-parts/settings/permissions` | `rbac` | Implemented | 8 roles, 73 permissions, registry-driven |
| White-label / branding | `/auto-parts/settings/client` | `client-settings` | Implemented | Super-admin only; public branding endpoint |
| Public vertical landing | `/` | — | Implemented | Public Omni Core overview with entry links for Auto Parts, Business & Industrial, and Fashion |
| Dashboard / KPIs | `/auto-parts` | `dashboard` | Implemented | Auto Parts aggregation via BullMQ; cache table |
| Listing editor (create/edit) | `/auto-parts/listings/new`, `/auto-parts/listings/:id/edit` | `listings` | Implemented | AI-assisted; split preview |
| Listing revision history | `/auto-parts/listings/:id/history` | `listings` | Implemented | `ListingRevision` |
| AI listing generation | (in editor) | `listings` (`listing-generation.controller`) | Partial | OpenAI-backed; verify quality/limits |
| Listings v2 (cached) | — | `listings` (`listings-v2.controller`) | Partial | Redis cache interceptor |
| Export rules | — | `listings` (`export-rule.controller`) | Partial | Route on `/api/api/export-rules` ⚠️ |
| Catalog manager / search | `/auto-parts/catalog`, `/auto-parts/sku/:id` | `catalog-import` | Implemented | Faceted search; organization/vertical/store/team scoped; legacy global paths redirect here |
| Catalog CSV/bulk import | `/auto-parts/catalog/import` | `catalog-import` | Implemented | BullMQ; memory-heavy; FEBI/Febi Bilstein and Lemförder imports retain one primary image, choosing the highest-resolution eBay candidate when dimensions are available |
| Motors filters view | `/auto-parts/catalog/motors-filters` | `catalog-import` | Implemented | Motors-specific facets |
| Compliance audits | (catalog) | `catalog-import` (`compliance.controller`) | Partial | `catalog.compliance` |
| Ingestion (images/AI) | `/auto-parts/ingestion` | `ingestion` | Partial | Image enrichment + AI pipeline |
| Pipeline wizard | `/auto-parts/pipeline` | `ingestion` (`pipeline.controller`) | Partial | Multi-step enrichment; review queue; pre-persistence Motors leaf-category guard synchronizes catalog and listing rows |
| Motors Intelligence dashboard | `/auto-parts/motors`, `/auto-parts/motors/:id` | `motors-intelligence` | Partial | Candidate/attribute extraction, validation |
| Motors AI upload | `/auto-parts/motors/upload` | `motors-intelligence` | Partial | `motors.manage` |
| Motors review queue | `/auto-parts/motors/review` | `motors-intelligence` | Partial | Human-in-loop review |
| Fitment manager (YMMT) | `/auto-parts/fitment` | `fitment` | Implemented | Make/model/year/submodel/engine; per-marketplace tree (US→`0`, AU→`15`, DE→`77`) |
| VIN listings / lookup | `/auto-parts/fitment/vin` | `fitment` | Partial | `VinCache` |
| Inventory manager | `/auto-parts/inventory` | `inventory` | Implemented | Soft-delete via `inventory.delete` (admin/super_admin default); ledger, allocations, events, sync; detail modal SKU inline-editable |
| Catalog browse | `/auto-parts/catalog` | `listings` | Implemented | Soft-delete via `listings.delete` (admin/super_admin default); search, publish, bulk ops |
| Orders | `/auto-parts/orders` | `orders` | Implemented | eBay order import |
| eBay store integration | `/auto-parts/settings/integrations/ebay` | `integrations/ebay` | Implemented | Multi-account/multi-store OAuth; per-store vertical configuration is additive and automotive remains the default |
| eBay product vertical pilots | `/catalog/import`, `/settings/integrations/ebay` | `verticals`, `catalog-import`, `channels/ebay` | Partial | Explicit Business & Industrial and Fashion intake/publish routing, category metadata, and Inventory API item groups; gated by disabled-by-default `multi_vertical_catalog`, with sandbox validation still required |
| eBay store detail / policies | `/auto-parts/settings/integrations/ebay/:id[/policies]` | `integrations/ebay` | Partial | Business-policy mapping/sync |
| eBay publish wizard | `/auto-parts/catalog/products/:id/publish/ebay` | `channels/ebay` + `integrations/ebay` | Implemented | Durable jobs support 500 listings/action and 5,000 listing/store targets/day; exact source listing/title preserved; named row policies resolve per target and fail closed on mismatch; structured fitment is replaced/read back in both Inventory and legacy Trading APIs, including reused-offer cleanup; source-empty/rejected fitment repairs are exact zero-row operations with sibling-SKU audit support and fresh-SKU recovery when eBay retains a stale projection; source images are uploaded to eBay Picture Services and cached per store before publish; FEBI/Febi Bilstein and Lemförder publish with one resolution-aware primary image; account-level `BLA-` collisions use an availability-checked postfix-free `BLAP-` alternate and remain fail-closed if both are occupied |
| eBay OAuth callback | `/channels/ebay/callback` | `integrations/ebay` | Implemented | Public callback |
| eBay/marketplace preview | `/auto-parts/preview`, `/auto-parts/catalog/products/:id` (edit) | `listings` | Implemented | Listing preview; seller description edits use Visual (WYSIWYG) + HTML toggle (`RichTextDescriptionEditor`) |
| Channels (multi-marketplace) | — | `channels` | Partial | Shopify/Amazon/Walmart scaffolding |
| AI enhancements (approve/apply) | — | `channels` (`ai-enhancement.controller`) | Partial | |
| Bulk actions | `/auto-parts/bulk-actions` | `listings` | Partial | `listings.update` |
| Automation rules | `/auto-parts/automation` | `automation` | Partial | Rule engine |
| Templates | `/auto-parts/templates` | `templates` | Implemented | Listing templates |
| Pricing intelligence | — (settings) | `pricing-intelligence` | Partial | Pricing rules/insights |
| Notifications (in-app + WS) | `/auto-parts/notifications` | `notifications` | Implemented | Socket.IO `notifications` namespace |
| Audit trail | `/auto-parts/audit` | `dashboard` (`audit-logs`) | Implemented | Auth + entity audit logs |
| Settings (tenant) | `/auto-parts/settings` | `settings` | Implemented | Pricing rules, shipping profiles |
| Storage / image assets | — | `storage` | Implemented | S3 + thumbnails + cleanup; application-wide S3/CDN image reads prefer a sibling `.webp` object and fall back to the original extension through the image proxy |
| Image Drive (file manager) | `/auto-parts/image-drive` | `storage` (`image-drive.*`) | Implemented | Google Drive-style folder browser; S3-backed; auto-generates thumb/medium WebP variants; optional part-number linking for auto-attach to listings; recursive drag/drop folder upload maps likely part-number subfolders and preserves nested paths; bulk pipeline finalization matches manufacturer/OEM part numbers to Image Drive folders, replaces warehouse/bin placeholders, prepends matched CDN URLs, and updates listing/catalog image fields; folder/file thumbnails expose browser-safe URLs through CDN/proxy; search, bulk delete, file preview lightbox, copy URL, download, pagination, sort options |
| Published listings CSV export | (in published listings page) | `published-listings` | Implemented | `published_listings.export` permission; exports filtered results as CSV |
| Feature flags | — | `common/feature-flags` | Partial | Admin-gated; route on `/api/api/feature-flags` ⚠️ |
| Health checks | — | `health` | Implemented | `@Public()` |
| Auto category lookup (backfill + import) | — | `catalog-import` (`CategoryLookupService`) | Implemented | eBay Taxonomy API; backfill endpoint + import pipeline hook |

## B&I image intake and inventory projection (2026-09-11)

## B&I catalogue experience (2026-09-11)

The B&I listings route now uses a list-first catalogue surface aligned with the
Auto Parts catalogue interaction model. It supports organization-scoped search,
filters, sorting, pagination, selection, CSV export, detail review, publication
status, and B&I-specific publish actions. The technical editor remains at
/business-industrial/listings/editor and accepts an edit query parameter.

Status: Implemented and deployed to `app.omnicoreholding.com` on 2026-09-12.
The active-organization propagation fix is live. The image-intake page accepts a public Drive
folder URL or a local folder and queues a server-side import for up to 200 item
folders. The worker retains every supported image in each folder up to the
5,000-image job cap, while using a bounded 12-image slice for model evidence;
decimal dot-suffix folders remain grouped as multiple instances of one base
item. It converts every stored source image to WebP, runs explicit GPT-5.6
Luna vision plus evidence-bound text enrichment, prices through eBay Browse
and the shared pricing-analysis pipeline, logs token/cost totals, creates
reviewable B&I catalog drafts, and projects those drafts into the shared
Inventory workbench. Reruns merge into the normalized existing B&I SKU. The
import requires GOOGLE_DRIVE_API_KEY and does not publish automatically.

## Shared vertical catalog parity (2026-09-12)

| Feature | Frontend route | Backend module | Status | Notes |
|---------|----------------|----------------|--------|-------|
| Shared Fashion catalog | `/fashion/catalog` (legacy `/fashion/listings`) | `catalog` + `verticals` | Implemented | Server-side search, loading-safe checkbox facets with search/collapse, URL/session state, quick view, drag-reorder image management, bulk actions, export, publication summaries, and durable publish progress/error details. |
| Shared Business & Industrial catalog | `/business-industrial/catalog` (legacy `/business-industrial/listings`) | `catalog` + `verticals` | Implemented and deployed | Reuses the Auto Parts table-first catalog hierarchy and complete shared actions, now with a mobile filter drawer, empty vs no-match states, mixed selection checkboxes, pending export/bulk feedback, and publish phases (submitted/processing/published/partially failed/failed). Facets cover brand/manufacturer, eBay category, condition (label when ID is null), review/validation status, stock, and populated B&I attributes (category family, manufacturer, model, MPN, inventory/shipping mode, industrial technical fields). Results show condition and image counts. Quick view hydrates the canonical record, displays all stored images with lightbox navigation/zoom, and supports image reorder/upload. Single publish runs B&I account-targeted validation before queueing, loads connected-account policies/location, and persists the selected store mapping through the worker; bulk publish supports dedicated B&I stores with server-side compliance checks and progress details. The B&I editor remains at `/business-industrial/listings/editor`. |

The shared catalog API reads the organization and vertical from the authenticated request, applies team visibility and accessible-store publication filtering, and never returns private review evidence or serialized-unit secrets. The frontend forwards the selected organization for every shared-catalog read, mutation, and export path, while row and bulk publish controls reflect the server-side compliance approval gate. Soft delete is represented by the existing catalog_products.vertical_validation_status=deleted lifecycle value because the common entity has no deleted-at column; published or quarantined products cannot be deleted through these bulk actions.

The active-organization propagation and publish-gating correction is deployed
to `app.omnicoreholding.com`; publish remains fail-closed until B&I compliance
approval and an authorized eBay store are available.

The 2026-09-13 shared-workspace repair also makes category facet values
consistent with the server query, avoids empty multi-select boxes while facets
load, keeps secondary facets collapsed until needed, and terminates partial
publish polling while showing normalized target errors. These behaviors belong
to the shared workspace so future verticals inherit them automatically.

## Summary

| Status | Count |
|--------|-------|
| Implemented | ~26 |
| Partial | ~13 |
| Missing | 0 |
| Needs Verification | 2 |

## Branding Note

The user-facing application and login are branded "Omni Core"; the internal database name remains `listingpro`.

## Related Docs

- Per-module details: [SYSTEM_MAP.md](SYSTEM_MAP.md) and [/docs/backend/MODULE_MAP.md](../backend/MODULE_MAP.md)
- Database tables: [/docs/architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md)
- API endpoints: [/docs/architecture/API_CONTRACTS.md](../architecture/API_CONTRACTS.md)
- Legacy business narrative: `docs/PRODUCT_FEATURE_CATALOG.md` (LEGACY REFERENCE)

---

*Reorganized: 2026-06-06. Updated: 2026-08-19.*

## Fashion vertical implementation note (2026-09-09)

The Fashion vertical is now a separate workspace surface at /fashion with dedicated login, navigation, listing drafts, bulk import, authenticity review, store configuration, vertical-tagged eBay OAuth, and Fashion RBAC roles. It remains gated by the existing multi_vertical_catalog rollout flag for store enablement and publishing. The UI and API are implemented, but sandbox eBay category/variation verification and production migration/deployment remain pending.

## Business & Industrial vertical implementation note (2026-09-09)

The B&I vertical has a separate `/business-industrial` login and Auto Parts–
aligned workspace shell (`VerticalWorkspaceShell`: persistent sidebar, mobile
drawer), explicit technical listing/import forms, organization-scoped review and
incident queues, private serialized-unit storage, dedicated eBay OAuth,
category/policy metadata, publish-job/channel controls, vertical roles, and an
idempotent admin seed command. The shared eBay worker enforces B&I approval,
quarantine, leaf-category metadata, measurable units, and shipping evidence.
Verified tracked offers are withdrawn and remote `UNPUBLISHED` state is checked
before incident release. The feature remains gated by `multi_vertical_catalog`
for store enablement and publishing.

Status: Implemented and deployed. Admin-created accounts use a temporary
password flow; a public invite-acceptance flow is not used.

## B&I AI image intake (2026-09-10)

Status: Implemented and deployed to `app.omnicoreholding.com` on 2026-09-10.
The comprehensive editor, retry, validation, and publish tracking are active.
The Image intake screen accepts Image Drive-style folder trees, groups
final numeric dot-suffixed instances, uploads organization-scoped assets, runs
vision/OCR identification, resolves verified eBay leaf categories and item
specifics, exposes confidence/warnings, exports Excel, and creates reviewable
B&I drafts. It does not auto-publish or treat AI price/specification output as
authoritative. Failed runs retry only failed/pending groups with a fresh queue
attempt; successful and draft-created groups are preserved.
