# Feature Registry

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **2026-07-12 publish-readiness update:** A completed enrichment pipeline automatically enqueues its mandatory US/AU/DE listing optimization pass. That pass discovers and validates structured fitment before eBay Motors publishing; the queue handoff is idempotent and retries transient worker failures.

> **Source**: Extracted from `docs/product/features.md` (2026-05-29).
> Status legend: **Implemented** (working end-to-end) · **Partial** (present but incomplete/unverified) · **Missing** (planned/scaffolding only) · **Needs Verification** (code exists, behavior unconfirmed).

Derived from the route table (`src/App.tsx`), backend modules, and prior audits. Where docs and code disagree, trust code and re-verify.

Pipeline title enrichment reuses saved exact-MPN OEM intervals only when their
cited application uniquely matches the MVL-validated target model/trim. This
  prevents duplicate catalog searches while keeping the evidence review-only and
  out of publish compatibility. New OEM searches include manufacturer-diagram
  part-name synonyms, classify sources from cited body text as well as page
  titles/URLs, and parse exact-MPN Exa citation bodies even when GPT-6 Luna's
  JSON summary is cut short. The lookup performs one capped search and makes
  one alternate exact-MPN search only if the first response is truncated or
  fails source validation. Product-page application ranges are bounded by a
  same-option-code replacement row;
  exact OEM intervals can guide draft titles even when the marketplace MVL has
  no matching model, but remain review-only and outside publish compatibility.
  Combined `Plymouth Prowler` brand values are split for exact part lookups. See
  v20 in
  `docs/operations/CATALOG_PIPELINE.md`.

| Feature | Frontend route | Backend module | Status | Notes |
|---------|---------------|----------------|--------|-------|
| FEBEST pre-enriched import | `/auto-parts/pipeline` | `ingestion` (`pipeline.controller`, `pipeline.processor`) | Partial | Explicit `pre_enriched_febest_v1` selector, exact Manifest/Products/Fitments validator, dry-run endpoint, draft-only trusted persistence; current run remains BLOCKED on 886 products without accepted US-MVL mappings, 8 unresolved official-evidence products, and the separate production collision dry-run |
| Authentication (login/register/me) | `/login`, `/register`, `/forgot-password` | `auth` | Implemented | JWT; `forgot-password` flow **Needs verification** (no reset endpoint seen) |
| RBAC roles & permissions admin | `/auto-parts/settings/users`, `/auto-parts/settings/permissions` | `rbac` | Implemented | 8 roles, 73 permissions, registry-driven |
| White-label / branding | `/auto-parts/settings/client` | `client-settings` | Implemented | Super-admin only; public branding endpoint; default `themeMode` is `light` |
| Public vertical landing | `/` | — | Implemented | Responsive editorial overview with illustrative product subjects, synthetic workflow walkthrough, FAQ, catalog-status example, branding-aware header/footer, and entry links for Auto Parts, Business & Industrial, and Fashion |
| Dashboard / KPIs | `/auto-parts` | `dashboard` | Implemented | Auto Parts aggregation via BullMQ; cache table |
| Listing editor (create/edit) | `/auto-parts/listings/new`, `/auto-parts/listings/:id/edit` | `listings` | Implemented | Add Part saves an unidentified draft without MPN-only title lookup. Optional Image Drive lookup and identification run after the draft response; Image Drive cannot replace photos attached after save. Automatic identification starts after at least two photos; managed photos are read with server credentials. Complete OCR token evidence retains the entered number when several identifiers are printed on the assembly. Inconclusive evidence fails closed for operator review and Inventory shows `Needs review`; `Needs photo` is reserved for explicit missing-photo/coverage errors. Provider errors remain distinct from photo mismatches; AI output reservations are bounded by default. The browser stops waiting after 45 seconds and tells the operator to check Inventory before retrying. |
| Listing revision history | `/auto-parts/listings/:id/history` | `listings` | Implemented | `ListingRevision` |
| AI listing generation | (in editor) | `listings` (`listing-generation.controller`) | Partial | OpenAI-backed; verify quality/limits |
| Listings v2 (cached) | — | `listings` (`listings-v2.controller`) | Partial | Redis cache interceptor |
| Export rules | — | `listings` (`export-rule.controller`) | Partial | Route on `/api/api/export-rules` ⚠️ |
| Catalog manager / search | `/auto-parts/catalog`, `/auto-parts/sku/:id` | `catalog-import` | Implemented | Faceted search; organization/vertical/store/team scoped; legacy global paths redirect here; manual-review and protected lifecycle holds display as `Needs Review` and are excluded from `Ready to Publish`; unknown API statuses fail closed as `Needs Review` instead of crashing the page; inventory detail opens with a larger primary part photo and visible additional photo thumbnails, and full-size zoom uses the same-origin image proxy for private S3 assets; results identify each publication's eBay marketplace and store on desktop and mobile, and flag missing destination details |
| Catalog CSV/bulk import | `/auto-parts/catalog/import` | `catalog-import` | Implemented | BullMQ; checkpoints committed rows before image mirroring, skips saved row outcomes on retry, resumes incomplete Fashion WebP mirrors from preserved source URLs, and retries transient failures; permanently unavailable/invalid images remain warnings and keep Fashion drafts blocked from publishing; memory-heavy; FEBI/Febi Bilstein and Lemförder imports retain one primary image, choosing the highest-resolution eBay candidate when dimensions are available |
| Catalog publish-readiness checks | `/auto-parts/catalog/motors-filters` and catalog product views | `catalog-import` | Implemented | Duplicate fitment review distinguishes year/make/model rows with different trims, engines, or platforms; case/spacing-only copies of the same normalized MVL record do not block readiness, while conflicting rows still require review. U.S. marketplace readiness accepts one item image, consistent with [eBay image guidance](https://developer.ebay.com/api-docs/sell/static/inventory/managing-image-media.html). |
| Motors filters view | `/auto-parts/catalog/motors-filters` | `catalog-import` | Implemented | Motors-specific facets |
| Compliance audits | (catalog) | `catalog-import` (`compliance.controller`) | Partial | `catalog.compliance` |
| Ingestion (images/AI) | `/auto-parts/ingestion` | `ingestion` | Partial | Image enrichment + AI pipeline |
| Business & Industrial image intake | `/business-industrial/image-intake` | `verticals` (`business-industrial-image-intake`) | Implemented | Public Drive/local image intake; every direct folder with images becomes an independent draft; exact folder names, decimal suffixes, `BNI-` SKUs, source-aware collision suffixes, separate MPN, all images, Luna enrichment, evidence-based pricing, and complete parcel fulfillment defaults are preserved; stale interrupted groups are retryable and required eBay aspects use only category-approved uncertainty values or evidence-backed derivations; no marketplace publish is performed |
| Pipeline wizard | /auto-parts/pipeline | ingestion (pipeline.controller) | Partial | Multi-step enrichment; review queue; pre-persistence Motors leaf-category guard synchronizes catalog and listing rows; title optimization uses explicit donor fields or a matching YYYY MAKE [MODEL] plus 17-character VIN source filename before fitment discovery when donor data is missing; make normalization and donor parsing canonicalize the known `Bently` typo to `Bentley`; exact Brand+MPN eBay Browse hints use the canonical donor make when available; when no MVL-checked exact-part range exists, GPT-6 Luna compares cited OEM catalog results for the complete exact-MPN target model/trim range; it accepts separate catalog model/trim fields and maps combined model strings to a canonical MVL model only when the remaining target variant tokens can be preserved as trim; equivalent detailed trim wording can contribute to one complete contiguous title range only when the requested variant tokens and canonical MVL model match; when MVL omits individual years, an explicit inclusive interval from cited exact-MPN OEM evidence may guide the draft title only if its make/model/trim matches; exact-part source rows stay `needs_review` in `fitment_rows` and are excluded from publish compatibility; no donor year or platform-generation span supplies title years; missing range/model evidence blocks optimization; unambiguous model context can be inherited from vehicle-prefixed source titles in the same pipeline job; optimization-version changes prevent stale completed results from being skipped on a later optimization pass; deterministic title generation continues if an AI batch fails; Image Drive resolves by normalized manufacturer/OE part number or SKU, resolved images are written into CSV/XLSX outputs, and missing coverage is surfaced per job |
| Motors Intelligence dashboard | `/auto-parts/motors`, `/auto-parts/motors/:id` | `motors-intelligence` | Partial | Candidate/attribute extraction, validation |
| Motors AI upload | `/auto-parts/motors/upload` | `motors-intelligence` | Partial | `motors.manage` |
| Motors review queue | `/auto-parts/motors/review` | `motors-intelligence` | Partial | Human-in-loop review |
| Fitment manager (YMMT) | `/auto-parts/fitment` | `fitment` | Implemented | Make/model/year/submodel/engine; per-marketplace tree (US→`0`, AU→`15`, DE→`77`) |
| VIN listings / lookup | `/auto-parts/fitment/vin` | `fitment` | Partial | `VinCache` |
| Inventory manager | `/auto-parts/inventory` | `inventory` | Implemented | Soft-delete via `inventory.delete` (admin/super_admin default); ledger, allocations, events, sync; detail modal SKU inline-editable |
| Catalog browse | `/auto-parts/catalog` | `listings` | Implemented | Soft-delete via `listings.delete` (admin/super_admin default); search, publish, bulk ops |
| Orders | `/auto-parts/orders` | `orders` | Implemented | eBay order import |
| eBay store integration | `/auto-parts/settings/integrations/ebay` | `integrations/ebay` | Implemented | Multi-account/multi-store OAuth; per-store vertical configuration is additive and automotive remains the default |
| eBay product vertical pilots | `/catalog/import`, `/settings/integrations/ebay` | `verticals`, `catalog-import`, `channels/ebay` | Partial | Explicit Business & Industrial and Fashion intake/publish routing, category metadata, and Inventory API item groups; gated by disabled-by-default `multi_vertical_catalog`, with sandbox validation still required; B&I approval gating can be temporarily bypassed for operator-led publishing with `BUSINESS_INDUSTRIAL_ALLOW_UNAPPROVED_PUBLISH=true` |
| eBay store detail / policies | `/auto-parts/settings/integrations/ebay/:id[/policies]` | `integrations/ebay` | Partial | Business-policy mapping/sync |
| eBay publish wizard | `/auto-parts/catalog/products/:id/publish/ebay` | `channels/ebay` + `integrations/ebay` | Implemented | Durable jobs support 500 listings/action and 5,000 listing/store targets/day; catalog review holds are rechecked by the durable publish validator before any eBay request; exact source listing/title preserved; named row policies resolve per target and fail closed on mismatch; structured fitment is replaced/read back in both Inventory and legacy Trading APIs, including reused-offer cleanup; new Trading API fixed-price listings track by ItemID while retaining an editable Custom Label SKU; existing ManageBySKU listings require relisting to change the label; ended legacy Trading listings that reject revision with error 291 are relisted and their new ItemID/URL is saved; uncertain relist outcomes do not auto-retry; source images are uploaded to eBay Picture Services and cached per store before publish; New-condition galleries append shared WebP images F1, F2, F3 at the end; the dry-run-first historical backfill updates application image fields only and does not revise live eBay listings; eBay publishing caps each listing quantity at 10; FEBI/Febi Bilstein and Lemförder publish with one resolution-aware primary image; account-level `BLA-` collisions use an availability-checked postfix-free `BLAP-` alternate and remain fail-closed if both are occupied |
| eBay OAuth callback | `/channels/ebay/callback` | `integrations/ebay` | Implemented | Public callback |
| eBay/marketplace preview | `/auto-parts/preview`, `/auto-parts/catalog/products/:id` (edit) | `listings` | Implemented | Listing preview; seller description edits use Visual (WYSIWYG) + HTML toggle (`RichTextDescriptionEditor`); Type item-specific edits persist to the catalog product's `partType` field |
| Channels (multi-marketplace) | — | `channels` | Partial | Shopify/Amazon/Walmart scaffolding |
| Publish to PartsBazar360 | Settings → Channels (link seller); listing detail → Channels tile; catalog bulk bar → More | `channels/partsbazar360` | Implemented (deployed and verified with one live listing 2026-09-29) | Push channel into partsbazar360.com via its authenticated `/integrations/realtrack/listings` endpoint; async import with status polling; only MVL-validated fitment; needs a title, price > 0 and an image; stock/price changes require re-publish. See `docs/integrations/partsbazar360-publish.md` |
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
| Published listings CSV export | (in published listings page) | `published-listings` | Implemented | `published_listings.export` permission; exports filtered results as CSV in pages of up to 10,000 rows, selected with `page` |
| Primemotive external listing feed | `/api/published-listings/primemotive` | `published-listings` | Deployed; verified 2026-11-03 | Reads RealTrackApp DB mirror only; active Primemotive listings with non-empty eBay IDs; snapshot paging uses stable UUID cursor/revisions; no item-specific make filter, so MotoArk applies targeting; optional `includeCatalogData=true` returns linked catalog source values without treating them as canonical Partslink24 data; `published_listings.external_feed` |
| Primemotive listing changes and push webhooks | `/api/published-listings/primemotive/changes` + configured callback | `published-listings` | Pull feed deployed and verified; outbound callback inactive | Durable DB outbox tracks listing additions, edits, ended/deleted rows; committed sequence cursors and per-listing revisions; optional outbound HMAC webhook with retry/backoff via `PRIMEMOTIVE_LISTING_WEBHOOK_URL`, `PRIMEMOTIVE_LISTING_WEBHOOK_SECRET`, and `PRIMEMOTIVE_LISTING_WEBHOOK_ORGANIZATION_ID`; push remains idle until all are configured |
| Primemotive external sale events | `/api/published-listings/primemotive/webhooks/sales` | `published-listings` | Deployed; fixture-only receipt verified 2026-11-03 | Receipt-only `listing.sold`; database-backed atomic deduplication/payload conflict detection; existing signing key preserved and standard Compose forwarding added; does not change stock |
| MotoArk order lifecycle and stock synchronization | `/api/integrations/motoark/order-events`, status and quantities | `integrations/motoark` + `stock` | Deployed 2026-11-03; stock remains gated | Atomic inbox/stock processing, partial cancellations/shipments, linked returns/quarantine/inspection, independent refunds, scoped quantity/status reads; marketplace pushes off; 0 mapped inventory items in the bounded 200-row sample, so use verified warehouse counts and keep unmapped sales pending; see [contract](../architecture/MOTOARK_ORDER_LIFECYCLE.md) |
| Primemotive test listings | Seed command + minute scheduler | `published-listings` | Runtime restored; scheduler not separately verified 2026-11-03 | Synthetic records are marked; when enabled, the simulator changes only synthetic DB rows and makes no eBay calls. Simulator scheduling was not separately exercised in the MotoArk rollout. |
| Published listing revisions | `/auto-parts/published-listings/:id` | `published-listings` | Implemented | Inventory API listings are revised from the detail page's Quick revise form; eBay Seller Hub does not support editing these listings |
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
folder URL or a local folder and queues a server-side import for every direct product folder. The worker retains every supported image in each folder; local uploads keep the
separate 5,000-image safety limit, while using a bounded 12-image slice for model evidence;
decimal dot-suffix folders remain independent listings. It converts every stored source image to WebP, runs explicit GPT-5.6
Luna vision plus evidence-bound text enrichment, prices through eBay Browse
and the shared pricing-analysis pipeline, logs token/cost totals, creates
reviewable B&I catalog drafts, and projects those drafts into the shared
Inventory workbench. Reruns overwrite the exact-folder existing B&I SKU in place. The
import requires GOOGLE_DRIVE_API_KEY and does not publish automatically.

## Shared vertical catalog parity (2026-09-12)

| Feature | Frontend route | Backend module | Status | Notes |
|---------|----------------|----------------|--------|-------|
| Shared Fashion catalog | `/fashion/catalog` (legacy `/fashion/listings`) | `catalog` + `verticals` | Implemented | Server-side search, loading-safe checkbox facets with search/collapse, URL/session state, quick view, drag-reorder image management, bulk actions, export, publication summaries, and durable publish progress/error details. Horizontal dropdowns above results expose brand, category, condition, catalog status, stock, department, item type, size, color, and material; less-used filters stay in Advanced Filters. Add Item opens the photos-first Fashion editor. Automotive MPN filters are omitted. |
| Fashion photos-first Add Item | `/fashion/listings/new` | `verticals` | Implemented | Camera and file upload accumulate one garment photo set; explicit Identify from photos uses the shared vision provider; category-aware Fashion attributes; manual continue without AI; save/reopen preserves photos and fields. |
| Fashion source-export import | `/catalog/import` → `/fashion/catalog` | `catalog-import` + `verticals` | Partial | Maps source item specifics and unit-unspecified measurements into editable Fashion drafts; requires unit confirmation for measurements; copies export photos to application S3 as WebP; incomplete image mirrors block publishing; durable row checkpoints and bounded retries resume transient failures; permanent source-image failures remain reviewable warnings; no new SQL schema. |
| Fashion quick capture | `/fashion/capture` | `verticals` (`FashionIntakeController`) | Implemented | Phone-first batch/SKU and photo-slot intake; camera and upload controls remain visible while SKU is missing, with upload enabled after SKU entry or one-tap generation for a selected batch. Every uploaded source image is normalized to WebP. Save queues identification in the background and leaves processed items in intake until explicitly added to Catalog. Store selection happens later in Catalog. |
| Fashion intake history | `/fashion/intake` | `verticals` | Implemented | Paginated capture log with batch/status/search filters, identification badges, retry, and an Add to Catalog action for processed, non-quarantined items. |
| Fashion activity report | `/fashion/reports` | `verticals` + `catalog` | Implemented | Filterable report and CSV export track uploader, Catalog adder, item attributes, processing/review status, publication store, policy and outcome. |
| Fashion measurement charts & size-chart image | editor + capture | `verticals` | Implemented | 10 garment templates, cm/in, values in description, generated WebP chart; not sent as item specifics. |
| Fashion photo slots & banners | editor + capture | `verticals` | Implemented | Front/Back/Tag/Additional/Size chart slots (`_photoRoles`), per-photo text banners. |
| Fashion warehouses | `/fashion/settings` | `verticals` | Implemented | Organization warehouse list; recorded on intake items only (does not change eBay ship-from). |
| Shared Business & Industrial catalog | `/business-industrial/catalog` (legacy `/business-industrial/listings`) | `catalog` + `verticals` | Implemented and deployed | Reuses the Auto Parts table-first catalog hierarchy and complete shared actions, with direct table-header sorting plus MPN/category/condition/price-stock/image/date/publication filters, a mobile filter drawer, empty vs no-match states, mixed selection checkboxes, pending export/bulk feedback, and publish phases (submitted/processing/published/partially failed/failed). Facets cover brand/manufacturer, eBay category, condition (label when ID is null), review/validation status, stock, and populated B&I attributes (category family, manufacturer, model, MPN, inventory/shipping mode, industrial technical fields). Results show condition and image counts. Quick view hydrates the canonical record, displays all stored images with lightbox navigation/zoom, and supports image reorder/upload. Single publish runs B&I account-targeted validation before queueing, loads connected-account policies/location, and persists the selected store mapping through the worker; bulk publish supports dedicated B&I stores with server-side compliance checks and progress details. The B&I editor remains at `/business-industrial/listings/editor`. |

The shared catalog API reads the organization and vertical from the authenticated request, applies team visibility and accessible-store publication filtering, and never returns private review evidence or serialized-unit secrets. B&I publication summaries, status joins, facets, deletion checks, and intake inventory mirrors require the exact B&I organization and vertical; legacy null-vertical/null-organization compatibility is limited to Automotive. The frontend forwards the selected organization for every shared-catalog read, mutation, and export path, while row and bulk publish controls reflect the server-side compliance approval gate. Soft delete is represented by the existing catalog_products.vertical_validation_status=deleted lifecycle value because the common entity has no deleted-at column; published or quarantined products cannot be deleted through these bulk actions.

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

The Fashion vertical is a separate workspace at /fashion with dedicated login, navigation, photos-first Add Item, listing drafts, bulk import, authenticity review, store configuration, vertical-tagged eBay OAuth, and Fashion RBAC roles. Garment identification reuses the existing OpenAI vision integration with Fashion-specific prompts and does not require successful AI analysis to save. It remains gated by the existing multi_vertical_catalog rollout flag for store enablement and publishing. Sandbox eBay category/variation verification and production migration/deployment remain operational prerequisites.

Fashion Catalog bulk publishing supports an explicit enabled marketplace and marketplace-specific business policies for each selected seller store. Fashion validation and publishing verify that the target's configured eBay inventory location is enabled.

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

### B&I full-root intake concurrency (2026-09-16)

Business & Industrial Drive intake runs up to two root jobs concurrently in production. Within each root, two folders and four image downloads per folder run concurrently with bounded download retries. A folder is detected and drafted immediately after its complete image set is retained; failed images keep that folder retryable and prevent a partial draft. Asset ingestion remains idempotent by intake job and source path; no marketplace publishing is performed by intake.
