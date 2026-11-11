# Changelog

## 2026-11-11 — Workspace reconciled into main

- Two months of uncommitted work from the development checkout was merged into main: 165 tracked and 82 untracked files taken as-is, 99 files merged three ways, and 109 conflicting hunks reviewed. Where both sides rewrote the same code, main's production version was kept; docs were combined. 410 one-off scripts (many holding live credentials) and generated output were left out. Backend and frontend build cleanly; no test fails that does not already fail on main, and 10 previously failing tests now pass. Details and the list of local variants preserved on `archive/workspace-snapshot-20261111`: [the reconciliation record](docs/operations/WORKSPACE_RECONCILIATION_2026-11-11.md).

## 2026-11-11 — Parts & Accessories return rule no longer applies to Fashion

- `marketplaceRequiresPartsAccessoriesReturnPolicy` classifies every EBAY_US category ID ≥ 33000 as Parts & Accessories, which includes apparel. New / New-with-tags Fashion listings were blocked at build ("require a return policy with at least 30 days and seller-paid return shipping"), and the publish service could have switched the seller to a free-returns policy. The builder and both publish-service checks now skip the rule for `vertical === 'fashion'`. Deployed to production on 2026-11-11 as overlay `realtrackapp-backend:fashion-pa-return-20261111` (healthy); 78 New-with-tags Fashion items then published to Primewardrobeusa with the store's existing return policy unchanged.

## 2026-11-11 — Fashion listings keep an explicitly chosen eBay location

- A Primewardrobeusa pilot publish asked for the store's enabled Dallas location (`US_Dallas_75234`), but production's UAE-only rule in `EbayInventoryApiService.ensureMerchantLocation` reconciled every listing to `AE_Dubai`. The workspace's Fashion branch (dedicated Fashion stores use the requested enabled location and fail closed when it is missing or disabled) was compiled and staged as overlay image `realtrackapp-backend:fashion-location-20261111` with rollback tag `rollback-fashion-location-20261111`. Non-Fashion stores keep the UAE rule. Deployed to production on 2026-11-11 (healthy); see [the operations record](docs/operations/FASHIONSTORY_WINTER_REIMPORT_2026-11-11.md).

## 2026-11-11 — Fashion re-imports no longer wipe images and attributes

- Production imports of `fashionstory_winter_listings_part1_detailed.csv` / `part2_remaining.csv` (`e9c9a227`, `ab949120`) auto-mapped only 9 columns; `all_image_urls`, `image_1..12`, `specific: *`, `description_html` and `category_*` were unmapped. Those 906 rows were updates, and the update path wrote the blank values over the earlier `winter_fashionstory_artisticserver_import.csv` data, so the products lost their images, brand, category, condition, description and Fashion attributes.
- `all_image_urls` / `image_urls` now auto-map to `imageUrls`; when no column maps to images, `image_url` and `image_1..image_N` are collected in column order (`imageUrlsFromNumberedColumns`).
- Fashion import updates now skip empty values and merge `vertical_attributes` over the existing ones (`importUpdateWithoutBlankOverwrites`); clearing a value is an editor action. Other verticals are unchanged.
- Workspace change pending deployment. Covered by `csv-import.processor.spec.ts` and `catalog-import.service.spec.ts`. The production data repair is recorded in [the operations record](docs/operations/FASHIONSTORY_WINTER_REIMPORT_2026-11-11.md).

## 2026-11-09 — Batch publish: flat master attributes and publish-readiness checks

- Fixed: the first live batch wrote `_ebayMasterImageSet` as an object onto each listing. The Fashion attribute validator rejects objects, so every save of those listings failed, and the builder failed the listings. The masters are now the `_ebayMasterUrls` and `_ebayMasterSourceUrls` string arrays. The 8 listings from that attempt were cleaned up: the old attribute was removed, with audit action `fashion.batch.repair`.
- Changed: READY now means the listing builder's publish checks pass as well as the photo and text checks. Dry runs and live batches run the builder read-only, so they never write to eBay. Blockers appear as review issues (`MEASUREMENT_UNITS`, `CONDITION_MISSING`, `POLICY_MISSING`, `RETURN_POLICY`, and others). Every batch now needs an eBay store.
- Added a `readOnly` option to `ListingBuilderService.build` (skips merchant-location creation) and exported the service from `EbayIntegrationsModule`.
- The builder's approval check ("authenticity/compliance review must be approved") is not a readiness blocker: the live batch records the reviewer's approval itself, just before publishing. Without this exclusion READY could never be reached in a dry run.
- Tests: `fashion-build-preflight.spec.ts`, plus a regression test that the stored masters pass `validateFashionAttributes`.
- Spec: `docs/architecture/FASHION_BATCH_PUBLISH.md`, section "Publish readiness".

## 2026-11-09 — Fashion "Publish next N" batch pipeline

- New Fashion Catalog action **Publish next...** runs the oldest N unpublished Fashion listings through photo processing, a counterfeit/VeRO compliance check and eBay publishing, with a dry-run mode. New pages: `/fashion/batches` (progress, CSV report, retry, audit log) and `/fashion/compliance-review` (issues, photo previews, AI fix diff, approve/reject).
- Photos are stored in S3 as `catalog/{listingId}/{sha256}/` original + thumb/small/large WebP + a JPEG eBay master of at most 2000px (sRGB, EXIF stripped, never upscaled). Fashion publishes use the masters via `verticalAttributes._ebayMasterImageSet`; other verticals are unchanged.
- Publishing still requires an approved authenticity review. A live batch is started by a Fashion reviewer who confirms authenticity once for listings that pass; each approval is recorded under that reviewer.
- Migration `1791700000000-CreateFashionBatchPublish` (additive: 4 new tables). No new permissions. Spec: `docs/architecture/FASHION_BATCH_PUBLISH.md`. Not yet deployed.

## 2026-11-07 — Auto Parts catalog shows only automotive listings

- Listing search (`GET /listings/search`, `/listings/search/facets`) and `GET /listings/summary` accept an optional `vertical` parameter. `automotive` matches `vertical = 'automotive'` and legacy NULL-vertical rows, the same rule the automotive scope uses. Other verticals and callers that omit the parameter are unchanged.
- The Auto Parts catalog page (`CatalogManager`) sends `vertical=automotive`. Before this, Fashion and Business & Industrial listing records appeared in the Auto Parts catalog and in its totals.
- Covered by `listing-vertical-filter.spec.ts`. Deploy as a layered backend image plus the frontend build; see the deployment record.

## 2026-11-08 — Re-list ended legacy eBay listings on publish
- Production logs for pipeline `946db3ea-4df2-4033-a99b-2c498ac2ccef` showed 99 legacy Trading API listings failing with eBay error 291 because their saved item IDs had ended. A publish retry now calls `RelistFixedPriceItem` only after that exact revise error, then saves the new eBay ItemID and URL in the channel mapping.
- A failed or uncertain relist result is not automatically retried, avoiding duplicate eBay listings when the request may have succeeded but the response or local mapping write was lost. The failed listing jobs have not been retried, and this fix has not been deployed.
- Added focused coverage for the relist request, item-ID replacement, and no automatic retry after an uncertain response.
## 2026-11-07 — Catalog import UPC unique-key failures

- Fixed catalog imports failing with `duplicate key value violates unique constraint "idx_catalog_upc"`. The batch duplicate check had no UPC layer, while `idx_catalog_upc` is a global unique index, so a UPC already stored on any product reached the insert and failed the whole batch. UPC is now matched first; an in-scope match updates that product, and a UPC owned outside the importing organization/vertical is skipped as `duplicate_skipped` (`upc_outside_scope`) instead of failing.
- Placeholder UPCs such as `Does not apply` are no longer stored as catalog identifiers or used as duplicate keys. Previously, one such row could block the import, and a legacy catalog row holding that placeholder made every later placeholder row fail. Listing-level `pUpc` still carries the raw eBay value. An update with a blank UPC no longer clears the UPC already on the product.
- Workspace change pending deployment. Covered by `catalog-identifiers.spec.ts` and `duplicate-detection.service.spec.ts`.
## 2026-11-04 — Fashion catalog filter dropdowns

- Replaced Fashion's left filter column with a horizontal dropdown row for brand, category, condition, catalog status, stock, Fashion category, department, item type, size, color, and material. Large facets remain searchable, and less-used filters open in an Advanced Filters drawer.
- Existing server-side filtering, facet counts, URL/session state, and active filter chips are preserved. Deployed from main commit `057cfb0f` as `realtrackapp-frontend:fashion-catalog-filters-20261104-057cfb0f`, based on the live `publish-workspace-20261104-7fb85299` image. Rollback image: `realtrackapp-frontend:rollback-fashion-catalog-filters-20261104-r1`. The public homepage, API health, and filter bundle checks passed; only the frontend was recreated, with backend and data containers unchanged.

## 2026-11-04 — Scope catalog eBay publishing to the active workspace

- The Auto Parts publish dialog now lists only active eBay stores in the selected workspace. Durable bulk-job creation and target polling both carry that workspace ID, preventing the API from checking a valid store against the user's default workspace.
- This is a frontend-only correction; no database migration or listing update is required.
- Deployed from main commit `7fb85299` as `realtrackapp-frontend:publish-workspace-20261104-7fb85299`; rollback image: `realtrackapp-frontend:rollback-publish-workspace-20261104-7fb85299`. HTTP bundle/root and API health checks passed; backend and data containers were unchanged.

## 2026-11-04 — Distinguish photo review from missing photos

- Enrichment failures that say photos could not confirm the part number now show `Needs review` when the listing has at least two saved photos. Listings below the two-photo requirement remain `Needs photo`.
- Deployed backend image `realtrackapp-backend:inventory-photo-review-20261104`, layered with the existing Motoark production features. Rollback image: `realtrackapp-backend:motoark-lifecycle-20261102-candidate`.
- This backend-only status correction changes no listing records, images, or marketplace records and requires no schema migration.

## 2026-10-30 — Prevent false eBay revision failures from stale readback

- An accepted Trading API `ReviseFixedPriceItem` response is treated as success without an immediate `GetItem` equality check. This avoids marking accepted listing changes as failed when eBay's read endpoint briefly returns stale data.
- Added a focused regression test for the existing-listing revision path.
- Deployed backend image `realtrackapp-backend:ebay-revise-00aad7cd` from main commit `00aad7cd`. Only the backend was recreated; PostgreSQL, Redis, PgBouncer, and the frontend remained running. `/api/health` returned HTTP 200 with database and heap up, and the backend healthcheck is healthy. No migration or listing retry was run.
- Rollback image: `realtrackapp-backend:parts-search-images-20261027-2f2d4755`. The clean source and Compose/rollback overrides are retained in `/home/ubuntu/realtrackapp-release-ebay-revise-00aad7cd/`.

## 2026-10-27 — Listing description fix deployed

- Production frontend: `parts-search-desc-20261027-2bfc2a5d` (main `2bfc2a5d`); rollback tag kept. See `docs/architecture/deployment.md`.

## 2026-10-27 — Parts Search: listing descriptions render as formatted HTML

- Part descriptions (mostly eBay listing HTML) showed as raw markup. They now render sanitized in a sandboxed frame with the listing's own styling, capped with **Show full description**; plain-text descriptions are unchanged.

## 2026-10-27 — Parts Search list-first + modal deployed

- Production frontend: `parts-search-modal-20261027-3f6e9f4c` (main `3f6e9f4c`), rollback tag kept; PartsBazar360 API with the cross-reference pass is live. See `docs/architecture/deployment.md`.

## 2026-10-27 — Parts Search: list first, part details in a modal, full cross-references

- Picking a part in the typeahead opens the list of every option for its number with that part highlighted, instead of a single part page.
- Clicking an option opens its description in a modal over the list (`PartDetailDialog`). The modal shows why the part is an option, cross-references by role (each searchable), a structured fitment table with evidence, item specifics, stock and images. ← / → step through options; the part page (`/parts-search/parts/:id`) stays for links and new tabs.
- Requires PartsBazar360 with the cross-reference pass:
  - item-specific interchange, superseded and OE numbers, read by role;
  - an indexed `pb_part_numbers()` lookup;
  - `Fitment` rows as compatibility data;
  - `crossReferences` / `fitments` on the internal part detail.

  Older PartsBazar360 still works; the new sections are then just absent.

## 2026-10-27 — Parts Search image downloads deployed

- Production backend and frontend: `parts-search-images-20261027-2f2d4755` (main `2f2d4755`); rollback tags kept. See `docs/architecture/deployment.md`.

## 2026-10-27 — Parts Search: download high-quality images

- Results open a gallery of every image of a part in high quality, with **Download full size** and **All N (.zip)**; rows get an **Image** quick download and the part page gets both buttons.
- Downloads come from new `/api/parts-search/parts/:id/images…` endpoints:
  - originals from Omni Core's private S3 (never the resized web variants);
  - eBay's 1600 px rendition, falling back to the stored size;
  - other hosts fetched server-side with remote-fetch controls.

## 2026-10-27 — Parts Search options deployed

- Production: backend and frontend `parts-search-options-20261027-22dc97da`, migration `CreatePartsSearchEvents1791600000000` applied, internal PartsBazar360 key configured. PartsBazar360 API deployed with the options endpoint (`cea9dbc`). See `docs/architecture/deployment.md`.

## 2026-10-27 — Parts Search: every sellable option, precisely

- `/parts-search/results` lists every option we can sell for a query, grouped:
  - **Number queries:** exact, superseded, OEM equivalent, aftermarket equivalent, and unverified cross-references (collapsed, with a "why this part?" trail).
  - **Text queries:** by fitment verdict, plus "other matches".
- **Availability** comes from PartsBazar360's database at query time, and ended listings are hidden but counted. Omni Core automotive warehouse stock is merged in by part number.
- **Vehicle:** picker (make/model/year/engine) or VIN decode (NHTSA), or parsed from the query. Verdicts are *Fits / Likely fits / Not confirmed / Does not fit*, based on the kind of evidence.
- **Demand:** searches with nothing sellable are logged to `parts_search_events`; sourcing requests and the `/parts-search/demand` report are new. Migration `1791600000000-CreatePartsSearchEvents`.
- **Requirements:** needs `PARTSBAZAR360_SEARCH_API_KEY` (and PartsBazar360 `cea9dbc` or later); without it the page shows the buyer view as before.

## 2026-10-27 — Parts Search portal deployed to production

- Backend `realtrackapp-backend:parts-search-20261027-4fc25e79` and frontend `realtrackapp-frontend:parts-search-20261027-49d1dfe7` (main `49d1dfe7`) are live; rollback tags are kept. `/parts-search` is available to Auto Parts users in buyer-view mode until `PARTSBAZAR360_SEARCH_API_KEY` is configured. Details in `docs/architecture/deployment.md`.

## 2026-10-27 — "Needs Review" listing status badge committed

- The Auto Parts catalog shows a `needs_review` listing status as an amber "Needs Review" badge (`ListingStatusCell`) and status dot (`CatalogInventoryDetailModal`); any status value the frontend does not recognise is shown the same way and never offers a Publish action.
- This was already live in production (frontend image `catalog-condition-icon-20261021-r1`, built from an uncommitted `dist/`). It is now in git so deploying `main` no longer removes it.

## 2026-10-26 — Parts Search portal (PartsBazar360 universal search)

- New portal at `/parts-search` with its own login (`/parts-search/login`) and shell. Anyone who can open Auto Parts (`dashboard.view`) can use it with the same session.
- Search box with typeahead understands OEM/part numbers in any separator format, partial numbers, typos and year/make/model phrases; results show the interpretation, match reason and filters (make, model, year, category, brand, part type, condition, stock, photos; seller and source in the internal view). Part pages show facts, offers, stock, source records and fitment.
- New backend module `parts-search` (`/api/parts-search/{query,suggest,parts/:id,status}`), a cached, rate-limited proxy to PartsBazar360. With `PARTSBAZAR360_SEARCH_API_KEY` it uses PartsBazar360's new internal endpoint (every offer with seller, store, source, SKU, base price and warehouse stock); otherwise the public buyer search. No migration.
- Auth fixes that benefit every workspace: sign-in now returns to the requested URL including its query string, and a 401 on a workspace page redirects to that workspace's login (logic consolidated in `authApi.ts`).
- Auto Parts sidebar gains a "Parts Search" link (module key `parts-search`).

## 2026-10-22 — Resumable Fashion catalogue imports

- Fashion imports checkpoint committed row results before the slower WebP/S3 mirror stage. BullMQ stalled-job recovery and bounded retries resume from saved row outcomes, retry transient database/network/image failures, and perform a final pass over incomplete Fashion image mirrors.
- Rows continue through permanent image-source failures with a clear per-row warning; those drafts remain blocked from publishing until their image requirements are resolved. No schema migration is required.
- Fashion import accepts source photos up to 25 MP and 25 MB, then keeps the existing maximum 2048-pixel WebP output at quality 85. The shared image conversion limit remains unchanged for all other workflows.
- Deployed backend-only image realtrackapp-backend:fashion-import-recovery-20261022-250b94f7 on 2026-10-22 from main commit 250b94f7. API health returned HTTP 200, and the active import resumed from 500 to 750 of 13,209 rows; frontend, PostgreSQL, Redis, and PgBouncer were left running. Backend rollback image: realtrackapp-backend:rollback-fashion-import-recovery-20261022-250b94f7.
- Deployed main commit 3b9247f2 as backend-only image realtrackapp-backend:fashion-import-recovery-20mp-20261022-3b9247f2. Twelve sampled source photos were 4,284 × 4,284 (18.35 MP), above the shared 16.7 MP limit; Fashion imports now accept up to 20 MP while retaining the same 2048-pixel WebP output and quality 85. The backend health endpoint returned HTTP 200, and the active import remained queued as a live worker job; frontend, PostgreSQL, Redis, and PgBouncer stayed running. Rollback image: realtrackapp-backend:rollback-fashion-import-recovery-20mp-20261022-3b9247f2.
- Follow-up inspection found seven unmirrored photos at 5,712 × 4,284 (24.46 MP) and under the 25 MB byte cap. Main commit 1c389779 raises the Fashion-only ceiling to 25 MP without changing WebP dimensions or quality; backend-only image realtrackapp-backend:fashion-import-recovery-25mp-20261022-1c389779 is healthy. After BullMQ reclaimed the job, the import advanced to 1,250 of 13,209 rows; it remains processing. Rollback image: realtrackapp-backend:rollback-fashion-import-recovery-25mp-20261022-1c389779.

## 2026-10-21 — Fashion source catalogue import

- Catalog Import can select Fashion and maps the Artistic Server workbook's category, item specifics, measurements, and provenance into editable drafts. Source photos are copied to application S3 as WebP; incomplete image mirrors and unconfirmed measurement units block publishing.
- The import reuses existing `vertical_attributes` JSONB and adds no database migration. Commit `b95045cd` was deployed on 2026-10-21 as backend/frontend images `realtrackapp-backend:fashion-catalog-import-20261021-b95045cd` and `realtrackapp-frontend:fashion-catalog-import-20261021-b95045cd`, layered over the active production images to preserve live fixes. Only backend and frontend containers were recreated; PostgreSQL, Redis, and PgBouncer stayed running.
- The public homepage, `/fashion/import`, its JavaScript asset, and `/api/health` returned HTTP 200 after deployment. No workbook was imported during rollout. Rollback images and saved Compose arguments are in `/home/ubuntu/realtrackapp-fashion-catalog-import-20261021-b95045cd/`.

## 2026-10-15 — Pipeline sample xlsx download fix

- Fixed the "Download Sample Input" link on Pipeline, which downloaded a file Excel could not open. The production frontend image predated `public/pipeline-gridx-sample.xlsx`, so nginx's SPA fallback returned `index.html` under the `.xlsx` name. The repository file is a valid workbook and is unchanged.
- Deployed frontend image `realtrackapp-frontend:main-ae12191b` (built from `origin/main` at `ae12191b`) by recreating only the `frontend` service. Backend, PostgreSQL, Redis, and PgBouncer were not recreated. The public download on the production host (`ec2-34-196-184-100.compute-1.amazonaws.com`) returned `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with ZIP signature `50 4b 03 04`, and the app and `/api/health` returned HTTP 200. That image was later replaced by `realtrackapp-frontend:catalog-status-icon-20261015-r2`, which still serves the file.
- Known drift: the Compose project's config still names `realtrackapp-frontend:rollback-catalog-publish-holds-20261014-r2-attempt3`. A plain `docker compose up` with the existing 35-file set reverts the frontend. Keep the frontend override as an extra `-f` until the base Compose config is updated.

## 2026-10-13 — Full screen Fashion camera

- Camera preview now fills the app viewport on phones and desktop, with safe-area
  padding, compact step controls and a large shutter button over the image.
- Review and retake use the full viewport. Saved photos match the visible preview
  framing, while uploads continue in the background.
- The Save & next garment panel remains in normal form flow after closing the camera.

## 2026-10-13 — Keep Fashion Save & Next in the page flow

- Removed sticky positioning from Quick Capture's Save & next garment action.
  The action panel scrolls with the form and does not cover the photo controls.

## 2026-10-13 — Responsive Fashion camera capture and automatic AVP SKUs

- Quick Capture and Add Item now offer a live rear-camera preview, switching,
  retake/accept controls, guided photo slots and device-camera fallback.
- Capture continues during bounded background uploads; local previews and failed
  files remain available for retry. Camera, request and queue deadlines provide
  recovery actions, and camera tracks stop when closing or hiding the view.
- AVP numbers are allocated automatically; label-size changes update the suffix
  without consuming a number or discarding photos. Prefixes remain configurable.
- Size buttons and collapsed session settings simplify mobile intake; measurement
  charts are opt-in. Save retries reuse a capture UUID to prevent duplicate garments.
- PostgreSQL reservations coordinate across organizations in the global SKU
  namespace. No schema migration or permission changes are required.

## 2026-10-09 — Let Add Part vision read private photos and distrust stale part type

- Photo identification reads app-managed S3 objects with the app's storage
  identity and sends bounded image data to the vision provider. The provider
  received 403 responses when it tried to fetch the bucket's private public URL.
- Add Part no longer uses the existing `cType` to select the ECU-only prompt
  before photo identification. That stale field had steered a wiper assembly
  into an ECU prompt and the result had no usable listing title.
- Photo identity now requires the supplied part number to appear in the
  model's visible-text extraction, in addition to a usable high-confidence
  identity and complete label/overall photo coverage. A model echoing the
  seller hint alone cannot authorize a data change.
- Successful photo lookups now sync the corrected title, description, brand,
  MPN, and category to the matching CatalogProduct as well as the listing row;
  catalog title normalization is refreshed with the title.
- External image URLs are unchanged, and oversized-image retry now handles
  inline image data as well.


## 2026-10-09 — Photo-verified Add Part enrichment

- Add Part now saves an unidentified draft without performing an MPN-only
  product lookup. Automatic identification starts after at least two saved
  photos are available.
- Photo-based identification fails closed when image evidence is inconclusive,
  rather than substituting a seller listing selected by MPN.
- Later enrichment preserves photo-derived title, part type, brand, and
  description; a failed AI validation gate cannot write generated identity
  fields. New photos can restart a completed enrichment run.
- The inventory image-save endpoint is the only enrichment trigger for that
  upload flow, avoiding duplicate jobs.

## 2026-10-09 — Fashion capture, Catalog handoff, and activity report

- Added continuous WebP photo-slot capture with batch SKUs, optional warehouse and measurement chart data, and background Fashion image identification.
- Added Intake history and an explicit eligibility-checked action to promote processed items to shared Catalog.
- Added a filtered activity report with uploader/Catalog-adder attribution, item details, publication targets, per-store policies, and CSV export.
- Moved Fashion destination store and shipping/payment/return policy selection to the Catalog publish action.
- Added organization-scoped Fashion warehouse and SKU-counter tables through migration 1791000000000-CreateFashionIntake.
- Deployed to production from main commit `b63261e8` on 2026-10-09; backend health,
  Fashion routes, protected intake API behavior, and migration-created tables were
  verified.

## 2026-10-08 — Part lookup respects the vehicle make; catalog photo edits stick

- Part lookup (`SingleListingFormService.lookupPart`) prefers a usable photo
  identification over an eBay Browse match, because a seller's MPN field can be wrong.
  A Browse listing may only supply the part identity on an exact MPN match whose
  vehicle evidence does not contradict the operator-entered vehicle make;
  aftermarket brands (Bosch, Mopar, Denso…) are not treated as vehicle makes. The
  make is passed separately from the part brand (`vehicleMake`) to Browse, vision and
  text lookups.
- Auto Parts catalog photo editor: photos removed and saved no longer come back from
  stale `catalog_products.imageUrls`; pending removals are saved before an upload, and
  duplicate URLs are dropped.
- In-app links in the Single Listing pipeline and catalog detail modal now include the
  `/auto-parts` prefix.
- `usePartLookup` now declares `vehicleMake` / `partType`, which the hotfix passed
  without a type (the old Vite-only image build did not type-check).
- This change was first deployed to production on 2026-10-07 as
  `catalog-photo-part-lookup-20261007` from an untracked copy; this commit puts it in
  git. See docs/context/CURRENT_STATE.md.

## 2026-10-07 — Fashion identification: Jev-selected model, fallback, fuller autofill

- Fashion photo identification now uses `google/gemini-3.1-flash-lite` with an automatic
  fallback to `google/gemma-4-31b-it`, chosen by Jev (OpenRouter `/alpha/decisions`) from
  a 20-model benchmark on 5 labelled garments. Override with `FASHION_AI_MODEL` /
  `FASHION_AI_FALLBACK_MODEL` (now passed through `docker-compose.yml`).
- Fixed: a non-JSON or truncated model reply was shown as a successful analysis with
  empty fields. It now retries on the fallback model, then reports a failure.
- Fixed: single-garment photo sets could show the "more than one garment" alert.
- Fixed: AI titles longer than eBay's 80 characters are trimmed on a word boundary
  before review instead of being cut at publish.
- Fixed: Fashion item specifics no longer include raw attribute keys, measurements and
  free-text defect notes; only eBay aspect names are sent, values capped at 65 characters.
- Added Fashion "Listing details" fields (country of manufacture, features, season,
  occasion, theme, vintage, garment care), filled by identification, plus department
  normalization (`Men`/`Women`/...) and `Size Type` / condition autofill. Prompt
  `fashion-image-identification-v2`.
- Added `google/gemma-4-31b-it` to the AI cost table (it was logged at gpt-4.1-mini rates).

## 2026-10-07 — Fix frontend build on main

- `npm run build` failed type-checking on `main`. `catalogConfig.ts` sets
  `addLabel` / `searchPlaceholder` for Fashion, but `CatalogConfig` did not declare them
  and `CatalogWorkspace` ignored them; both are now optional fields, and the workspace
  uses them with the previous text as the fallback (Fashion shows "Add Item").
- `InventoryManager.tsx` inferred the `missing` URL-filter default as the literal type
  `false`, so toggling "missing images" did not type-check; it is now `boolean`.
- The frontend `Dockerfile` now runs `npm run build` (`tsc -b && vite build`) instead of
  `npx vite build`, so an image can no longer be built from code that fails type-checking.
  That gap is how the two errors above reached production builds unnoticed.

## 2026-10-07 — Guard eBay publishing against Trading API exhaustion

- Single and bulk native-OAuth publish submissions now check eBay Developer Analytics for the shared application Trading API allowance before persisting a job. They reserve room for other Trading calls and already queued targets; when capacity is insufficient, the request returns the reset time without generating another failed job.
- The Inventory-to-Trading migration now checks its expected preflight and apply usage against the same allowance and reserves 1,000 calls for publishing. A dry-run-first recovery tool identifies unique, still-unpublished products affected by error 518 and supports a confirmed canary/requeue.

## 2026-10-06 — Move recent eBay listings to Trading API

- All new standard fixed-price eBay listings use Trading API. The retired API-mode override cannot route these listings back to Inventory API. App relisting now withdraws published Inventory offers before deleting and replacing them, with recovery if the Trading request fails.
- Added a resumable, two-stage production runner for published Inventory-backed listings from the preceding 30 days. It preserves current price, stock, photos, item specifics, compatibility, and business-policy IDs; updates application pointers to the replacement ItemID; and uses batches of up to five while respecting Seller Hub's default ItemID tracking.
- The disabled multi-vertical variation pilot now fails closed instead of creating new Inventory API item groups until Trading API variation support is ready; production currently has no variant listing mappings.
- Every replacement receives a new eBay ItemID. The runner caps each apply run at 250 items, can resume from its saved plan, and stops on eBay listing-rate limits. Conversion totals and skips are recorded after the live migration.
- Migration apply/resume avoids repeated full-seller active-list scans. It verifies each replacement ItemID, samples one prior ItemID per account/marketplace group, loads a full active-list index only to recover a pending migration with a missing offer, and follows the current published offer ID if a prior rollback recreated that offer. It stops verification after an eBay usage-limit response and stops later migration batches when a rollback remains unresolved.

## 2026-10-06 — Publish private S3 images through eBay Media API

- Fixed the repeated EPS 400 `No valid image can be downloaded` failures for
  listings whose images are in the private application S3 bucket. The backend
  now reads those objects with its own credentials and uploads their bytes to
  EPS. External URLs continue through URL upload; failed listings can be
  retried after deployment without opening the bucket to public access.
- Production backend image `realtrackapp-backend:eps-15305b43` passed health
  checks. A canary and the remaining original job completed 50/50 targets;
  a separate newer job completed the overlapping 71/71 targets. All 121
  successful targets have distinct eBay listing IDs, and the deployed backend
  logged no further image-hosting failures during verification.

## 2026-10-05 — eBay Trading API publishing

- Standard new fixed-price single-item listings use Trading API AddFixedPriceItem by default and retain the seller SKU as the custom label. eBay business policy IDs are used for shipping, payment, and returns. Existing Inventory offer-backed edits and multi-SKU variation listings keep their existing Inventory API flows.

## 2026-10-05 — Fashion image analysis S3 access

- Restored the Fashion vision flow's existing signed-download URL call by adding short-lived S3 GET URL generation to StorageService. This uses the configured bucket, key, and signed URL expiry.

## 2026-11-07 — Fashion bulk publish marketplace selection

- The Fashion Catalog publish dialog now lets operators choose an enabled marketplace for each selected eBay store and loads that marketplace's shipping, payment, and return policies. The worker receives the selected marketplace, and the API rejects unavailable marketplace selections before queueing. Workspace change pending deployment.
- Fashion eBay publishing now verifies the exact configured merchant location on eBay. Validation blocks missing or disabled locations instead of letting the publisher substitute a warehouse from another country. Workspace change pending deployment.

## 2026-11-05 — PrimeMotive US production reconciliation

- Reconciled all 90,535 US listings from the supplied PrimeMotive Seller Hub export against a newly completed eBay inventory report. Committed 71,911 mirror updates, 18,624 missing mirror inserts, and 5,222 existing US inventory publication-link updates. Rollback trials and independent post-commit verification passed with zero mismatches.
- The reconciled source population contains 50,935 active listings, 37,940 out-of-stock listings, and 1,660 ended listings; advertised available quantity totals 62,221. Physical warehouse stock and marketplace push policies were not changed. Unknown mirror-only IDs were retained for review.
- Saved a verified before-image backup and production results. With explicit user approval, reset the API reader password using a server-generated credential, protected environment/rollback files, and a transactional audit event. Authenticated active/out-of-stock/ended listing checks and the dedicated PrimeMotive feed passed with HTTP 200; roles and permissions were preserved. Recurring sync completeness, physical-stock mapping/counts, and consumer credential provisioning/ingestion remain follow-ups; see the [production record](docs/operations/PRIMEMOTIVE_US_RECONCILIATION_2026-11-05.md).

## 2026-11-04 — Business & Industrial eBay OAuth return route

- Successful shared eBay OAuth callbacks now honor the vertical-specific destination saved by the connection flow. B&I-only admins return to `/business-industrial/stores` instead of general eBay settings, which requires `ebay.view`. Deployed backend overlay `realtrackapp-backend:ebay-oauth-return-20261104-r1`; see the [release record](docs/operations/EBAY_OAUTH_RETURN_2026-11-04.md).

## 2026-11-04 — Fashion catalog filter dropdowns

- Moved Fashion's primary catalog facets into horizontal dropdowns above the results: brand, category, condition, catalog status, stock, department, item type, size, color, and material. Dropdowns retain option counts and searchable lists for large facets; less-used criteria remain in Advanced Filters.
- The shared Fashion catalog route uses the same server-side filters and URL/session state. No backend or schema changes were required; this update is local and not deployed.

## 2026-11-03 — MotoArk lifecycle production rollout

- Added signed, organization/store-scoped order-events, processing-status, and quantity APIs. Durable event keys/payload hashes, order versions, and atomic warehouse transactions cover purchases, partial shipments/cancellations, returns with quarantine/inspection/disposal, and independent capped financial refund records.
- Hardened legacy sale receipts against concurrent duplicates and changed-payload event-ID reuse (409). Added standard Compose forwarding for the existing sales key and separate lifecycle key. Internal generic order/stock mutations cannot bypass MotoArk balances.
- Added stable UUID snapshot imports, commit-safe promoted sequence cursors, per-listing revisions, scoped ordered callbacks, and mirror status reconciliation after acknowledged channel quantity pushes.
- Added two additive migrations and API/schema/RBAC/operations documentation. Focused suites passed 42 tests before final cursor checks; new code/migration lint and backend build pass. See `docs/operations/TESTING.md` for local evidence.
- Deployed the reviewed overlay as `realtrackapp-backend:motoark-lifecycle-20261102-candidate`, restoring missing Primemotive routes while preserving production PartsSearch. Both migrations applied after a full pre-migration archive passed `pg_restore` validation. The existing sales signing key was preserved and a separate lifecycle key configured. Local/public health returned 200; protected routes returned 401 without credentials; signed synthetic lifecycle, duplicate/conflict, quantity, snapshot/change-feed, and legacy-receipt checks passed. No order or stock movement was created by the lifecycle check.
- Marketplace stock pushing remains off. The 200-row active Primemotive sample has 0 mapped inventory items, so verified warehouse counts and mappings are still required; unmapped sales stay pending and no opening balances were written. See `docs/operations/MOTOARK_RELEASE_2026-11-02.md` for the backup checksum, image IDs, rollout evidence, and rollback procedure.

## 2026-11-02 — MotoArk lifecycle integration assessment

- Documented the existing sale webhook's receipt-only behavior, unsupported cancellations/returns/refunds, missing inbound-secret Compose forwarding, concurrent duplicate risk, and the missing purchase-to-stock path.
- Added an evidence-backed implementation plan reusing warehouse stock services, with scoped durable order events, return inspection, independent refund handling, quantity ordering, consumer isolation, and acceptance checks. Corrected the API/feature guides' concurrency and initial-load guarantees; proposed routes remain unimplemented.
- Documentation only; no application code, secrets, stock, migration, or deployment changed. Focused existing tests: 21 passed and 1 failed because the published-listing offer-resolution test's Trading API mock lacks `reviseFixedPriceItem`.

## 2026-10-30 — eBay Trading API revisions no longer fail on stale readback

- Legacy listing revisions now trust a successful `ReviseFixedPriceItem` response instead of requiring an exact `GetItem` match within two seconds. This prevents eBay read-after-write lag from marking accepted changes as failed bulk targets; a focused regression test covers the path.
- Local change only; production still runs the 2026-10-27 backend image and requires an approved deployment to receive this behavior.

## 2026-10-22 — Resumable catalog import worker

- Fashion import batches now checkpoint committed rows before the slower image-copy stage. Worker retries resume from the durable row cursor, skip rows with saved outcomes, and repair incomplete Fashion image sets from their preserved source URLs.
- Fashion imports receive bounded BullMQ retries with exponential backoff; legacy single-attempt jobs also retry transient worker/database failures locally. The worker renews long-running locks and recovers stalled jobs. Transient image fetch/storage failures get bounded retries while existing WebP quality, pixel, and byte limits stay unchanged.
- Permanently unavailable or invalid source images remain visible as per-row warnings and continue to block publishing; the catalog import can still finish its row work. No database migration was needed.
- Local change only; the updated worker has not been deployed to production.

## 2026-10-21 — Auto Parts condition-filter crash fixed and deployed

- Added the `needs_review` status icon and a fail-closed fallback for unknown listing statuses, and labeled review-held rows **Needs Review** in the inventory detail modal. This prevents the catalog from crashing when condition **New** returns a review-held row.
- Deployed frontend image `realtrackapp-frontend:catalog-condition-icon-20261021-r1` as an overlay on the active production frontend. The public homepage, `/auto-parts/catalog`, JavaScript, CSS, and `/api/health` returned HTTP 200; the served bundle contains `needs_review`. Only the frontend container was recreated; backend, PostgreSQL, Redis, and PgBouncer container IDs stayed unchanged. No listing data changed. Rollback image: `realtrackapp-frontend:rollback-catalog-condition-icon-20261021-r1`.

## 2026-10-20 — Fashion catalogue export import support

- Added a Fashion export adapter for item specifics, measurements, marketplace provenance, and source image URLs. Recognized values map to the Fashion editor; remaining specifics stay editable and can be included in eBay aspects.
- Source export photos are converted to WebP and copied into the application S3 bucket. Rows with incomplete mirrors are blocked from publishing, and re-imports reuse successful objects and retry failures.
- Source measurements keep their original notes and require an explicit cm/in confirmation before publishing; confirmed units are included in generated listing text.
- The existing JSONB Fashion schema is reused; no SQL migration was needed. The import implementation was later deployed as backend commit `b95045cd2ca5731af1db1b40a090625731dac04b`. A production import began on 2026-10-22; the latest app check showed 250/13,209 rows processed and image-copy warnings. No listings were published. The resumability improvement is still local pending deployment.

## 2026-10-20 — Catalog bulk publish workspace scoping

- The Auto Parts publish dialog now lists only active eBay primary stores in the selected workspace, and durable bulk-publish requests include that workspace ID. This prevents a store from one workspace being rejected against the user's default workspace.
- Follow-up fix deployed as frontend image `realtrackapp-frontend:publish-workspace-20261020-r3`: target polling now includes the same `organizationId` as job creation. Without it, the API looked up the job in the user's default workspace and returned `Job not found`. The homepage and `/api/health` returned HTTP 200; only the frontend was recreated, and no listings were retried or published. Rollback image: `realtrackapp-frontend:rollback-publish-workspace-20261020-r2`.
- Deployed frontend image `realtrackapp-frontend:publish-workspace-20261020-r2`, including the existing `Needs Review` shield icon and fail-closed status fallback. Only the frontend container was recreated; backend, PostgreSQL, and Redis container IDs stayed unchanged. The homepage and `/api/health` returned HTTP 200. Rollback image: `realtrackapp-frontend:rollback-publish-workspace-20261020-r1`. No listings were retried or published during verification.

## 2026-10-15 — Catalog status icon runtime fix

- Added the `needs_review` status to the Auto Parts catalog's icon map and a fail-closed fallback for unrecognized API statuses. Unknown or review-held rows remain non-publishable and no longer crash the catalog while reading `icon`.
- The production frontend had been rebuilt from `ae12191b`, which predated the `needs_review` UI added for the catalog review-hold backend behavior. The first overlay copied asset directories without read/execute permissions, so nginx returned 403 for JavaScript and CSS. Rebuilt and deployed `realtrackapp-frontend:catalog-status-icon-20261015-r2` with readable static assets; only the frontend container was recreated, preserving existing Compose overrides.
- The homepage, catalog route, JavaScript, CSS, and `/api/health` returned HTTP 200. Chrome rendered the homepage and the frontend logs had no new asset permission errors. Backend, PostgreSQL, Redis, and PgBouncer container IDs were unchanged; no listing data changed. The base frontend image `realtrackapp-frontend:main-ae12191b` remains available for rollback.

## 2026-10-15 — Infiniti EX35 listing review data repair

- Corrected vehicle context and synchronized titles on all 65 visible listings from pipeline `1d2f793b-6dea-4117-8f5c-9e9cc7e7c9c1`; saved exact-MPN application evidence for 55 rows as 223 MVL-checked exact-part candidates, ten of which now support the two ready fenders, and removed the stale missing-price error from the visible tailgate.
- After the owner confirmed separate dismantled parts and shared donor-assembly galleries as the standard photo workflow, marked 51 records Ready to Publish. Only the two fender panels needed nine side-matched photos; each has five verified model years. Removed generic shared-gallery holds, clarified that only the named dismantled part is included, and retained 14 holds for specific MPN/side/condition conflicts or unverified exact applications. Nothing was published; the deleted zero-price seat-frame row was untouched. See [repair and validation record](docs/operations/INFINITI_EX35_REVIEW_2026-10-15.md).
## 2026-10-14 — Primemotive integration feedback

- Removed the item-specific Mercedes-only filter from the Primemotive feed; it now returns every active published listing from the authenticated organization's Primemotive store with a non-empty eBay item ID.
- Added a durable, transactional change feed for added, edited, ended, and deleted listings plus retrying HMAC-signed outbound webhook delivery when a callback URL and secret are configured.
- Added 10 synthetic Primemotive test listings via an idempotent seed command and an opt-in minute simulator that changes one synthetic row at a time without calling eBay.
- CSV exports now return 10,000 rows per requested `page`, so later pages can be exported independently.
- Deployed backend image `realtrackapp-backend:primemotive-feedback-20261015-r5` with migration `1791400000000-PrimemotiveListingChangeFeed`, after verifying a pre-migration database backup. Local and public health, overlay checksums, migration state, and protected-route checks passed; rollback image: `realtrackapp-backend:rollback-primemotive-feedback-20261015-r5`.
- Seeded 10 marked synthetic Primemotive listings and enabled the minute simulator for the Primemotive organization. The simulator changes one synthetic row's price or quantity and does not call eBay. Outbound listing webhooks remain idle until the callback URL and secret are configured.

## 2026-10-14 — Catalog review holds and eBay publish diagnostics

- Catalog rows with a manual-review flag or a `needs_review`/protected lifecycle status now display as **Needs Review**, are excluded from **Ready to Publish**, and are blocked by both single and bulk catalog publishing. The durable eBay publish validator rechecks the catalog product and organization before creating a listing, so stale UI state cannot bypass the hold.
- Trading API error 240 handling surfaces eBay's `ErrorParameters.Value` policy reason when present. The production failures inspected for this incident contain only eBay's generic rejection, which requires seller/account or listing-policy resolution before those items can be retried.
- Deployed backend image `realtrackapp-backend:catalog-publish-holds-20261014-r2` and frontend image `realtrackapp-frontend:catalog-publish-holds-20261014-r1`, preserving Compose overrides and runtime environment. Backend/frontend builds, local and public health checks, deployed module checksums, public frontend checksum, and protected-route checks passed. Rollback image: `realtrackapp-backend:rollback-catalog-publish-holds-20261014-r2-attempt3`. No marketplace listing retry was run.

## 2026-10-13 — Add Part failure recovery

- Photo lookup retains the entered part number when complete OCR tokens confirm it, even if the model selects another identifier printed on the same assembly. Conflicting selected identifiers are removed from the generated primary name; unmatched photo evidence still requires review. ECU identification now recognizes the explicitly supplied ECU prompt and requests high image detail.
- AI requests without an explicit output limit now request at most 4,096 completion tokens instead of reserving a provider default of 65,536. Actual billing failures retain their original error and stop automatic retries with a system failure classification.
- Deployed the scoped backend image `realtrackapp-backend:add-part-recovery-20261013-r1`, preserving active Compose overrides and runtime environment. Backend build, six focused regression tests, isolated runtime checks, and local/public health checks passed. See `docs/operations/ADD_PART_RECOVERY_2026-10-13.md` for the production audit and recovery results.
- Audited 25 failed records from the previous seven days: final state is 13 completed, 12 requiring identity/fitment review, zero failed and zero pending recovery jobs. Restored the photo-verified leading zero in `BU1-16326`; withdrew unsupported imported vehicle claims for three affected pipeline records with complete before-images. Three records still need original number evidence; no eBay publication was performed.

## 2026-10-13 — Inventory photo verification status

- Inventory no longer reports “Needs photo” for a completed photo check that could not verify the entered part number. These listings now show “Needs review”; “Needs photo” is reserved for explicit missing-photo or photo-coverage failures. The photo identity gate remains fail-closed.

## 2026-10-13 — Primemotive feed scope and production runtime repair

- Added opt-in `includeCatalogData=true` to published-listing feeds and listing detail. It exposes the linked RealTrackApp catalog record's stored identifiers, descriptive fields, attributes, source category, and only explicitly MVL-validated fitment rows while preserving source provenance; it excludes linked catalog rows owned by another organization and does not fabricate canonical Partslink24 keys or relations. Deployed as `realtrackapp-backend:primemotive-catalog-data-r3-20261013`; backend build passed, health returned HTTP 200, protected feed returned HTTP 401 without a token, and the container is healthy.
- The `/api/published-listings/primemotive` feed now reads RealTrackApp's database mirror only and always limits rows to the authenticated organization's Primemotive store, explicit Mercedes-Benz item specifics, a non-empty eBay item ID, and database `listingStatus=active`. Caller status/store filters cannot broaden it. `updatedAfter` and the `updateAfter` compatibility alias both filter the database `updatedAt` watermark.
- Fixed production Compose configuration so the Primemotive image and API prefix are actually used. Granted `published_listings.export` to the existing API reader role with additive migration `1791300000000-PrimemotiveExportPermissionGrant`.
- Sync health now uses the latest completed scheduled/full sync log instead of an old account watermark alone; `PUBLISHED_LISTINGS_SYNC_STALE_AFTER_HOURS` supports weekly database refresh cadence. Production Primemotive connection is active and its latest completed scheduled refresh was 2026-10-11 with 25,000 processed and 0 failed.
- Compared the 2026-10-07 Seller Hub report by eBay item ID: 64,257 of 87,955 US-site IDs have an active RealTrackApp database row; 238 also match the active Primemotive/Mercedes feed scope.

## 2026-10-12 — Fashion mobile photo capture controls

- Kept the camera and upload choices visible in quick capture when the SKU is blank, explained why a SKU is required, and added one-tap SKU generation from the photo panel when a batch is selected.

## 2026-10-12 — Primemotive external listing integration

- Added a paginated Primemotive-only JSON feed with incremental `updatedAfter` polling. The dedicated feed now requires an explicit Mercedes-Benz Make/Brand item-specific value and ignores caller store filters; it does not infer make from listing titles.
- Added a timestamped HMAC- and permission-protected sale-event receiver plus a paginated sale-event log. Events are idempotent and do not mutate listing or inventory quantities. The RBAC migration grants the two integration permissions to the existing published-listings reader role when present.

## 2026-10-11 — Health probe throttling and DynaTrade CSV batch 37

- Fixed the catalog listing editor's Type item-specific field mapping. It now persists edits to `CatalogProduct.partType` instead of silently dropping them under the preview-only `type` key.

- Follow-up health fix: heap reached 657.85 MB, exceeding the deployed 512 MB threshold while the backend remained responsive and below its 1.8 GB container limit. The backend-only derived image `realtrackapp-backend:health-heap-1024-20261011` raises the health threshold to 1 GB. Node syntax validation passed; direct/public health, runtime, and frontend checks returned HTTP 200 after rollout, and all five containers were healthy.
- Prepared a 209-SKU new-record import CSV with 42,717 validated fitment rows. The file excludes 37 existing catalog matches and passed importer-header, count, pricing, quantity, image, description, condition, shipping-profile, and MVL-tag checks. Production import remains pending a signed-in account with `catalog.import`; no eBay publish occurred.
- Exempted the public `/api/health` liveness/readiness probe from the global rate limiter. Docker's 10-second probes no longer compete with client traffic for the shared rate limit; auth and permission checks for other routes are unchanged.
- Raised the backend heap readiness threshold from 300 MB to 512 MB after production's 335 MB heap caused false unhealthy/503 responses while the container used only about 462 MB RSS of its 1.8 GB limit. Deployed `realtrackapp-backend:health-heap-512-20261011`; direct and frontend-proxied health checks and the frontend root return 200. All five production containers are running; backend, PostgreSQL, Redis, and PgBouncer report healthy.
- Staged FEBI-26383 as CSV batch 37 with its verified official image, product description, 46 U.S. fitments, source quantity, New condition, agreed $38 pricing, and Superior $38.99 shipping. The v104 master and separate fitment CSV passed the independent audit; no production listing write or eBay publish occurred.
- Added the 600-row v7 live reconciliation manifest with current 471/129 statuses, explicit New condition, verified pricing/quantity/image/description/policy fields, and fitment audit notes. It marks existing records to prevent duplicate imports and does not request eBay publication.
- Production DNS audit found `mhn.realtrackapp.com` and `enxi.realtrackapp.com` resolve to `208.91.197.132` instead of the EC2 host. The app remains reachable at `app.omnicoreholding.com`; no DNS records were changed.
- Rechecked the live frontend bundle at `app.omnicoreholding.com`: it serves the draft-first Add Part UI and does not include the screenshot's stuck `Identifying part…` state. Authenticated save behavior remains unverified without a signed-in session.
- Created the source-preserving v105 DynaTrade master after auditing HENGST-E5KFR2D12. The four Aston Martin fitments are unsupported, and the saved Mercedes candidates lack exact part-to-vehicle evidence, so the row now accepts zero fitments and stays held. All 6,046 source rows and 6,032 distinct SKUs remain in the master; every other field matches v104. The next Bosch evidence slice also found 0 of 15 fully ready. No production records were changed.

## 2026-10-11 — DynaTrade CSV batch 36 audited

- Staged FEBI-34608 from source row 620 with stock 1,224, New condition, $38.00 sale price, and Superior $38.99 shipping. The official 1 L ATF listing and matching BMW OE reference were checked, and its current official 1500-by-1500 bottle image passed live-byte/hash validation. Retained 822 of 1,186 saved ePID/MVL fitments for officially supported makes and excluded 364 Kia rows; the raw API response was not retained, so endpoint completeness is not claimed. The independent audit passed; no production write or eBay publish occurred.

# Changelog

## 2026-10-10 — DynaTrade CSV batch 35 audited

- Staged HENGST-E1722L from source row 4381 with workbook stock 10, New condition, $49.99 sale price, and Superior $38.99 shipping. Hengst's official catalog confirms the air-filter insert and Porsche OE reference; the actual-product 1200-by-1200 eBay image passed visual review and live hash checks. The 94 saved eBay ePID compatibility rows matched active `US_MVL_2026_05` and passed the independent audit. Seller page totals differ, so only the 94 saved API/MVL rows are included. No production write or eBay publish occurred.

## 2026-10-10 — DynaTrade CSV batch 34 audited

- Staged HENGST-H14W30 from source row 5471 with stock 61, New condition, $38.00 sale price, and Superior $38.99 shipping. Its actual-product photo was visually reviewed, the exact official Hengst OE reference was confirmed, and all 760 eBay fitment rows matched active `US_MVL_2026_05`. The 6,046-row v101 master and separate fitment CSV passed the independent workbook, image, identity, pricing, and policy audit. No production write or eBay publish occurred.

## 2026-10-10 — Catalog publication destinations

- Catalog results now identify the eBay marketplace and store for each publication on desktop and mobile, with a direct listing link. Published rows without destination data are labeled clearly.

## 2026-10-10 — Duplicate inventory photo strip removed

- Removed the redundant “Part pictures” strip from Inventory Details while retaining the larger primary photo and the existing Product Images gallery/editor. Deployed frontend-only as `realtrackapp-frontend:inventory-photo-dedupe-20261010`; root and `/api/health` returned HTTP 200, and the served bundle no longer contains the duplicate strip. No listing or database data changed.

## 2026-10-10 — DynaTrade production quantity and condition reconciliation

- Reconciled 921 existing RealTrack listings against exact workbook brand/MPN matches: every match now shows New and all 919 unambiguous quantities match the source. Updated 925 catalog products, changed 829 listing records and 223 catalog products, and recorded listing revisions. The two existing FEBI 101942 quantities remain unchanged because two source rows have conflicting quantities without a row-to-listing mapping. No eBay offer updates were sent; 29 records with internal `published` status had internal quantity changes.

## 2026-10-10 — DynaTrade batch 33 applied to RealTrack

- Created FEBI-33602 as a ready listing and updated existing FEBI-43556 in place. Both use workbook quantities, New condition, agreed USD pricing and Superior shipping, official FEBI photos, and fitments validated against the active U.S. MVL. Production health checks passed; neither listing was published to eBay. The applied CSV and manifest are recorded in `docs/operations/DYNATRADE_CSV_ENRICHMENT.md`.

## 2026-10-10 — eBay publish quantity capped

- eBay publish requests now cap each listing's available quantity at 10 across the standard, queued, legacy adapter, and variation-family publish paths. The saved channel quantity reflects the capped amount.

## 2026-10-10 — Inventory part photos visible in details (initial release)

- The inventory details modal now shows a larger, full-fit primary photo and a thumbnail strip for additional part pictures near the title. Image frames now size their contained image correctly so `cover` and `contain` layouts work as intended. Deployed frontend-only as `realtrackapp-frontend:inventory-photo-fix-20261010`; the frontend and `/api/health` returned HTTP 200, and backend health remained healthy.

## 2026-10-10 — DynaTrade CSV batch 33 staged (pre-application checkpoint)

- Batch 33 staged FEBI-33602 and FEBI-43556 with 35 detailed eBay/MVL compatibility rows, visually reviewed live official product images, descriptions, source quantities, AED-to-USD prices, `Condition=New`, and the requested Superior $38.99 shipping policy. The independent workbook and image/pricing/policy audit passed before application. The staged master was v99 with 244 verified products and 49,919 fitment rows. This staging checkpoint made no production write; the later application is recorded in the separate entry above, and the current master is v100.
- The reviewed-batch preparer and audit require MPN token boundaries in eBay titles and allow a selected replacement image to reference the prior source gallery. This prevents a longer number such as `ADU172211` from being accepted as MPN `172211`; that FEBI row remains held for identity review.

## 2026-10-10 — Shared New-condition listing images

- New-condition listing galleries use the shared WebP images in F1, F2, F3 order. The source images are converted once, uploaded to content-addressed shared S3 keys, and reused. The `ebay:backfill-new-condition-images` script updates application catalog, listing, and published-listing image fields with a dry-run-first workflow and a JSON backup; it does not revise live eBay listings.

## 2026-10-10 — Add Part draft-first fix deployed

- Production now runs `realtrackapp-backend:add-part-save-timeout-20261010` and `realtrackapp-frontend:add-part-save-timeout-20261010`. Add Part saves and returns its draft before optional Image Drive lookup; background photo attachment re-reads the listing so a later operator photo is preserved, and automatic identification starts only after enough photos are saved.
- The Add Part request now has a 45-second client timeout with a warning to check Inventory before retrying. The homepage and `/api/health` returned HTTP 200 after deployment, database and memory checks were up, and all five containers were running. The production browser reached the login screen, so a signed-in save was not exercised. No catalog/listing rows were imported or changed.

## 2026-10-10 — DynaTrade CSV preparation and review

- Batch 28 adds BOSCH-3397005046 with a visually reviewed 900-by-900 actual-product photo and 12 exact active `US_MVL_2026_05` configurations for 1998–1999 Mercedes-Benz S320, S420, S500, and S600 applications listed by Bosch's U.S. catalog. Year-2000 applications remain excluded pending build-date validation. The v94 master has 237 verified CSV products, 196 held rows, two research holds, 4,874 pending rows, and 49,637 detailed fitments. The independent audit passed source preservation, image hash, exact fitments, AED/USD price rules, and Superior policies; no production write occurred.
- The reviewed-batch CSV preparer now accepts explicit per-product catalog-check wording, recognizes only numeric-leading Mercedes `A` and Chrysler `K` OE prefixes, and allows an image replacement to cite any URL in the source row's prior gallery. This records the evidence and replacement history without overstating Bosch's OE cross-reference.
- Batch 28 prices the AED 136.425 cost at $37.15 converted cost and $74.30 sale price under the >$25 rule, with the $38.99 Superior shipping policy. Bosch's catalog does not publish a direct OE cross-reference to the supplier's 2208201845 value; the row records that limitation.
- Batch 25 adds FEBI 181242 and HENGST E1776L with 56 detailed fitments. Official FEBI and Hengst sources confirm product identity, references, and technical data; both visually reviewed actual-product photos passed fresh live hash checks. Fitments match the active production MVL; 20 of 38 raw FEBI eBay compatibility records are excluded because they do not reconcile to complete active U.S. vehicle rows. The independent audit passed all 6,046 source rows, fitments, AED/USD pricing, and Superior policies. The v91 master has 234 verified products, 196 held rows, and 4,879 pending rows; no production write occurred.
- Batch 24 adds FEBI 172879 and 179289 valve-cover gaskets plus FEBI 178884 additional water pump, with 3,677 exact fitments. Fresh official PartsFinder pages confirm article types and OE references; all three visually reviewed 1500-by-1500 product photos passed fresh live hash checks. The independent audit passed all 6,046 source rows, fitments, pricing, and Superior policies. The v90 master has 232 verified products, 196 held rows, and 4,881 pending rows; no production write occurred.
- Batch 23 adds FEBI 104873, 174408, 16343, 173581, and 46653 with 918 exact fitments across Jaguar, Land Rover, BMW, Audi, and Peugeot. Fresh official PartsFinder pages verify each article and OE reference; all five visually reviewed 1500-by-1500 product photos passed current live hash checks. The independent audit passed all 6,046 source rows, exact fitments, pricing, and Superior policies. The v89 master has 229 verified products, 199 held rows, and 4,881 pending rows; no production write occurred.
- Batch 22 adds FEBI 174477, 34854, 172394, 192796, and 108638 with 252 exact Porsche, Land Rover, and Jaguar fitments. Live official PartsFinder pages confirm exact article types and OE references; the five visually reviewed 1500-by-1500 product photos passed fresh image-hash checks. The independent audit passed all 6,046 source rows, fitments, pricing, and Superior policies. The v88 master has 224 verified products, 204 held rows, and 4,881 pending rows; no production write occurred.
- Batch 21 adds FEBI 34293, 177109, 47368, 108577, and 107274 with 185 exact fitments across Land Rover, Volvo, Porsche, and Jaguar. Live PartsFinder pages confirm exact articles and OE references; the five visually reviewed 1500-by-1500 official photos passed fresh image-hash checks after correcting their links to the full-size gallery. The independent audit passed all 6,046 source rows, fitments, prices, and Superior policies. The v87 master has 219 verified products, 209 held rows, and 4,881 pending rows; no production write occurred.
- Batch 20 adds five FEBI parts (34384, 39737, 24493, 31822, 185706) with 123 exact Land Rover, Dodge, and Mercedes-Benz fitments. Live PartsFinder pages confirm the exact FEBI articles and OE references; all five refreshed 1500-by-1500 official photos show the actual parts and passed visual/hash review. The independent audit passed the 6,046-row source, fitments, pricing, and Superior policies. The v86 master has 214 verified products, 214 held rows, and 4,881 pending rows; no production write occurred.
- Batch 19 adds five FEBI products (108213, 108214, 170680, 24771, 29800) with 117 Porsche, Mercedes-Benz, and Kia fitments. Official PartsFinder pages confirmed exact article identities and OE references. All five current 1500-by-1500 official images show the actual parts and passed visual review plus a fresh live hash audit. The independent audit passed the 6,046-row source, detailed fitments, AED/USD pricing, and Superior policies. The v85 master has 209 verified products, 219 held rows, and 4,881 pending rows; no production write occurred.
- Batch 18 adds FEBI 10266 with 21 Mercedes-Benz fitments matched to active `US_MVL_2026_05`. The official PartsFinder article confirms thermostat-with-sealing-ring identity and OE 616 200 04 15. The current 1500-by-1500 gallery photo was re-fetched and visually reviewed after its bytes changed; the independent live hash audit passed. Exact AED cost converts to $6.47, pricing at $38.00 with the agreed Superior policies. The v84 master has 204 verified CSV products, 224 held rows, and 4,881 pending rows; no production write occurred.
- Batch 17 adds BOSCH 0280218002 with 70 detailed fitments: 60 saved eBay/MVL Volkswagen rows and ten Seat Toledo rows supported by Bosch's official U.S. applications and exact active-MVL records. Its official 1400-by-1400 product gallery image was visually reviewed and re-fetched with an unchanged JPEG signature/hash. The independent audit passed workbook preservation, exact identity, fitments, AED/USD price rules, and Superior policies. The v83 master has 203 verified products, 225 held rows, and 4,881 pending rows; no production write occurred.
- The reviewed-batch preparer and audit now support separately sourced official-application/MVL fitment rows with a hashed MVL snapshot, and require both image dimensions to meet the 500-pixel minimum. The image audit validates generic MIME responses against actual JPEG bytes.
- Batch 16 adds BOSCH 0280218175 with a visually verified live 1500-by-1500 photo showing the MPN on the sensor and 90 detailed Audi and Volkswagen fitments. Bosch's U.S. product page confirms OE 03H906461 and its official application lookup agrees with every included make/model/year row. The independent audit passed all 6,046 source rows, pricing/policies, ePID identity, active-MVL details, and current image hash. The v82 master has 202 newly verified CSV products, 226 held rows, and 4,881 pending rows; no production write occurred.
- Batch 15 adds BOSCH 0281002956 with a visually checked live 1000-by-946 product photo and 69 detailed Audi and Volkswagen fitments. Bosch's official U.S. application lookup agrees with every included make/model/year row; the independent audit passed all 6,046 source rows, pricing/policies, ePID identity, active-MVL details, and current image hash. The v81 master has 201 newly verified CSV products, 227 held rows, and 4,881 pending rows; no production write occurred.
- Batch 14 adds BOSCH 0392020073 with a visually checked live 1500-by-1500 product photo and 341 detailed Audi, Porsche, and Volkswagen fitments. Bosch's official application lookup agrees with every included make/model/year row; the independent audit passed all 6,046 source rows, pricing/policies, ePID identity, active-MVL details, and current image hash. The v80 master has 200 newly verified CSV products, 228 held rows, and 4,881 pending rows; no production write occurred.
- Batch 13 adds HENGST E1000L with 156 exact Volvo fitments. The 1500-by-1500 exact-MPN retailer image was visually reviewed and re-fetched with an unchanged hash; official HENGST catalog evidence confirms article type, EAN, dimensions and OE references. The independent audit passed all 6,046 source rows, pricing/policies, ePID identity and active-MVL details. The v79 master has 199 newly verified CSV products, 229 held rows and 4,881 pending rows; no production write occurred. E1722L remains held for insufficient verified photo resolution.
- Batch 13's photo replacement is evidence-bound to the previously selected URL, and its fitment provenance records the exact Sell Metadata API detail source. The Browse API call returned HTTP 429; cached detailed fitments were reused.
- Batch 12 adds 37 FEBI products and 6,807 detailed compatibility rows. All 37 live official 1500-by-1500 product photos were visually reviewed and re-fetched with unchanged SHA-256 hashes. The independent audit passed workbook preservation, official identity/OE checks, saved eBay identity, exact MVL fitments, Superior pricing/policies, and prior-batch exclusion. The v78 master retains all 6,046 rows with 198 new verified CSV products, 230 held rows, and 4,881 pending rows; no production writes occurred.
- Fixed the incremental CSV preparer to rebuild make/model/year compatibility summaries from selected detailed fitments, preserving year gaps instead of merging ranges across missing years. The batch 12 audit caught and confirmed the fix.
- The eBay Browse request returned HTTP 429, so batch 12 reused saved Sell Metadata API compatibility evidence without repeating the rate-limited call. Production import remains on demand; email was canceled.
- Batch 12 image checks now compare the live official-image hash with the saved visual approval; changed images stay held until they are downloaded and reviewed again. A read-only audit of production batch-one records identified two selected-source fitment mismatches, documented in the current-state and enrichment strategy files.
- Added a local, repeatable CSV preparation/export workflow with reviewed image evidence, official OE reference checks, MVL fitment reconciliation, Superior pricing and policies, and explicit hold reasons.
- Prepared 138 new verified CSV products: 105 FEBI and 33 Hengst, with 30,542 detailed compatibility rows. The full 6,046-row v72 master retains pending and held records and preserves the original supplier columns.
- Added bounded parallel official FEBI/Hengst research, persistent checkpoints, photo approvals tied to content hashes, and independent source/price/image/fitment audits. FEBI 27086 now uses its visually reviewed official full-size photo, exact BMW OE reference, and 90 preserved U.S. MVL compatibility rows. Restored one original supplier description changed by the older master and retained the previous wording separately; AED input precision is preserved.
- Production import remains on demand. This workflow performs no production writes, publishing or email notifications. See `docs/operations/DYNATRADE_CSV_ENRICHMENT.md`.
- Recorded the end-to-end evidence, CSV, on-demand import, and production verification plan in `docs/operations/DYNATRADE_COMPLETION_STRATEGY.md`.
- Batch 6 adds ten FEBI products and 7,750 exact fitment rows after live official-image fetch and visual review. Fixed `Volkswagen (VW)` make normalization and made new descriptions product-specific from the official catalog; unverified technical attributes remain blank.
- Added an incremental next-batch preparer and extended CSV export/audit coverage through batch 6.
- Added reviewed cross-brand CSV preparation and auditing. Batch 7 adds BOSCH 0261210364 with 71 Porsche fitment rows; batch 8 adds two BOSCH sensors with 545 fitment rows. The 66 unconfirmed Audi rows for 0261210147 stay excluded while the 148 supported Volkswagen rows remain active.
- The v74 master retains 6,046 source rows and records 141 newly verified CSV products, 287 held rows, and 4,881 pending rows. Batches 7 and 8 passed current image URL/content-hash, official reference, pricing/policy, and exact fitment audits; no production writes occurred.
- Extended the reviewed-batch pipeline to validate brand-specific official source hosts, re-reviewed image-source evidence, punctuation-normalized OE references, and explicitly reconciled excluded makes. Batch 9 adds FEBI 47894 with 154 BMW fitment rows; four unsupported Lexus rows remain excluded.
- The v75 master retains all 6,046 source rows and records 142 newly verified CSV products, 286 held rows, and 4,881 pending rows. Batch 9 passed its live image, source workbook, price/policy, official reference, and detailed fitment audit; no production writes occurred.
- Batch 10 adds FEBI 11816 and FEBI 22251 with live-checked, visually reviewed official images, exact manufacturer reference checks, factual descriptions, Superior pricing/policies, and 1,010 detailed fitment rows. The 53 Lincoln and Mercury eBay fitments for FEBI 22251 remain excluded because official evidence did not support them.
- The v76 master retains all 6,046 source rows and records 144 newly verified CSV products (108 FEBI, 33 Hengst, 3 Bosch), 284 held rows, and 4,881 pending rows. Batch 10 passed the independent source, image, pricing/policy, identity, and fitment audit. Production remains unchanged; no listing import or email was made.
- Batch 11 adds 17 HENGST products and 4,210 detailed compatibility rows. Exact MPN/OE identity, eBay catalog identity, visually reviewed current product image hashes, pricing/policies, source workbook preservation, and MVL fitments passed the independent audit. Three H326WK Volkswagen rows remain excluded pending official application support; production was not written.
- The v77 source-preserving master retains all 6,046 rows, with 161 new verified CSV products, 267 held rows, and 4,881 pending rows. Fixed the reviewed-batch audit's vehicle-summary reconstruction to preserve year gaps and compact only consecutive fitment years. No production import occurred.

## 2026-10-10 — Accurate catalog publish-readiness checks

- Catalog fitment review now distinguishes year/make/model rows with different trims, engines, or platforms. Case/spacing-only copies of the same MVL record do not block readiness; conflicting records for one vehicle configuration still require review.
- U.S. marketplace readiness accepts one verified item image, matching eBay's documented minimum picture requirement for item listings.

## 2026-10-09 — Fashion intake handoff and activity reporting

- Fashion photo intake normalizes all uploaded JPEG, PNG, and WebP photos to WebP and queues garment identification in the background so capture can continue while items are processed.
- Processed, non-quarantined intake items now wait for an explicit **Add to Catalog** action. Catalog records who added each item and when; pending captures stay out of the Catalog list.
- Store and shipping/payment/return policy selection now happens when catalog items are selected for publishing. Each selected store can use its own policies or store defaults.
- Added a filterable Fashion activity report and CSV export with item details, uploader/catalog-adder, processing and review status, and per-store publication outcomes/policies.

## 2026-10-09 — Photo-verified Add Part enrichment

### Fixed
- **Wrong Add Part identity:** `/listings/new` saves an unidentified draft instead of assigning a title from an MPN-only seller match. Identification now requires at least two saved photos; inconclusive photo evidence fails closed and requires manual review rather than falling back to a potentially unrelated seller listing.
- **Photo identity overwritten during enrichment:** a failed validation gate cannot write generated listing fields, and a successful visual lookup keeps its title, part type, brand, and description through later enrichment. Newly added photos can restart a completed enrichment run.
- **Duplicate image enrichment requests:** the inventory image-save endpoint is the single trigger, avoiding duplicate jobs when photos are uploaded from the detail modal.
- A photo-less Add Part draft no longer waits for optional Image Drive search. Drive photos attach in the background after re-reading the saved listing so a later user upload is not overwritten; photo-based identification starts only when enough saved images are present. The draft-save request now aborts after 45 seconds and advises checking Inventory before retrying to avoid a duplicate.

## 2026-10-08 — Keep Add Part responsive during eBay rate limits

- Interactive part lookups now fail fast on eBay Browse 429 responses rather
  than waiting through long retry delays before falling back to AI lookup.
- The browser aborts an interactive part lookup after 45 seconds, shows a
  retry notice, and continues saving the draft with a fallback title.
- Add Part saves no longer wait for duplicate Browse/AI/MVL auto-enrichment;
  placeholder drafts continued that best-effort enrichment in the background.
  A successful pre-save lookup was not repeated during draft creation.
- Superseded 2026-10-09: Add Part no longer identifies photo-less placeholder
  drafts from MPN alone; see **Photo-verified Add Part enrichment** above.

## 2026-10-08 — Search every applicable Prowler catalog year (optimization v28)

- Prowler searches now explicitly target the year-specific Mopar factory
  catalog PDFs for 1997, 1999, 2000, and 2001, plus an exact fitment source for
  the 2002 endpoint. A later-model product page alone cannot truncate earlier
  exact-part catalog evidence.
- If the first two searches omit years, the one alternate search targets the
  factory catalog archive and exact component row instead of repeating a broad
  vehicle-generation lookup.

## 2026-10-08 — Combine exact-MPN year-specific OEM catalogs (optimization v27)

- A source-verified interval can now be assembled from exact-MPN year-specific
  factory catalog pages when each cited page places the MPN beside the listed
  component. Every actual model year between the title endpoints still needs
  exact-part evidence; unsupported years are not filled in.
- The Prowler lookup recognizes Mopar's legacy omitted leading zero only for
  `0LP...` Prowler identifiers and its actual 1997, 1999–2002 model-year set.
  It can combine Plymouth-era factory diagrams with Chrysler-era exact-part
  ranges without inventing a 1998 Prowler.
- Only cited source years are retained as review-only rows. They remain outside
  `fitment_data`, publish compatibility, and automatic publishing.

## 2026-10-08 — Require part-specific ranges in cited catalog text (optimization v26)

- The model's JSON claim and quoted evidence are no longer accepted as source
  text. A year interval must be extracted from the actual cited catalog page.
- Range context must identify the exact MPN or requested part name, preventing a
  generic vehicle-generation heading from widening a part-specific interval.
- Prowler lookups now target year-specific Mopar diagrams and exact-MPN listings;
  all catalog fitment stays review-only and publishing remains disabled.

## 2026-10-08 — Use diversified exact-MPN searches for missed fitment (optimization v25)

- Each first-pass lookup now uses two distinct exact-part searches: the quoted
  MPN alone, then the same MPN with the requested vehicle, part name, and
  fitment terms. Only unresolved items get one different alternate query.
- This improves catalog coverage without repeating successful lookups or
  reprocessing products that already have a year prefix. Exact identifier,
  same-page vehicle/range, replacement-break, and review-only safeguards remain.

## 2026-10-08 — Improve exact-MPN catalog lookup for VW Golf GTI titles (optimization v24)

- The OEM lookup now searches the quoted complete part number first, with a
  separate vehicle-and-part query only when the exact-number search fails.
  Search excerpts include more of the catalog application table while keeping
  each attempt to one Exa query.
- The validator recognizes Volkswagen's US catalog label `GTI` as the
  `Golf GTI` listing variant only when the cited exact-MPN page explicitly
  shows that GTI application. It does not accept generic Golf fitment rows.
- Cited ranges remain title-only review evidence; marketplace compatibility
  and publishing are unchanged.

## 2026-10-08 — Reject supersession-only MPN matches (optimization v23)

- Exact-MPN matching now checks complete identifiers with punctuation-aware
  boundaries, so a base MPN is not mistaken for a suffixed replacement.
- A citation that mentions the requested number only as a replaced,
  superseded, or interchangeable number cannot establish fitment. The same
  cited catalog page must still show the requested vehicle and explicit year
  interval. This remains title-only review evidence.

## 2026-10-08 — Accept exact MPNs in catalog page identity (optimization v22)

- Exact OEM product pages can place the full part number in the URL or page
  title while the cited excerpt contains only the vehicle application table.
  The lookup now accepts an exact MPN token in either part of that same cited
  page.
- The page must still be a catalog/OEM source and explicitly support the
  requested vehicle and complete year endpoints. This remains title-only
  evidence; no compatibility is approved and no listing is published.

## 2026-10-08 — Add one alternate search for rejected MPN lookups (optimization v21)

- If the first exact-MPN response is truncated or fails the source validator,
  the lookup makes one alternate exact-MPN catalog search with a larger output
  cap. Successful first attempts do not incur another search.
- The retry still requires an exact MPN, cited OEM/catalog page, requested
  vehicle application, and explicit complete endpoints. It never falls back to
  donor-year or model-generation inference.
- Optimization version 21 makes only missing-range or stale products eligible
  for this targeted retry.

## 2026-10-08 — Read exact MPNs from catalog diagram bodies (optimization v20)

- A cited catalog page no longer needs the exact MPN in its title or URL when
  the same page body explicitly contains the exact part-number row and the
  requested model's complete year interval. This supports manufacturer diagrams
  whose URL names the parent assembly.
- The parser still requires the exact MPN in page content, an OEM/catalog source,
  the requested make/model/trim, and explicit contiguous year endpoints from
  that cited page. Intervals remain title-only review evidence.
- Optimization version 20 enables targeted retries for products blocked by
  this citation-title restriction.

## 2026-10-08 — Retry truncated exact-MPN year searches (optimization v19)

- The exact-MPN lookup now makes one capped Exa search with a compact prompt
  and enough output budget for GPT-6 Luna to return the cited year interval.
- If that structured answer is still cut off, it retries once with a larger
  output cap and a shorter recovery instruction. It does not repeat a full
  pipeline pass.
- Optimization version 19 makes only previously blocked or stale products
  eligible for this targeted title-range retry. Citation, exact MPN, vehicle,
  endpoint, and review-only compatibility checks remain in force.

## 2026-10-08 — Extract complete ranges from exact-MPN catalog citations (optimization v18)

- GPT-6 Luna searches with capped Exa result volume and minimal reasoning. The
  optimizer now reads cited page excerpts directly when the model uses its
  response budget on search and returns no JSON, instead of treating that
  citation-backed lookup as a miss.
- A title range requires an exact-MPN catalog product page and the requested
  model/trim application. Production-date caps apply only when the catalog shows
  a replacement suffix for the same option-code row; unrelated date breaks do
  not truncate the range.
- Exact OEM intervals can guide draft titles even when the target marketplace
  has no matching MVL model. Those rows stay review-only/rejected and never
  enter publish compatibility. Combined `Plymouth Prowler` brand values now
  resolve to make/model for exact-MPN research.
- Optimization version 18 retries only listings missing a complete title range.

## 2026-10-08 — Validate citation evidence independently of the model flag (optimization v17)

- The OEM lookup no longer discards a response solely because Luna sets
  `verified=false`; the server checks the cited URL, exact MPN, requested
  make/model/trim, and both explicit year endpoints before accepting a range.
- Candidate excerpts remain title-only review evidence. A missing citation,
  excerpt, exact identifier, or matching vehicle/range still blocks the title.
- Bumped optimization to v17 for targeted retries of previously blocked rows.

## 2026-10-08 — Validate URL-only OEM citations with exact excerpts (optimization v16)

- GPT-6 Luna now returns a short exact excerpt from the cited OEM page when
  Exa supplies only a URL/title citation. The server still requires the exact
  MPN, vehicle variant, source citation, and both range endpoints to match.
- Scoped the Plymouth/Chrysler make transition to Prowler fitment only; other
  makes cannot cross-match. Evidence remains review-only and titles remain
  unpublished until separately approved.
- Bumped optimization to v16 to retry only targeted products with this lookup
  behavior.

## 2026-10-08 — Accept exact OEM diagram evidence from cited page content (optimization v15)

- OEM lookup source classification now checks cited page content as well as the
  page title and URL. Parts diagrams often show the exact part-number row and
  model-year application in the body while using a generic title that does not
  say `catalog` or `OEM`.
- Exact MPN, make/model/trim, and both year-endpoint checks remain mandatory;
  cited year ranges remain title-only review evidence and do not authorize
  compatibility publishing.
- Bumped listing optimization to v15 so products rejected by the old source
  label check are eligible for a fresh, targeted OEM lookup.

## 2026-10-08 — Reuse exact-MPN OEM year citations during enrichment (optimization v14)

- Fitment discovery now recognizes a saved, MVL-validated exact-MPN OEM citation
  with one unique matching year interval, even when MVL rows omit years inside it.
  It reuses that evidence instead of repeating eBay and GPT-6 Luna catalog searches.
- When research is needed, the OEM lookup searches manufacturer diagram synonyms
  for the part type and briefly caches exact-query hits and misses. OEM citation
  rows are accepted only when the cited exact MPN matches the product identifier.
- Title generation and lookup avoidance share the same citation, make, model/trim,
  MPN, and year-span checks. The interval remains review-only and title-only; it
  never fills publish compatibility or approves a listing.

## 2026-10-08 — Preserve cited OEM year intervals in draft titles (optimization v13)

- When MVL row validation omits an individual year, the title builder can now
  use an explicit inclusive year interval from cited, exact-MPN OEM catalog
  evidence that matches the requested model/trim. The citation must contain
  the product MPN, make, and target application.
- The interval remains title-only review evidence; it does not fill approved
  compatibility or enable publishing. Conflicting, overlong, or unmatched
  intervals remain blocked for review.
- Bumped listing optimization to version 13 so the improved title evidence
  rule is applied to previously processed products.

## 2026-10-08 — Group complete title ranges across equivalent trim labels (optimization v12)

- Title-range selection now groups target-MVL rows by canonical make/model and
  the requested variant tokens, so catalog descriptions such as `GTI` and
  `GTI Autobahn Hatchback` can contribute to the same complete contiguous span.
- Generic model titles continue to require the same trim label; unrelated
  variants are not merged. Review-only exact-MPN evidence remains excluded from
  publishable compatibility.
- Preserved meaningful single-letter vehicle tokens such as `R` during title
  range matching and bumped the optimizer version to 12.

## 2026-10-08 — Complete OEM year-range search and MVL model normalization (optimization v11)

- Extended GPT-6 Luna catalog research to compare multiple exact-MPN catalog
  queries and seek the complete contiguous application range; a single
  donor-year example no longer substitutes for full fitment.
- Kept lookup search pinned to Exa and corrected AI usage reporting to the
  current $0.007 per search query, alongside GPT-6 Luna token usage.
- Mapped combined catalog model values to a canonical eBay MVL base model and
  preserved the target variant and catalog trim as separate fields. A result
  that cannot be represented without losing the requested model/trim remains
  blocked for review.
- Kept exact-source, make, model/trim, year-endpoint, and MVL checks. Catalog
  rows remain review-only and do not become publishable compatibility.
- Bumped optimizer version to 11 so products processed under the incomplete
  v10 behavior are eligible for a fresh pass.

## 2026-10-08 — Exact OEM catalog title enrichment (optimization v10)

- Added an automatic OpenRouter GPT-6 Luna web-search fallback for products
  missing a complete, exact-part year range. A cited OEM catalog page must
  support the exact MPN, requested make/model/trim variant, and year span;
  citations that do not carry that evidence are rejected.
- Kept base model and trim separate for target-market MVL checks and title
  range grouping, preventing ranges from crossing vehicle trims (such as Golf
  and Golf GTI). Seller hints remain review-only and cannot suppress OEM
  lookup when they lack a target-MVL-checked range.
- Accepted model and trim when a cited exact-part catalog lists them in
  separate fields or entries, while still requiring every target variant token
  to appear in the cited application evidence.
- Accepted catalog evidence is review-only and excluded from approved
  compatibility. Donor year, platform spans, and noncontiguous fitments cannot
  fill a missing title range. Products without supported evidence remain
  blocked for review.
- Bounded concurrent searches to four per backend process and made the lookup
  cache in-flight-only. OpenRouter web-search usage is included at its current
  per-request cost.
- Bumped optimizer version to 10. Build and deployment/job results are
  recorded in `docs/operations/CATALOG_PIPELINE.md` after the production pass.

## 2026-10-08 — Re-run stale optimizations with exact-part title evidence

- Fixed: title generation no longer falls back to the donor year or a whole
  platform-generation span when no part-number-matched fitment years exist.
  A single exact-MPN/OEM-catalog year may be shown; multiple years must form a
  contiguous range and pass the target marketplace MVL. Platform-generation,
  donor, sibling-part, and unvalidated review rows cannot supply title years.
  Missing evidence keeps the item blocked for review.
- Bumped listing optimization to version 8 so completed products are
  reconsidered with the corrected evidence rule.
- Fixed: the explicit **Optimize All** action now forces a fresh pass even when
  the job-level marketplace state is already `needs_review` or `completed`;
  background retries retain their resume and skip behavior.
- This supersedes the 2026-10-05 donor-generation title fallback below; a
  donor vehicle or platform span is not evidence that a specific part fits.
- Deployed backend image `realtrackapp-backend:title-fitment-20261008-v3`,
  layered over active image `realtrackapp-backend:title-fitment-20261008-v2`. Backend
  health is `ok`; frontend and data services were not recreated. The prior
  image remains the rollback target.
- Pipeline `7239edb3-770b-4b18-a60f-288b5bdeba8c` was re-optimized over SSH
  through the application's listing optimization service. Results are reported
  after the run completes; no eBay listing was published and no compatibility
  was approved.

## 2026-10-07 — Catalog photo replacement and part identity safeguards

- Fixed: uploading replacement photos in the Auto Parts catalog now saves any
  pending image removals/reordering before appending the new uploads. The modal
  treats the automotive `listing_records` image list as authoritative so stale
  catalog-product image copies cannot resurrect deleted photos.
- Fixed: Add Part now supplies the selected vehicle make to part lookup. eBay
  results must contain an exact MPN and cannot be used when their make evidence
  conflicts with the selected vehicle. Fetch Details prioritizes usable photos
  and rejects a visual result that identifies a different part number.

## 2026-10-07 — eBay publish and policy-sync test suites green again

- Fixed: `ebay-publish.service.spec.ts` (20 failures) and
  `ebay-policy-sync.service.spec.ts` (2 failures) were asserting superseded
  behaviour. No publish-service logic changed. The specs now pin
  `EBAY_LISTING_API_MODE=inventory` for Inventory API tests, because new listings
  default to Trading API. They also cover the bounded hash-suffixed conflict-SKU
  namespace, the 2026-09-30 rule that a fresh publish failing with 25713 fails
  closed without deleting the Inventory item, the marketplace-default fallback for
  missing named policy profiles (and the block when no default exists),
  description-only fitment for Motors categories without structured rows, and
  compatibility readback failures raised by `EbayCompatibilityReconciliationService`.
  Added reconciler coverage for a readback missing expected rows.
- Fixed: eBay policy sync left a 30-second inventory-location timeout timer
  pending after every marketplace fetch; it is now cleared once the fetch settles.
  The spec mocks the atomic `manager.transaction` replace and asserts that a failed
  policy fetch leaves stored policies untouched.
- Fixed: `backend/src/scripts/backfill-brand-images.ts` had a missing closing
  parenthesis (`TS1005` at line 434) that blocked `tsconfig.build.json` builds.

## 2026-10-07 — Fashion identification: Jev-selected model, fallback, fuller autofill

- Fashion photo identification now uses `google/gemini-3.1-flash-lite` with an automatic
  fallback to `google/gemma-4-31b-it`, chosen by Jev (OpenRouter `/alpha/decisions`) from
  a 20-model benchmark on 5 labelled garments. Override with `FASHION_AI_MODEL` /
  `FASHION_AI_FALLBACK_MODEL` (now passed through `docker-compose.yml`).
- Fixed: a non-JSON or truncated model reply was shown as a successful analysis with
  empty fields. It now retries on the fallback model, then reports a failure.
- Fixed: single-garment photo sets could show the "more than one garment" alert.
- Fixed: AI titles longer than eBay's 80 characters are trimmed on a word boundary
  before review instead of being cut at publish.
- Fixed: Fashion item specifics no longer include raw attribute keys and free-text
  defect notes; only eBay aspect names are sent, values capped at 65 characters.
- Added Fashion "Listing details" fields (country of manufacture, features, season,
  occasion, theme, vintage, garment care), filled by identification, plus department
  normalization (`Men`/`Women`/...) and `Size Type` / condition autofill. Prompt
  `fashion-image-identification-v2`.
- Added `google/gemma-4-31b-it` to the AI cost table (it was logged at gpt-4.1-mini rates).

## 2026-10-06 — Fix production Auto Parts catalog navigation

- The production Auto Parts sidebar had a fully prefixed Catalog path that the
  shell prefixed a second time, sending clicks to `/auto-parts/auto-parts/catalog`
  and the route fallback. The corrected release uses the relative `/catalog`
  path; the shell resolves it to `/auto-parts/catalog`.
- Deployed frontend image `realtrackapp-frontend:catalog-route-fix-20261006`
  from `/home/ubuntu/realtrackapp-main-release-20261005`. The previous image
  `realtrackapp-frontend:stock-20261005` and Compose override backup were kept
  for rollback. The backend and database services were not restarted.
- The frontend build succeeded, and the public canonical catalog route returned
  HTTP 200 after deployment; backend, Postgres, Redis, and PgBouncer remained
  healthy.

## 2026-10-06 — Apply exact OEM applications to UPL-235 draft titles

- Researched the screenshot's nine UPL-235 MPNs. Five had exact OEM catalog
  applications that also passed the active US MVL (`US_MVL_2026_05`):
  `BU1-15777` → `2011 Infiniti FX35`, `BU1-15789` → `2014-2016 Toyota Corolla`,
  `BU1-15794` → `2010-2015 Audi A4`, `BU1-15765` → `2007-2009 Audi Q7`, and
  `BU1-15746` → `2015 Audi A8 Quattro`. Four unsupported MPNs remain blocked.
- Three initial optimizer outputs widened the title years beyond the
  exact-part applications. Those titles were corrected to the catalog ranges;
  generated platform/sibling rows were removed. The five titles now match in
  `catalog_products` and draft `listing_records`.
- Each OEM row remains `needs_review` with `mvlStatus=valid`; `fitment_data` is
  empty, `manual_review=true`, and the listings remain drafts. No eBay listing
  or compatibility publishing occurred. The remaining 48 UPL-235 records and
  72 UPL-234 records remain blocked; the earlier BMW row remains in review.
- Sources: [INFINITI 2011 FX35 catalog](https://parts.infinitiusa.com/v-2011-infiniti-fx35--base--3-5l-v6-gas/electrical--parking-aid),
  [Toyota 82662-02660 catalog](https://parts.longotoyota.com/oem-parts/toyota-fuse-and-relay-center-cover-8266202660),
  [VAG 8K0839016D catalog](https://oemwolf.com/oem-parts/8k0839016d.html),
  [VAG 4L0910441A catalog](https://oemwolf.com/oem-parts/4l0910441a.html),
  [VAG 4H0959107AC catalog](https://oemwolf.com/oem-parts/4h0959107ac.html).

## 2026-10-06 — Canonicalize Bentley donor spelling and repair pipeline titles

- The known source spelling `Bently` now resolves to `Bentley` during make
  normalization and donor filename parsing, allowing the existing model-
  generation title fallback to work for future uploads with that typo.
- Deployed backend image `realtrackapp-backend:main-20261006-bently-alias-00206b9a`.
- Repaired production job `b69699a1-445a-41da-9e58-02a9b9e8becd`: 162 catalog
  and listing titles and 170 export title cells now use the `2005-2013 Bentley
  Flying Spur` generation range. Titles remain at or below 80 characters; all
  listings remain drafts in review, and no eBay listings or compatibility
  approvals were changed. The original CSV is backed up as
  `/app/output/pipeline-b69699a1/US-Motors-Listings-2026-10-05.csv.pre-year-range-20261006`.

## 2026-10-06 — Use exact-part seller hints for reviewed title ranges

- Deployed the isolated backend release `realtrackapp-backend:title-range-20261006`;
  the prior image remains tagged `realtrackapp-backend:pre-title-range-20261006`.
- Re-ran optimization for uploads UPL-2026-000235 and UPL-2026-000234. One
  exact Brand+MPN eBay seller hint for BMW MPN `613507199885` passed US MVL and
  added the `2011 BMW 328I` draft title prefix. The hint remains review-only in
  `fitment_rows`; it did not become published compatibility.
- At the initial retry baseline, 125 products lacked usable exact-part year
  evidence and were blocked with `TITLE_YEAR_RANGE_MISSING` (53 in UPL-235 and
  72 in UPL-234). The later same-day OEM catalog follow-up corrected five
  UPL-235 titles; see the entry above. One other UPL-234 record (`BU1-15375`,
  existing eBay item `307197235705`) remains unchanged with no year range in
  its local title. The retries did not invoke listing or compatibility
  publishing; production health was `ok`.

## 2026-10-05 — Use known model-generation spans in pipeline titles

- Pipeline titles continue to prefer a contiguous fitment span. If one is not
  available, a donor year/make/model that resolves to a known platform
  generation supplies that generation's full year span to the title. This
  fallback affects titles only and never widens or approves compatibility.
- Donor filenames can contain year, make, and VIN without a model. When the
  job has one unambiguous known model in a vehicle-prefixed source title, the
  optimizer reuses it for that single-donor job. Optimization version 4
  invalidates older completed results for a later optimization pass.
- Production drafts were corrected: all 103 Audi A6 titles in pipeline
  `7edda15f-804f-4dbd-ba44-98d901b16a3c` now begin `2011-2018 Audi A6`, and
  all 73 Jaguar XF titles in pipeline
  `f2696bdc-cbe9-4189-ad42-6029fd3fef86` now begin `2008-2015 Jaguar XF`.
  Catalog/listing titles and the two pipeline CSV exports are synchronized;
  the exports have pre-change backups. All listings remain drafts, with no
  eBay item IDs or fitment approvals changed. The production backend was
  deployed as `realtrackapp-backend:main-20261005-year-range-00206b9a` and its
  health endpoint returned `status: ok` after restart.

## 2026-10-05 — Default new eBay listings to Trading API

- Standard new single-item listings default to Trading API `AddFixedPriceItem`
  so their Custom Label remains editable in Seller Hub. Inventory API remains
  an explicit mode for this path. Variation-family item groups and existing
  Inventory API offer-backed listings keep their existing flows.

## 2026-10-05 — Target a single eBay listing for Seller Hub migration

- The Inventory API → Trading API migration command accepts `--item-id` to
  preflight one exact listing across stores, and stops if the ID maps to more
  than one local record. Live migration still requires `--apply --confirm`;
  it ends the old listing and creates a new Trading API listing with a new eBay
  Item ID.

## 2026-10-05 — Warehouse inventory, procurement and channel stock (all verticals)

- New `StockModule` (`/api/stock`) and Stock workspace at `/auto-parts/stock`, `/fashion/stock` and `/business-industrial/stock`. It covers warehouses and bins, a SKU master linked to catalog products, listings and variants, and serial/one-off units. Stock changes are recorded in an append-only movement ledger. It also covers receipts, adjustments with approval, bin moves, damage, transfers with in-transit, blind cycle counts, valuation, aging and a CSV ledger. Design: `docs/architecture/WAREHOUSE_INVENTORY.md`.
- **Fix:** imported orders now reserve stock, shipping deducts it, and cancelling releases it. Previously the `order.new` handler reconciled an empty list, so sales never reduced stock. `order.new` is now emitted by `OrdersService.importOrder` for every new order, and `order.cancelled` is new.
- **Stock that is not on hand:** each SKU is stocked, stock + source, or on demand, and supplier offers can be recorded. A shortfall raises a procurement request. Requests are grouped into purchase orders, and goods received against a PO are reserved for the waiting orders. Suppliers can dropship directly to the buyer. Reorder-point suggestions are included.
- Channel quantity is computed per store as linked-warehouse availability − buffer + capped supplier quantity. It is pushed to eBay (Inventory API offers / Trading listings) and PartsBazar360 only when the new `stock_channel_push` flag **and** the store's push switch are on. Otherwise it runs in shadow mode with drift reporting.
- Vertical hooks: Auto Parts warehouse intake and B&I serialized units receive stock automatically once a workspace has run stock setup. The Fashion quick-capture hook and warehouse mirroring ship with the Fashion quick-capture feature.
- Migration `1791100000000-CreateWarehouseInventory` (additive) and 12 `stock.*` permissions. The legacy `inventory_ledger` / `inventory_events` / `inventory_movements` / `store_inventory_allocations` tables are superseded.
- Verified with PostgreSQL integration tests (17 passing) and a full migration-chain replay from an empty database. An end-to-end API run and a UI walkthrough were done on an isolated local backend. Not deployed.

## 2026-10-04 — Omni Core infographic video advertisement

- Added an original 30-second automotive-parts campaign in landscape and vertical formats, with local motion graphics, an original instrumental track, posters, and editable rendering source under `assets/marketing/omni-core-ad/`. Creative scope and feature grounding are documented in `docs/product/OMNI_CORE_VIDEO_AD.md`.

## 2026-10-04 — Repair duplicated Auto Parts catalog links

- Auto Parts deep links with a repeated `/auto-parts` prefix now redirect to the canonical route, preserving query parameters and hashes. For example, `/auto-parts/auto-parts/catalog` redirects to `/auto-parts/catalog`.

## 2026-10-04 — Add compatible year ranges to Infiniti Q50 pipeline titles

- Revised the 61 published eBay listings in pipeline `35833336-07b2-42b3-8661-083390b55e12` with part-number-based Q50 year ranges, verified each live Inventory item title, and synchronized the 62 catalog/listing rows and pipeline CSV Title cells. The one soft-deleted draft received a database/export title update only and remains deleted.
- Compatibility rows remain `needs_review` with manual review enabled; this title repair did not approve or publish eBay fitment. See `docs/operations/OEM_FITMENT_LOOKUP_2026-10-04.md` for the applied ranges, references, and caveats.

## 2026-10-03 — Require evidence-backed year ranges in pipeline titles

- The donor filename parser now canonicalizes the source spelling Infinity to Infiniti, so a matching year/make/model/VIN upload can supply its donor vehicle context.
- Donor year supplies vehicle context only. Title ranges must come from contiguous, part-number-matched fitment years that pass MVL checks; missing or mismatched ranges block optimization. Exact-MPN lookup uses the canonical donor make when the catalog brand also contains a model.
- Bumped optimization version to 3 so previously completed products are reconsidered on their next optimization pass.

## 2026-10-02 — Preserve fitment year ranges when AI generation fails

- **Permanent exact-MPN enrichment fallback:** when existing product/title evidence does not provide a bounded year range, fitment discovery now queries eBay Browse by brand + MPN. Only exact normalized Brand+MPN matches can contribute Year/Make/Model hints; every year is checked against the target marketplace MVL. These seller-reported hints stay `needs_review` and may guide a contiguous title range only. They are excluded from `fitment_data`, descriptions, AI fitment input, and publish compatibility until separately approved. No range is invented when exact hints or MVL validation are unavailable. Optimization version 2 invalidates stale completed optimization results the next time those products enter optimization again.
- Pipeline optimization now supplies a matching upload filename's donor year/make/model before fitment discovery and persists the parsed donor fields. Validated fitment years remain the title's year-range source; available ranges are enforced even when a generated German title omits them, and deterministic title generation still runs if the AI batch is unavailable.
- Corrected all 41 draft titles for pipeline job `cde847fd-f3e1-46fc-8052-cf0386a5ea58` using exact OEM part-number lookup ranges, and updated the CSV export to match the database. Added 191 source-noted year-level fitment rows as `needs_review` with manual review enabled; none are publishable until VIN/configuration and eBay Motors Vehicle Lookup validation. No eBay listings were published or changed. Source/range record: `docs/operations/OEM_FITMENT_LOOKUP_2026-10-02.md`.

## 2026-10-01 — Keep new Trading API custom labels editable

- New fixed-price listings published through Trading API continue to send the seller SKU as eBay's Custom Label, while using ItemID inventory tracking. eBay can revise the label on these listings after publication. Existing listings already managed by SKU cannot switch tracking modes in place and must be relisted before their labels can be changed.

## 2026-09-30 — Revise existing eBay offers through their owning API

- Publish now checks the existing channel mapping before honoring Trading mode. Inventory-managed listings keep their offer identity: active offers are revised in place through Inventory API `updateOffer`; offers eBay reports as `UNPUBLISHED` are updated and then republished through that same offer. Unknown eBay offer states fail closed before a write. Legacy Trading-only listings are revised by their existing listing ID, avoiding duplicate adds.
- Trading API publish failures now include eBay's `Message` and `ShortMessage` alongside `LongMessage` when returned, so policy rejections such as restricted vehicle-part listings show their actual reason. eBay policy blocks still need seller/account resolution.
- The exact-job requeue utility now includes ended-listing error 291 and stored effective-SKU mismatches only for targets with a verified Inventory API offer/SKU mapping.
- Error 25713 during Inventory offer lookup now checks the mapped Trading listing and only rebuilds after eBay confirms that listing is completed/ended. Recovery deletes only the stale offer, keeps the Inventory SKU/item, and reuses a verified existing offer when createOffer reports error 25002. Published offer listing IDs are read from eBay's nested `listing.listingId` response field.
- Added publisher regression coverage for Inventory API routing in Trading mode, active offer revision, ended offer republish, stale offer lookup, duplicate-offer reuse, nested listing IDs, and detailed Trading API errors.

## 2026-09-30 — Show every NAPA listing image

- Catalog listing details now combine the image URLs stored on the listing and its catalog product, preserving their existing order while removing duplicates. This exposes images present on only one side of the linked records.
- NAPA Canada and NAPA Online image URLs now use a fixed-host, same-origin image endpoint. Nginx caches successful image responses for 30 days so catalog thumbnails and detail galleries do not depend on browser-side CDN access.

## 2026-09-29 — Prevent blank eBay primary categories from reaching publish

- eBay Motors publishing now resolves a missing or malformed category to the existing fallback leaf (`9886`) and persists that category on the catalog/listing rows. The Trading API request builder rejects missing or malformed category IDs before sending a request, avoiding eBay error 37 for an empty `PrimaryCategory.CategoryID`.
- Added regression coverage for the missing-category Trading API publish path and the request-level guard.

## 2026-09-29 — Auto Parts catalog & inventory: Has Price filter and sortable columns

- **Has Price** toggle on the filter bar of Auto Parts → Catalog (`hasPrice=1`, existing backend filter, previously buried in Advanced Filters) and Auto Parts → Inventory (new `hasPrice=1` on `GET /inventory/listings` and `/inventory/listings/facets`; same rule as the "Price" validation flag: non-blank `startPrice` or a numeric `startPriceNum`).
- Catalog table: every data column (SKU, Image, Title, Team, Condition, Stock, Price, Date Added, Status, eBay) is a click-to-sort header. `sort` now accepts `<col>_asc|desc` plus `oldest` (see `SEARCH_SORT_MODES` in `backend/src/listings/dto/search-query.dto.ts`); the new team/condition/stock/status/ebay/image sorts are implemented in the SKU-grouped path the catalog grid uses (`buildDedupOrderSql`) — ungrouped callers fall back to newest-first.
- Inventory table: every column is sortable via new `sort=<col>_<asc|desc>` (`INVENTORY_SORT_COLUMNS` in `dto/inventory-workbench.dto.ts`), sorted server-side across all pages. Derived columns mirror their JS counterparts in SQL (Validation = missing-field count, Enrichment ≈ `deriveStatus()`, Catalog = enrichment completed, Fitments = max(part_fitments, catalog fitment_data)) — see `inventorySortKeySql()` in `inventory-workbench.service.ts`; keep them in sync if those rules change.
- Inventory table gained a **Price** column (the item already carried `price`).

## 2026-09-29 — Publish listings directly to partsbazar360.com

- New `partsbazar360` channel (`backend/src/channels/partsbazar360/`) that pushes listings into partsbazar360.com through its authenticated `/integrations/realtrack/listings` endpoint. Enable with `PARTSBAZAR360_API_KEY` (same value as `REALTRACK_PUSH_API_KEY` on partsbazar360.com); unset, the feature stays off.
- Settings → Channels → PartsBazar360 links a seller by its store ID on PartsBazar360 (verified live before saving). Publish from the listing detail Channels tile, or for a selection via the catalog bulk bar → More → Publish to PartsBazar360.
- Publishes are asynchronous on the receiver: the job polls for the outcome, then a delayed re-check finishes it. The instance ends `synced`, or `error` with a readable reason (e.g. non-English title, no stock). Only MVL-validated fitment is sent; listings with no title, price ≤ 0 or no usable image are refused before any request.
- `publish-multi` / `bulk-publish` accept an optional `storeId` to choose the destination store; the publish job now honors it for eBay as well (it previously always used the connection's primary store).
- Ending a listing on this channel now takes it off sale on PartsBazar360. Bulk inventory sync is a no-op for it (re-publish to push stock/price).
- Channel panel: backend sync statuses (`synced`/`error`/`pending`) are now mapped to the UI's `active`/`failed`/`publishing`; previously a synced listing rendered with no badge style. Settings' Channels tab refreshes silently after linking a seller instead of flashing a spinner.
- Photos are verified in S3 and sent as public `/api/storage/serve/...` URLs (the bucket is private and originals are often converted to `.webp`); missing or `temp/` photos are dropped and a listing with none left is refused.
- All photos sent to PartsBazar360 are now WebP in S3: external photos (NAPA, eBay) are downloaded, converted (≤1600 px) and stored; JPG/PNG-only originals get a WebP copy; NAPA Canada photos are read from NAPA Online (same ids, no server-side block). A listing with no obtainable photo is refused and, if live, taken off PartsBazar360.
- Deployed to production and verified with one live listing (BLA-18425 → Blackline on partsbazar360.com); see `docs/integrations/partsbazar360-publish.md`.

## 2026-09-29 — NAPA exact-part pricing and indexed result recovery

- Accepted the owner's rule that an exact NAPA part number can supply a price even when the official product page says remanufactured and the inventory listing says new. Product-type and position mismatches remain held. Five backed-up, readback-verified batches updated 124 previously held NAPA catalog products and draft listings.
- Recorded user-provided Google result screenshots for SFI 26917 ($14.49/Each) and ADC 2072XB ($108.99/Each) as indexed official price evidence, distinct from fresh page prices; the conflicting $111.99 Shopping display for 2072XB was excluded.
- An alternate exact-part NAPA Canada page supplied C$163.29 for 2775XA, plus an official image and fitment. The guarded writer converted it to US$115.25 at the recorded CAD/USD rate and verified the live catalog and draft records.
- Live NAPA totals after the update: 445/737 with any catalog price, 393 with accepted official price evidence, 292 with no catalog price, and 386 with both official price and official primary image.

## 2026-09-29 — NAPA draft listing gallery images

- Appended the same lossless 1254×1254 WebP F1, F2, and F3 images, in order, to all 737 unpublished NAPA listings in both catalog and listing records. Existing images and their order were preserved; the 173 listings without prior images now contain the three supplied images.
- Where the catalog and listing records already had different image sequences, the images were appended to each sequence independently so neither side lost existing images. No published NAPA listings were changed.

## 2026-09-29 — FEBEST ready-to-publish gallery images

- Updated all 1,806 unpublished, ready-to-publish FEBEST drafts in both catalog and listing records. Replaced the final three image slots with lossless 1254×1254 WebP versions of F1, F2, and F3, in that order; all published FEBEST listings were left untouched.
- Two drafts had only two existing images, so their part photo and diagram were preserved and F1–F3 appended. The final gallery counts are 1,805 listings with five images and one listing with four.

## 2026-09-28 — Fashion quick capture

- Added `/fashion/capture` (phone-first garment intake) and `/fashion/intake` (paginated history with identification status and retry).
- Photo slots: Front, Back and Tag & labels are required; Additional (≤13) and Size chart. Slot order sets the eBay picture order. Photos uploaded with a SKU are stored as `<SKU>-<timestamp>-<id>.webp`.
- Measurement charts for 10 garment types (A–E points, cm/in) in the editor and capture screen, plus a server-rendered branded size-chart image.
- Batch SKU generator (`<BATCH>-<0001>[-<SIZE>]`) with an atomic per-batch counter seeded from existing SKUs; organization warehouses managed in Fashion settings.
- Background identification queue (`fashion-intake-analysis`) and **Identify in background** in the editor; confirmed values and titles are never overwritten.
- Per-photo text banners.
- Changed: Fashion measurements, `categoryFamily`, `sizeChartTemplate`, `measurementsUnit` and measurement notes are no longer sent as eBay item specifics; measurements now appear as a table in generated descriptions.
- Migration `1791000000000-CreateFashionIntake`; backend Docker image installs `fonts-dejavu-core`.
- Fashion identification no longer warns that size/brand were not confirmed when the operator already entered them, and no longer warns about label size vs measurements when a measurement chart is used.
- Details: `docs/architecture/FASHION_QUICK_CAPTURE.md`.

## 2026-09-26 — FEBEST low-resolution source images

- Trusted FEBEST imports now validate the official 1600-pixel photo/diagram path before mirroring a 200-pixel source URL. When a full-size variant is unavailable, the importer keeps the supplied image URL rather than storing a broken replacement.
- Production catalog and listing records for the 3,701-SKU content-ready batch now use verified 1600-pixel official part photos; 3,691 rows also use a verified full-size diagram. The other 10 keep their existing diagram because FEBEST has no 1600-pixel version for those SKUs.
- Existing eBay galleries were not revised: the current connected seller account is not the owner of sampled active listings, and eBay rejected the photo-only revision. The owning seller account must be connected before that separate update can run.

## 2026-09-26 — Fixed: pipeline exports omitted catalog and Image Drive photos

- Pipeline image mirroring now processes generated CSV files as well as XLSX files.
- After catalog and Image Drive resolution, finalized product images are merged into the downloadable output by SKU. Image Drive lookup includes SKU alongside manufacturer and OE part numbers.
- Pipeline jobs record resolved/missing image coverage and the pipeline page reports the missing SKU/part-number pairs instead of searching with generated placeholder identifiers.
## 2026-09-26 — Fixed: pipeline titles omitted donor year

- Pipeline job optimization now uses stored donor year/make/model fields and fills missing donor context from a source filename formatted as YYYY MAKE MODEL plus a 17-character VIN when MAKE matches the product brand. Validated fitment years remain the title source when available.
- Corrected 93 draft listing and catalog titles for pipeline job c35a49cb-742d-4dc1-9ba5-f955bdd301b7 to match its US export. All titles include the source-labeled 2015 Audi A8L vehicle and remain within 80 characters; this resolved 23 listing/export title mismatches. No published eBay listings were changed.


## 2026-09-23/24 — Fixed: enriched catalog data (fitment, images, price) was never reaching the database

- **Root cause of "changes not visible on the live site":** this pipeline has two layers — CSV/JSON
  staging files, and the Postgres tables (`catalog_products`, `listing_records`) the live app
  actually reads. Moving data from the first to the second requires a separate, deliberate
  "persist" step. Pricing in particular had **never** been persisted by any script in this
  pipeline's history — `catalog_products.price` and `listing_records.startPrice`/`startPriceNum`
  were unset for every row, regardless of source (eBay comparables or NAPA's site).
- Added `scripts/persist-napa-official-sql.mjs` (+ tests): persists NAPA-site-sourced fitment,
  title/description and images — `persist-fitment-sql.mjs` only accepts eBay-compatibility-sourced
  fitment, so it silently excluded these rows. Same safe pattern as `persist-fitment-sql.mjs`
  (SQL generated locally, executed via `ssh`+`psql`, never Node in the memory-constrained
  production container — KNOWN_ISSUES R27); dry-run by default, backup + all-or-nothing
  transaction + `--restore`.
- Added `scripts/persist-napa-pricing-sql.mjs` (+ tests): the first script to ever write price
  into the database, for every row with a publishable `Pricing Status`, not only NAPA-sourced ones.
- Applied 2026-09-23: **186 rows** got fitment/title/description, **4** got an image, **152**
  got a price — all for the first time. 3 fitment rows and 2 pricing rows were skipped
  (`not_in_database`: CSV SKUs with no matching `catalog_products` row under this import — minor
  data drift, not investigated further).
- See [docs/operations/CATALOG_PIPELINE.md](docs/operations/CATALOG_PIPELINE.md) for the full
  writeup and [docs/decisions.md](docs/decisions.md) for why pricing was never wired up before.

## 2026-09-23 — Napa images, fitment and pricing sourced directly from napacanada.com

- Added `scripts/napa-official-apply.mjs` (+ tests): applies NAPA-own-site images and manufacturer
  vehicle fitment to Napa rows research showed a match for (190 of 375 previously-image-missing
  rows), additive-only, with a non-blocking `CONDITION CONFLICT` flag for the 14 rows where NAPA's
  page lists Remanufactured against a catalog New.
- Added `scripts/napa-price-apply.mjs` (+ tests): applies a NAPA-site retail price to Napa Caliper
  rows found priced (7 of 11 found, CAD converted to USD with a cited live FX rate; see
  [docs/decisions.md](docs/decisions.md)). Established that napacanada.com shows consumer pricing
  for the Caliper category only — pads, rotors, chassis, electrical and hose lines consistently do
  not, across 9+ sampled prefixes.
- Added `scripts/image-source-ebay.mjs` / `image-source-apply.mjs` (+ tests): eBay-Browse-based
  image sourcing, kept as reusable infrastructure though it found 0 Napa matches in its pilot.
- Full methodology, access constraints and the NAPA SKU-prefix map in
  [docs/operations/CATALOG_PIPELINE.md](docs/operations/CATALOG_PIPELINE.md).
- PartsBazar360 exports regenerated: 152 content-ready, 110 postable (up from 109).

## 2026-09-21 — Ops: removed the renovessa stack from the production host

- Stopped and removed `renovessa-app-1` / `renovessa-db-1`, the `renovessa-app` image and the nginx site link to
  free RAM on the shared 4 GB host (KNOWN_ISSUES R27). Data volumes, `/opt/renovessa` and an archive
  (`~/renovessa-archive-20260921/`) were kept on the server; see R27 for the restore steps.
- Pruned the Docker build cache (~43 GB; disk 81% -> 37%).
- Stopped the ERP (`compose-*`, `/opt/traders/compose`) stack the same day (`docker compose stop`; nothing removed).
  The host now runs only realtrack. Restart steps are in KNOWN_ISSUES R27.

## 2026-09-21 — FIX: cap image-processing memory (502s from backend OOM restarts) — deployed 16:17 UTC

- **Cause:** the backend container was repeatedly OOM-killed on the 4 GB production host; nginx returned 502
  while Docker restarted it (KNOWN_ISSUES R27, update 2026-09-21 ~16:00 UTC).
- `storage/processors/thumbnail.processor.ts`: worker concurrency 15 -> 3, configurable via
  `STORAGE_THUMBNAIL_CONCURRENCY`.
- `storage/image-processor.service.ts`: process-wide `sharp.concurrency(1)` and `sharp.cache({memory: 32})`
  (`SHARP_CONCURRENCY`, `SHARP_CACHE_MB`).
- New `storage/upload-limits.ts`: 20 MB per-file multer limit (`IMAGE_UPLOAD_MAX_FILE_MB`) on the in-memory image
  upload endpoints (Image Drive x3, Fashion, Business & Industrial intake). Larger files now get HTTP 413.
- `docker-compose.yml`: backend `mem_limit: ${BACKEND_MEM_LIMIT:-1800m}`; default heap 1536 -> 1280 MB. Note that a
  host `.env` `NODE_OPTIONS` overrides the compose default.

## 2026-09-21 — Fitment from eBay's compatibility check; second pricing correction (brand must be named)

- Added the eBay-compatibility fitment finder (`fitment-compat.mjs`, `fitment-from-ebay-compat.mjs`,
  `fitment-compat-apply.mjs`, `fitment-compat-eval.mjs`, `persist-fitment-sql.mjs`, `mvl-pull.sh`,
  `csv-safe.mjs`). It uses only the application token (`check_compatibility`), samples years through long
  ranges, requires two sellers to agree, and uses a listing only if its own item specifics name our Brand
  and Manufacturer Part Number. 3 rows applied (Ford Taurus, Ford Escape, Nissan Armada/Titan/QX56).
  Accuracy against already-validated fitment: 88.6% with the guard (67% without).
- **Second pricing correction:** comparables must name the brand (part type alone no longer qualifies for
  part-number searches). 85 of 132 priced Napa rows had no NAPA-named comparable. Verified prices
  232 -> 147; postable 118 -> 106, then 109 with the three new fitment rows. No reman-prone row is postable.
- The local runner gained `PUSH_SOURCE=1` (source CSV push, md5-guarded) and pushes the fitment state.
- Found: some already-validated fitment appears wrong (KNOWN_ISSUES R29) and the host still restarts the
  backend on its own (R27 update).
- Ops: activated 4 GB swap on the production host (swappiness 10, persisted in fstab) against the OOM kills (R27).

## 2026-09-21 — FIX: pricing comparables must be the right kind of product

- **Bug:** Browse comparables were accepted on a part-number substring match alone, so numeric part
  numbers priced parts from unrelated products (an air filter from LEGO tiles, a muffler from
  torque rods and diecast cars). Those rows were marked verified and could reach the postable export.
- **Effect on earlier figures:** of the original 44 postable rows, 8 had a wrong price and 3 no
  defensible price; the "223 verified" figure was inflated.
- **Fix:** comparables must name the brand or enough of the part type (OE-number matches must name
  the part type); new offline `--refilter` re-derives stored results. Corrected server figures: 232
  verified, 118 postable (previously reported: 223 and 44). See CATALOG_PIPELINE, "Correction:
  comparable relevance".
- The local runner gained `MODE=push`, `REFILTER=1`, `ALLOW_SHRINK=1` and a pre-push server backup.

## 2026-09-21 — SEO content persisted to the catalog DB; heavy pipeline work moved off the production host

- Added `scripts/persist-seo-content.mjs`: a narrow, transactional write of the new SEO
  title/description into `catalog_products` and draft `listing_records` (147 rows applied, backup
  written, `--restore` available). Dry-run by default.
- The production host (3.8 GB, no swap) OOM-killed the backend twice while pipeline jobs ran inside
  its container (KNOWN_ISSUES R27). The server-side retry watcher was stopped and deprecated;
  `scripts/pricing-retry-local.sh` replaces it and does the heavy work on another machine.
  `create-partsbazar360-csv.mjs` now honors `PIPELINE_BASE`.

## 2026-09-21 — Vehicle-aware SEO titles and descriptions for validated-fitment rows

- Added `scripts/seo-content.mjs` / `seo-content-apply.mjs`: titles in the store house style
  (`Febest 1924-E70FUPL Control Arm Front Upper Left for BMW X5 X6 E70 E71`, <= 80 chars, make
  once with its models, real chassis codes only) and structured HTML descriptions built only
  from data already held. Applied to the 147 rows with validated fitment; exports regenerated.
- Fixes a mis-title in the previous builder: a part that is Rear on some vehicles and Front on
  others was titled by its first record ("Rear"). Position now appears only when consistent.
- Reman-prone part types (calipers, starters, alternators, axles...) are described without
  "New" (KNOWN_ISSUES R24).
- `price-enrich-catalog.mjs`: the web-result overlay no longer overwrites Browse evidence
  (it had erased the "not evaluated" flag, which would have made `--retry-failed` skip rows).
  `price-web-research.mjs` gained `--reserve` / `--only-searched` and a live credit check.

## 2026-09-21 — Web-search pricing (GPT-5.6 Luna) for rows eBay Browse could not price

- Added `scripts/price-web-research.mjs`: GPT-5.6 Luna (OpenRouter, web search on) finds
  priced pages for the exact brand + MPN. Every cited page is re-fetched and only counted
  when it shows the brand + MPN (or UPC) and the price; a wrong quoted price is replaced by
  the price the page's JSON-LD declares. All statistics and statuses are computed in code;
  confidence is capped at `medium`. Unverifiable sources (bot-protected retailers) go to
  manual review and are never postable.
- Rows whose only exact page is remanufactured/used are flagged as condition conflicts
  instead of being priced as New (see KNOWN_ISSUES R24).
- `price-enrich-catalog.mjs` overlays web results only onto rows Browse could not price
  (a Browse price always wins), reports condition conflicts, counts web methods as
  exact-MPN/MSRP, and writes `partsbazar360-pricing-review-queue.csv`.

## 2026-09-20 — Pricing enrichment stage for the eBay/PartsBazar360 pipeline

- Added `scripts/price-enrich-catalog.mjs`: every catalog row now gets an
  evidence-backed price from eBay Browse comparables (exact UPC/EAN, then
  brand+MPN, then MPN, then OE/interchange), falling back to catalog MSRP.
  Comparables are filtered to new fixed-price listings from reputable sellers,
  compared shipping-inclusive, and trimmed of outliers; the recommended price is
  the median less 3%, rounded to a buyer-friendly amount.
- Comparables are ACTIVE listings only. The account grant is `buy.browse`, so the
  Marketplace Insights (sold listings) API is unavailable and
  `pricing_verified_exact_match` is never emitted. Rows with no defensible price
  are preserved as `pricing_pending`; thin, wildly dispersed, or
  identifier-conflicted rows become `manual_pricing_review`.
- The audit and postable PartsBazar360 exports carry 13 new pricing columns, and
  the File Exchange export is patched with `*StartPrice`. A listing is postable
  only with a numeric price, a currency, a pricing source or method, a confidence
  value, and no unresolved identifier conflict; content-ready rows that fail the
  gate are kept in the audit export as `content_ready_pricing_pending`. With no
  pricing evidence present the export fails closed.
- Each run writes `partsbazar360-pricing-validation-report.md`/`.json` with the
  verified / exact-MPN / comparable-part / MSRP / missing / manual-review
  breakdowns and min/median/max recommended price by brand and category.
- An eBay HTTP 429 is never recorded as "no comparables found". Rows whose
  lookups were all rate-limited are marked `lookup_rate_limited` / not evaluated
  and re-priced by `--retry-failed`; the report splits rows genuinely searched
  from rows never evaluated.

## 2026-09-19 — Clarify eBay Inventory API listing editing

- Published listing details now explain that eBay Inventory API listings cannot
  be edited in Seller Hub and direct operators to the system's Quick revise form,
  which uses the supported Inventory API revision path.

## 2026-09-19 — FEBEST Trading API compatibility fallback

- FEBEST publishes now route through the Seller Hub-editable Trading API path
  even when the global listing mode remains inventory.
- Trading AddFixedPriceItem serializes only unique Year/Make/Model compatibility
  rows first. If eBay still returns 21917122 (“All compatibilities are
  invalid”), it retries the atomic add without the compatibility block so the
  listing is published instead of being dropped; the fitment remains in the
  buyer-facing description.

## 2026-09-16 — B&I intake recovery and duplicate-folder protection

- B&I intake now resets only genuinely stale groups left in `processing` after
  a worker interruption, allowing the last folders to be retried and finalized
  instead of leaving the parent job partial forever.
- Drive-source provenance is stored on intake-created products. Repeated folder
  names from different Drive roots receive deterministic `BNI-` collision
  suffixes, so separate folders no longer overwrite or share one catalog row.
- Added the scoped `bi:repair` recovery command for the three authorized Drive
  jobs, including current duplicate-folder separation and category corrections;
  it never publishes to eBay.
- The repair is now idempotent for the listing-record source-row uniqueness
  constraint, materializes missing projections, and backfills evidence-based
  required `Model`/`Type` values. The scoped eBay readiness audit now
  accepts intake job IDs and exits after reporting; the three repaired jobs
  validated at 377/377 ready, 0 blocked, published=false.

## 2026-09-16 — Business & Industrial intake throughput

- The production B&I Drive intake worker now permits two concurrent root jobs. Image identity remains idempotent by intake job and source path, so retries do not duplicate already-ingested assets.

- **Faster visible drafts and catalog header controls (2026-09-16):** Public
  Drive intake now processes two folders concurrently, downloads four images
  per folder concurrently with bounded retries, and creates each folder's draft
  as soon as its complete image set is retained. Incomplete folders remain
  retryable instead of producing partial drafts. The shared catalog table now
  exposes direct column sorting and filters for MPN, category, condition,
  price/stock, images, import date, and publication status. Production also
  moved the three current Drive jobs and their 22 existing drafts from the
  Super Admin organization into the dedicated B&I workspace; no marketplace
  publication was performed.

- **B&I catalog isolation and tenant repair (2026-09-16):** Business &
  Industrial catalog publication joins now require an exact B&I vertical and
  organization match; legacy null-vertical/null-organization compatibility is
  retained only for Automotive. Image intake inventory mirrors now inherit the
  authoritative catalog product organization and match existing rows by
  organization + vertical + SKU. Production repaired 77 unambiguous historical
  B&I mirrors to their matching catalog-product organization; no marketplace
  publication was performed.

- **B&I publish-readiness repair (2026-09-16):** New image-intake drafts now
  persist dispatch location, shipping coverage, parcel dimensions/weight and
  units, enriched item specifics, a separate MPN (model fallback, then
  `Does Not Apply`), Type, and a normalized condition. Blank linked inventory
  values no longer mask populated catalog Brand/MPN/Type values. Added an
  idempotent backfill for all existing B&I catalog rows and their inventory
  projections; it performs no marketplace publication.

- **B&I exact-folder Drive intake and MPN/SKU preservation (2026-09-16):** Drive intake now processes every direct source folder with supported images, preserves decimal folder suffixes as part of the independent listing identity, generates `BNI-<exact-folder-name>` SKUs, keeps MPN in its dedicated field, retains all available folder images, and overwrites same-SKU enrichment in place without publishing. Automatic draft enrichment also runs for confidence-gated detections so the catalog receives the full source set for operator publishing readiness.


- **B&I catalog published status + backfill (2026-09-15):** `/business-industrial/catalog` was forcing Unpublished for operators with an empty store-access list (`AND 1 = 0`), even when live `ebay_listing_channels` and `listing_records."ebayListingId"` rows existed. Catalog search now keeps Published from live channels (including null vertical), `catalog_products.ebay_item_id`, and matching listing records. Successful eBay publishes stamp `ebay_item_id`. Historical live rows are repaired by `scripts/backfill-catalog-publication-status.sql`.

- **eBay 25002 core-fitment retry actually strips optional fields (2026-09-15):** Production FEBEST publishes (SKUs such as `1921-G01LH`) failed with Inventory error 25002 after the compatibility PUT and readback succeeded. European catalog trims/engines (`sDrive 18 d`, `BMW B47 D20 A`) and a `Submodel` property are not valid US Motors compatibility fields, and the documented retry was rewriting the same payload. Publish now retries once with unique Make/Model/Year only, omits `Submodel` from the Inventory API payload, and uses that reduced projection for offer refresh.

- **B&I catalog filter placement parity (2026-09-14):** The Business & Industrial catalog now follows Auto Parts placement with a horizontal quick-filter bar below search and a left-side advanced-filter drawer at desktop and mobile widths. Existing filter state, URL/session persistence, bulk actions, and catalog data are unchanged; no listings were published.

- **B&I intake identifiers and catalog navigation (2026-09-14):** Image-intake
  drafts now persist MPN separately and generate deterministic `BNI-` SKUs from
  the normalized base folder name; final numeric dot suffixes remain grouped as
  physical instances. Removed operator-facing model/token/cost details from
  intake responses and screens, made intake run/group lists independently
  scrollable, and added a desktop filter toggle plus contained sticky-header
  scrolling to the shared catalog workspace. No listings were published.

- **B&I bulk publish profile selection (2026-09-14):** The selected-listings
  publish dialog now loads the complete connected-store profile/policy options,
  lets the operator choose shared shipping, payment, and return profiles before
  a future publish click, and carries the selected names into each durable target
  for store-specific policy-ID resolution. This change does not submit or
  publish any listing by itself.

- **B&I eBay condition normalization (2026-09-14):** Preserved imported eBay
  condition ID 3000 as USED_EXCELLENT instead of collapsing it to ID 5000,
  which eBay rejects for categories such as Switching Mode Power Supplies.
  Publish projection validation now infers missing generic-used IDs and selects
  a supported condition from the live category policy within the same used,
  new, refurbished, or parts family.

- **B&I catalog publication state and policy selectors (2026-09-14):** Catalog
  rows now reconcile current and legacy live eBay records, expose Published,
  Unpublished, and Blocked filters, and provide a usable published-item URL.
  Bulk policy editing now uses complete connected-store shipping, payment, and
  return profile dropdowns instead of free-text inputs.

- **Temporary B&I publish bypass (2026-09-14):** Added the reversible
  `BUSINESS_INDUSTRIAL_ALLOW_UNAPPROVED_PUBLISH` switch for operator-led
  publishing. When enabled, the B&I UI and eBay publish endpoints do not
  require compliance approval, and multi-selected B&I records can receive bulk
  policy/profile edits; review records and other publishing safeguards remain
  unchanged.

- **Private S3 eBay image publishing fix (2026-09-14):** eBay Picture Services
  now receives private first-party S3 image bytes through the multipart
  `create_image_from_file` endpoint, while the durable source URL remains the
  cache key. This avoids eBay's failed anonymous fetch of private presigned
  URLs without making the image bucket public or persisting signed URLs.

- **B&I taxonomy hardening (2026-09-14):** Business & Industrial image intake
  now tries the AI category query first and then deterministic family/type
  query variants when eBay suggestions are too narrow. Every result is still
  verified as an eBay leaf and receives live item-aspect metadata; the fallback
  broadens search vocabulary but never invents a category ID. No marketplace
  publishing is performed by intake.

- **FEBEST pre-enriched import and source audit (2026-09-14):** Added the explicit `pre_enriched_febest_v1` pipeline mode, exact three-sheet server validator plus dry-run endpoint, draft-only collision-checked worker path, and upload UI selector. The deterministic FEBEST audit ingests 4,599 unique source rows, enumerates 20,102 official catalog items, captures official evidence for 4,591 products, applies the approved 30% AED markup with recorded Google Finance FX, and produces 533,612 accepted US-MVL fitment rows plus a separate 1,102,126-row review audit. The run remains DRAFT/BLOCKED for 886 products without accepted US-MVL mappings and 8 unresolved evidence/image rows; no production writes or eBay publishing were performed.

- **Fashion photos-first item workflow (2026-09-14):** Fashion Add Item now
  collects a complete garment photo set (camera, upload, or both) before
  optional identification. Existing OpenAI vision and storage services analyze
  all photos together, suggest Fashion category/attributes without inventing
  label data, preserve user edits on re-analysis, and keep photos when AI
  fails so manual entry still works. Category-aware clothing, footwear, and
  accessory fields persist on `catalog_products.vertical_attributes`. Listing
  text uses confirmed Fashion facts and reported defects. Auto Parts and
  Business & Industrial workflows are unchanged.

- **Public homepage redesign (2026-09-14):** Replaced the public `/` overview
  with an editorial, responsive commerce-operations story: illustrative
  product subjects for Auto Parts, Business & Industrial, and Fashion; a
  keyboard-operable intake/enrich/review/publish walkthrough; synthetic
  catalog statuses; FAQ accordion; mobile navigation; and workspace links.
  The page keeps branding overrides, existing protected routes, and the
  general sign-in/privacy destinations unchanged.

- **Light theme default (2026-09-13):** Workspaces now default to light
  (`data-theme="light"`, slate canvas, light browser `theme-color`). Fashion
  login and the shared first-login password page (including B&I) use the same
  light card pattern as B&I login. Dark remains available from Client Settings.
  Existing `client_settings.themeMode = dark` rows are migrated to `light`.

- **B&I mobile and cross-platform layout (2026-09-13):** Business & Industrial
  (and the shared catalog used by Fashion) now use a 16px type floor, notch
  safe-area padding, 44px touch targets, stacked phone toolbars, card catalog
  results below `lg`, and full-screen/bottom-sheet dialogs. Login, editor
  measurement+unit fields, stores, and publish/quick-view panels no longer
  force page-level horizontal overflow on ~360px viewports.

- **B&I Auto Parts layout alignment (2026-09-13):** Business & Industrial now
  uses the Auto Parts sidebar/drawer workspace chrome, shared page primitives,
  and catalog presentation patterns while keeping its server-backed catalog,
  editor payload, review, import, intake, store, incident, and permission
  rules unchanged. Overview Create listing opens `/business-industrial/listings/editor`.

> Fashion/B&I completion record (2026-09-10): see the vertical architecture, security, API, route, and setup documentation for the deployed workspace behavior and operational prerequisites.

- **B&I publish validation blockers (2026-09-13):** Recent
  `No targets passed validation` failures for `bniadmin` were caused by a missing
  merchant inventory location on the native-OAuth B&I store plus null catalog
  prices on most SKUs. Production now has `AE_Dubai` provisioned and mapped on
  all B&I marketplaces. Native policy sync and validate now auto-ensure an
  inventory location (same as SellerPundit). Publish/validation UI surfaces the
  real `errors`/`failures` detail instead of only the generic message. 72/77
  catalog rows still need a positive price before they can queue.

- **B&I catalog empty for multi-org admins (2026-09-13):** `bniadmin@realtrack.local`
  (and similar users with Super Admin + B&I membership) no longer land on the Super
  Admin organization when using `/business-industrial/*`. Login stores
  `mk_preferred_vertical`, org selection prefers the matching vertical workspace
  (owned B&I first), and `BusinessIndustrialShell` auto-selects the B&I workspace
  so catalog search scopes to the 77 B&I products instead of an empty Super Admin org.

- **B&I catalog publish readiness (2026-09-13):** Publish modal now loads
  shipping/return/payment profiles through the same `/stores/:id/profiles`
  path Auto Parts uses (with B&I account-policy fallback), defaults from the
  connected store marketplace mapping, and multi-store selection. Production
  B&I store config was marked dedicated (`ownerVertical` /
  `enabledVerticals`), catalog products were moved into the B&I workspace org
  with the connected store, and all 77 compliance reviews were approved so
  valid listings can enter the publish flow.

- **B&I catalog publish modal Auto Parts parity (2026-09-13):** The Business
  & Industrial publish modal now supports multi-store single-mode publishing
  (checkboxes, not radio), select all/deselect all, a profile source store
  selector when multiple stores are selected, and a wider `max-w-2xl` dialog
  to prevent policy selector clipping. Selected stores each receive the
  listing with shared connected-store policy and inventory-location overrides.
  The bulk mode uses each selected store's own synced defaults. This matches
  the Auto Parts `PublishModal` workflow while preserving B&I's server-side
  validation and durable queue architecture.

- **B&I Drive public-download compatibility:** The Drive pilot now uses each
  image's public `webContentLink` before the API media endpoint, allowing
  link-shared images with Drive security-update protection to be downloaded,
  converted to WebP, and processed on the server.
- **B&I draft score persistence:** Normalized 0–100 SEO/readiness scores to
  Catalog's 0–1 numeric ratio columns and serialize them back as percentages in
  the B&I API, preventing pilot draft creation numeric overflows.

- **eBay publish failure repair:** Motors publish now verifies a category as a leaf before creating the offer, persists the resolved category across `catalog_products` and SKU-linked `listing_records`, and uses the known publishable leaf `9886` when taxonomy is unavailable. Listing construction falls back from a missing historical source-listing row to the canonical catalog product, and non-Motors marketplaces no longer receive reconstructed Motors fitment rows. Duplicate errors are permanently classified as skipped when the referenced eBay item is already published in the same local account channel. Added the dry-run/apply/requeue maintenance script `scripts/repair-ebay-publish-failures.mjs` (including explicit SKU retry and known-duplicate reconciliation modes) for deterministic recent failures; account limits and recalled-item policy blocks remain explicitly classified instead of being blindly retried.

- **Automatic publish-readiness optimization:** Completed enrichment pipelines now durably enqueue the mandatory marketplace listing-optimization pass with an idempotent BullMQ job ID and retry backoff. This prevents eBay Motors publish attempts from reaching compatibility validation while every product is still missing structured Year/Make/Model fitment.

- **Pipeline category prevention guard:** Post-enrichment import now treats generated category IDs as untrusted and runs every product through `EnterpriseListingIntelligenceService.resolvePublishableCategory()` before catalog or listing upserts. Known Motors leaves are retained; unrelated, parent, and missing categories are deterministically remapped, checked through eBay Taxonomy when needed, and finally fall back to publishable leaf `9886`. The resolved category is written identically to `catalog_products` and `listing_records`, so pipelines cannot bypass category validation when mandatory optimization is pending. Bounded concurrency defaults to 8 via `PIPELINE_CATEGORY_GUARD_CONCURRENCY`.

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Add an entry under **Unreleased**
for every meaningful change (Continuous Documentation Protocol).

## [Unreleased]

- Catalog photo zoom now routes first-party S3 and supported NAPA images through
  the same-origin image proxy. Direct browser requests to the private S3 bucket
  returned 403, while the application image proxy serves the same asset.

- Fixed eBay publish SKU resolution so reviewed listing `customLabelSku` values
  take precedence over stale catalog SKUs, and catalog-only requests recover
  the persisted SKU instead of publishing with the internal product ID.

- **Jeep teardown image host repoint (2026-09-13):** Pipeline job `UPL-2026-000146` (`JEEP-2218-WHITE-*`, including `JEEP-2218-WHITE-RD13`) stored image URLs on the retired `solarrisebackupbucket.s3.amazonaws.com` host. Rows were repointed onto `solarrisebackupbucket-<account>.s3.amazonaws.com` with the same object keys. The objects already existed; Auto Parts serving failed because the live bucket policy only granted the app account `mhn/business-industrial/*`. That policy now also allows `mhn/catalog-images/*`, `mhn/temp/*`, `mhn/originals/*`, and `mhn/image-drive/*`. The live bucket had no CORS configuration, so Inventory Details browser `PUT`s failed as `S3 upload network error` on every SKU; CORS now allows the production frontend origins (`app.omnicoreholding.com`, `mhn.realtrackapp.com`, and related hosts) with `PUT`/`Content-Type`. Image mirroring treats the legacy hostname as an alias of the configured bucket. Maintenance: `scripts/repoint-s3-bucket-alias-urls.mjs`.


- **Publish build dependencies:** Added the safe eBay category util, `PublishRequest.vertical`, and validated fitment-source option required by the B&I listing builder.



- **B&I catalog condition and brand filters:** Business & Industrial facets now
  aggregate condition from `condition_label` when `condition_id` is null (the
  production B&I shape), and condition filters match either field. The sidebar
  exposes brand/manufacturer and condition alongside category, review status,
  stock, and populated B&I attributes. Results and quick view show condition
  and image counts; the publish modal no longer violates React hooks order when
  closed. Facet queries now build a fresh scoped QueryBuilder per aggregation,
  and category/condition `OR` predicates are fully parenthesized so they cannot
  escape organization/vertical filters and leak automotive facet values into B&I.

- **B&I connected-store publishing:** The Business & Industrial catalog publish
  dialog now loads synced policies from the dedicated connected eBay account,
  displays the selected store's fulfillment/return/payment profiles and
  inventory location, and sends those values through validation and the durable
  publish worker. Queued targets retain the selection so a stale catalog
  profile cannot replace the connected-store mapping.

- **B&I facet availability fix:** Corrected the shared catalog facet query for
  users with no accessible publication stores. It now returns populated product
  and vertical-attribute facets with an empty marketplace facet instead of
  emitting invalid PostgreSQL `IN ()` SQL and hiding every filter behind an
  error banner.

- **B&I catalog detail and publishing parity:** The shared Business & Industrial
  catalog quick view now hydrates the canonical product detail, displays every
  stored image in a primary viewer plus thumbnail strip, and opens the reusable
  full-screen lightbox with keyboard/arrow navigation and zoom. Added a
  B&I-specific account-aware publish dialog: single listings run the existing
  server validation and show blockers/warnings before enqueueing, while bulk
  selections target up to ten dedicated B&I stores and retain server-side
  approval/category/policy checks. Publish progress now shows target counts,
  daily capacity, and published/skipped/failed target states.

- **Catalog image delivery:** Fixed shared image URL normalization so only
  configured first-party S3/CDN hosts use the application proxy. Legacy or
  external S3 URLs from other buckets now remain on their source URL instead
  of being rewritten to the production bucket, while the account-qualified
  production bucket remains recognized and proxied instead of being loaded as
  a private direct S3 URL. This restores complete galleries across all catalog
  verticals after the bucket migration.
- **B&I catalog Auto Parts parity:** Reworked `/business-industrial/catalog`
  around the Auto Parts catalog header, actions, result density, summary, bulk
  operations, quick view, and filtered-result feedback. Added a first-class
  `validationStatuses` catalog query/facet and replaced empty or automotive
  filter fields with populated B&I facets derived from the production
  attribute contract (category family, manufacturer, model, MPN, inventory and
  shipping modes, voltage/frequency, mounting, origin, series, and enclosure
  rating). B&I rows now expose their manufacturer/model/category-family data
  and created date directly in the results table.
  Refresh now invalidates catalog, facet, and summary requests instead of
  replacing state with dependency-equivalent values. Deployed to
  `app.omnicoreholding.com` on 2026-09-13 and verified through container health,
  public-route, protected-API, and compiled-bundle checks.

- **Catalog facet reliability:** Fixed the shared vertical facet query to select
  JSON attributes with a stable alias, preventing the facet endpoint from
  failing and leaving every filter empty.
- **Catalog image reorder fallback:** Updated the shared gallery for wrapped
  layouts and added visible left/right controls so image order can be changed
  with drag, keyboard, or explicit buttons before saving.

- **Auto Parts catalog image save:** Fixed the Inventory Details modal to use the automotive listing image endpoints for reorder/remove and uploads instead of sending an automotive catalog-product ID to the vertical catalog patch route. The modal now reloads the persisted listing image order.

- **Shared catalog filter and publishing fixes:** Corrected category facet values so selected categories filter by their stable ID while remaining readable in active chips, made the end-date filter inclusive, and added loading skeletons, checkbox facets, facet search, collapsed secondary filters, and clear counts to the Fashion/B&I workspace. Publish jobs now stop polling on completed_with_errors and expose normalized per-target eBay error messages.

- **Shared catalog image ordering:** Replaced the quick-view arrow controls with the Auto Parts-style drag-and-drop image gallery. The first image is explicitly marked primary, keyboard reordering is supported, uploads are deduplicated between batches, and the saved order is shared by all verticals using CatalogWorkspace.

- **Auto Parts catalog navigation:** Corrected the sidebar Catalog target so it
  resolves to `/auto-parts/catalog` instead of duplicating the workspace prefix
  as `/auto-parts/auto-parts/catalog`.

- **Shared catalog workspace scope and publish UX:** Catalog search, facets,
  suggestions, inline edits, and CSV export now include the active organization
  when multiple workspaces are available. The filter panel exposes all server
  facet fields plus price/import-date filters, and publish actions are shown or
  gated according to the existing compliance approval requirement.

- **Shared vertical catalog parity:** Added canonical `/fashion/catalog` and
  `/business-industrial/catalog` workspaces with legacy `/listings` aliases.
  Fashion and Business & Industrial now use one server-side catalog_products
  search/facet/suggest contract with URL/session state, responsive filters,
  quick view editing, image upload/reorder/remove/zoom, bulk team/policy/delete
  actions, filtered or selected CSV export, publication summaries limited to
  authorized stores, and durable bulk-publish progress. New catalog mutations
  are audit logged, quarantine-safe, organization/vertical/team scoped, and
  protected by vertical catalog permissions. No schema migration was required.

- **eBay OAuth callback origin:** The B&I store connection flow now returns to
  the canonical `https://app.omnicoreholding.com` origin in production when
  `FRONTEND_BASE_URL` is unset, while preserving the local Vite callback
  default during development.

- **eBay OAuth authorize redirect:** The B&I store connection preserves the
  eBay OAuth-enabled RuName in `EBAY_REDIRECT_URI`; the RuName’s Accept URL
  must be updated in the eBay Developer Portal to the canonical production
  callback instead of the retired `mhn.realtrackapp.com` hostname.

- **B&I public Drive pilot and Luna enrichment:** Added a protected
  POST /api/business-industrial/image-intake/jobs/from-drive endpoint and
  frontend controls for a server-side full-root import. The worker processes every direct folder, retains all supported images, and converts images to WebP before S3,
  uses openai/gpt-5.6-luna-20260709 for vision plus listing copy, aggregates
  token/cost totals from ai_run_logs, and projects reviewable drafts into both
  B&I Catalog and shared Inventory. The pilot requires GOOGLE_DRIVE_API_KEY
  and never auto-publishes.

- **Vertical routing and authorization remediation:** Canonicalized the full Auto Parts workspace under `/auto-parts/*` with legacy redirects, protected every settings child route, required both inventory-view and listing-update permissions for inventory editing, preserved Fashion/B&I deep links, added shared permission-aware workspace switching and account replacement controls, and fixed B&I navigation visibility. Generic automotive catalog/listing/search APIs now enforce organization, vertical, store, and team scope—including ID/SKU mutations, exports, revisions, and sibling synchronization—with legacy NULL rows limited to a configured owner organization. Auto Parts login now asserts its backend permission, JWT query tokens are SSE-only, and logout revokes new token session IDs in Redis until expiry.

- **Public vertical landing:** Replaced the root redirect into Business & Industrial with a responsive public Omni Core landing page that explains the platform and links to the Auto Parts, Business & Industrial, and Fashion workspaces. Auto Parts authentication now returns to its explicit dashboard route, and the shared Auto Parts home navigation no longer loops back to the public landing page.
- **Business & Industrial routing:** Repaired the dedicated B&I route tree so the overview and child workflows render inside the B&I shell instead of showing an empty main area caused by unmatched nested absolute routes.

- **B&I comprehensive completion audit and deployment:** Completed the manual listing workflow with full edit hydration, HTTPS images, explicit category-supported eBay conditions, seller selection, live leaf-category search, required item specifics, the full validated technical/certification/lot/freight schema, correct per-target validation parsing, and terminal publish-job tracking. Aligned B&I manager store authorization across workspace and eBay APIs, made image-intake retries use unique queue attempts while preserving successful/draft-created groups, exposed failed-group retry and condition confirmation, hardened DTO limits, and added retry/eBay validation regression coverage. Deployed the isolated release `/home/ubuntu/realtrackapp-bi-complete-20260910-01` to `app.omnicoreholding.com` on 2026-09-10; Docker health, migrations, public routes, and authenticated B&I APIs were verified.

- **B&I AI image intake:** Added Image Drive-style folder upload for Business & Industrial, dot-suffix instance grouping, organization-scoped S3 assets, queued vision/OCR identification, verified eBay leaf-category/aspect resolution, confidence and warning review, Excel export, and one-click draft creation into the existing compliance/eBay publish workflow. AI never auto-publishes and unverified identifiers/specifications/prices remain manual-review items.


- **Omni Core vertical entry points:** The domain root `/` opens Business & Industrial. Auto Parts remains fully available at `/auto-parts` with `/auto-parts/login`; cross-workspace navigation is permission-aware.

- **Business & Industrial completion and Omni Core deployment:** Completed the dedicated B&I login/password-change flow, strict organization and vertical isolation, temporary-password user administration with dedicated-store assignments, full technical/serialized listing editor, import monitoring with retry/cancel/error reporting, seller policy/category metadata, publish-job/channel controls, verified eBay offer withdrawal with retry/escalation and release gating, and quarantine edit locks. Backend and frontend production builds pass; focused vertical/auth regression coverage is green. Deployed to `app.omnicoreholding.com` while preserving Automotive and Fashion behavior.

- **Omni Core rebrand:** Standardized user-facing login, shell, vertical workspaces, client-settings defaults, API metadata, AI provider metadata, policy labels, and privacy copy on “Omni Core”. Added an idempotent migration that updates only legacy default client-branding rows; internal package, database, storage, and legacy account identifiers remain unchanged for compatibility.

- **Fashion vertical workspace:** Added dedicated Fashion login/navigation, Fashion RBAC roles and server-side vertical permission gates, organization-scoped drafts and bulk import, private authenticity review/evidence, publish blocking until approval, local quarantine, Fashion store configuration, isolated eBay OAuth seller-account checks, and an idempotent Fashion admin seed command. Migrations and live deployment remain review-gated.

- **Business & Industrial vertical workspace:** Added a separate B&I login/navigation surface, explicit category-family and measurement-unit validation, inventory/lot and shipping fields, organization-scoped review, private serialized units, verified incident quarantine, dedicated eBay OAuth/publish routes, isolated RBAC roles, richer import mapping, focused validator tests, and an idempotent B&I admin seed command. The shared worker fails closed on approval, quarantine, category, or shipping gaps.

- **Production hostname cutover:** Updated the default CORS/WebSocket origins, privacy-policy link, operational scripts, and deployment documentation from mhn.realtrackapp.com to app.omnicoreholding.com. The live EC2 nginx site and TLS certificate were cut over separately.


- **Explicit eBay vertical pilots:** Added additive `automotive`, `business_industrial`, and `fashion` routing across catalog intake, pipeline jobs, publish targets, store configuration, category metadata, and Inventory API item groups. The `multi_vertical_catalog` flag remains disabled by default; automotive behavior and legacy jobs remain the safe fallback.

### Fixed
- **S3 image WebP preference:** Centralized frontend image URL handling now
  requests a sibling `.webp` object for S3/CloudFront JPEG, PNG, GIF, BMP, HEIC,
  and AVIF images. The public storage proxy redirects to the original image when
  that WebP object is unavailable, preserving reliable rendering and correct
  cache keys. Raw S3-capable image tags now use the same utility; external URLs
  and local previews are unchanged.

- **eBay compatibility publish fallback:** When eBay returns error `25002` stating that all compatibility rows are invalid after Inventory API readback succeeds, the publish retry now removes unverified optional Trim/Engine/notes fields, refreshes the offer projection, and verifies against the accepted core Make/Model/Year payload.
- **eBay Motors category mismatch prevention:** Publish enrichment now applies deterministic part keywords to legacy rows at the final boundary and persists the correction across the catalog and SKU-linked source listings. Coolant-hose listings resolve to live Car & Truck Motors leaf `33601` (`Coolant Hoses`) instead of a valid-but-wrong motorcycle `Radiators` leaf such as `177983`, preventing category-scoped compatibility rejection.
- **eBay inventory-location country guard:** Publish location resolution now treats `default`, `USA`, and other legacy US placeholders as invalid for this UAE account, accepts only an enabled UAE merchant location, and provisions/uses the required Dubai location `AE_Dubai` when needed. If eBay cannot verify or provision a UAE location, the publish fails closed instead of submitting a US location.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **eBay stale-offer recovery (superseded 2026-09-30):** The earlier retry purged
  the stale offer and item. Current code preserves the Inventory item and follows
  the confirmed-ended, exact-offer recovery described in the 2026-09-30 entry.

- **Pipeline Image Drive auto-attachment:** Bulk pipeline finalization now resolves manufacturer/OEM part numbers against Image Drive folders, replaces warehouse/bin placeholders, prepends matched CDN image URLs, preserves valid source URLs, updates listing and catalog image fields, and records match/link counts.
- **Image Drive thumbnail visibility:** Folder APIs now return CDN URLs for generated thumbnail keys, and raw Image Drive thumbnails are routed through the backend image proxy.

- **eBay publishing validation:** Publish requests now supply `UPC: Does not apply`
  when a source row has no barcode, omit status-blind legacy fitment rows that
  are not proven valid in the active MVL, and replace stale generic Engine
  categories on non-engine parts with the verified Motors leaf `9886`. The
  image sanitizer expands the known PartsFinder `{col}` primary-image template
  and rejects unresolved URL templates before eBay Picture Services sees them.

- **Existing Febi/Lemforder gallery backfill:** Added the guarded
  `backend/src/scripts/backfill-brand-images.ts` maintenance runner. It keeps
  one shared resolution-aware source image in existing listing/catalog records,
  revises published Inventory API listings and discovers/revises unmapped
  legacy published eBay item IDs through Trading API, read-backing each result
  to require exactly one image. Dry-run is the default and apply writes a JSON
  backup before any database mutation.

- **eBay publish worker split-brain and image resilience:** Production deploys
  now remove stale Compose one-off backend containers and verify that only
  named Compose backend consumers remain. eBay Picture Services retries
  transient upload failures, skips an invalid source image when other images
  remain usable, and preserves fail-closed behavior for fatal errors. Publish
  retry classification now treats Inventory-managed `21919474`/`21919233`,
  policy restrictions, category/condition failures, and SKU collisions as
  permanent instead of retrying them as transient outages. Added the
  job-scoped, dry-run-by-default `scripts/requeue-ebay-publish-job.mjs` so
  incident recovery cannot accidentally sweep unrelated SKU/date ranges.
  Production Redis now uses BullMQ-safe `noeviction` instead of an LRU policy.

- **Organization-wide publishing access:** All RBAC roles now retain the
  listing/channel/eBay publish permissions, active users receive all-store
  access, and new users inherit the same access. Inactive users remain blocked.

- **Recent eBay publish failure recovery:** SellerPundit `21919474` and legacy
  compatibility-limit `21919233` failures now fall back to the direct Inventory
  API / treat the unsupported Trading projection as non-fatal after exact
  Inventory readback. Account-scoped SKU collisions can reclaim only remote
  unpublished orphans with no local channel; live or locally-owned items still
  fail closed. The retry path preserves the canonical title, images, policies,
  fitment, and compatibility rows.

- **FEBI/Lemförder image selection:** Catalog imports and eBay publish resolution now retain one primary image for FEBI/Febi Bilstein and Lemförder products. When eBay URLs expose dimensions, the highest-resolution candidate is selected; otherwise the source order is preserved. Published-listing API responses and future mirrors apply the same rule so redundant FEBI galleries do not reappear in the application view.

- **Add Part production repair hardening:** The audited repair runner now
  excludes confirmed warehouse-bin-only location flags, persists successful
  effective `BLAP-` SKU and eBay offer/listing pointers transactionally, retries
  eBay error `25604` availability propagation with a bounded delay, and safely
  cleans up only unpublished/no-listing partial alternate-SKU artifacts created
  by the failed attempt. A targeted `--channel-id` audit can verify a repaired
  channel without rerunning the full report.

- **Pipeline script lookup in containers:** `/pipeline` no longer resolves the
  enrichment script to `/scripts/ebay-enrichment-pipeline.mjs` when
  `PIPELINE_PROJECT_ROOT` is unset or stale. Pipeline upload, output, resume,
  and image-enrichment paths now select a configured root only when it contains
  the script, then fall back to the current working directory (`/app` in Docker)
  or its parent (`backend/` local development).

- **eBay account-scoped SKU collision and publish projection drift:** Direct
  and SellerPundit publish paths now fail closed when a remote SKU cannot be
  proven to belong to the local channel, then verify title, description,
  image count, policy IDs, location, and compatibility after eBay reports
  success. Canonical `BLA-<suffix>` conflicts now use the deterministic,
  postfix-free `BLAP-<suffix>` alternate only after an account-scoped
  availability check; if it is also occupied, publishing remains blocked.
  Fresh-SKU compatibility recovery now requires an explicitly supplied
  canonical inventory item and will not copy an untrusted remote item. The
  read-only maintenance audit is
  `backend/src/scripts/audit-add-part-ebay.ts`; it scopes to individual
  `listing_records.origin='add_part'` listings and excludes FEBI/Lemförder.

- **Inventory-managed compatibility repair:** eBay Trading `ReviseItem` error
  `21919474` is now treated as a non-writable legacy projection for
  Inventory-managed listings. Normal publishing refreshes the Inventory offer
  instead of attempting Trading `ReviseItem`; Inventory compatibility and offer
  readback remain authoritative, while unrelated Trading API failures in the
  explicit repair path still fail closed.
  Added the dry-run-by-default `backend/src/scripts/repair-add-part-ebay.ts`
    runner with audited scope, canary offset, canonical identity checks,
    per-store failure accounting, and fresh/noncanonical SKU exclusions.

- **Canonical recovery for fresh Add Part SKUs:** Added the dry-run-by-default
  `backend/src/scripts/repair-add-part-fresh-ebay.ts` utility. It rebuilds
  noncanonical channels from the reviewed local source using deterministic
  `BLA-<suffix>` → `BLAP-<suffix>` SKUs, verifies the complete eBay projection
  before changing local pointers, and never treats the remote item under the
  old SKU as canonical content.

### Changed
- **NAPA catalog images:** Official NAPA media URLs now load through a same-origin backend proxy with numeric image ID and preset validation. Nginx caches successful image responses for 30 days.

- **Add Part SKU namespace:** New automatically allocated Add Part and
  warehouse-intake SKUs now use `BLAP-<sequence>`. Existing `BLA-` source SKUs
  remain unchanged, while legacy BLA conflicts continue to use the deterministic
  `BLAP-<suffix>` eBay fallback; unrelated or already-occupied BLAP collisions
  remain blocked rather than overwriting an active remote listing.

- **eBay-hosted listing images:** The common eBay publish boundary now uploads
  non-eBay-hosted source images to eBay Picture Services through the Media API
  before invoking direct Inventory API or SellerPundit publishing. Hosted URLs
  are cached per eBay store in `ebay_hosted_images`, and a hosting failure
  fails that store's publish instead of leaving an AWS S3 dependency on the
  live listing. Added migration `1790100000000-CreateEbayHostedImages`.

- **eBay compatibility stale-row prevention:** Publishing treats the
  catalog's validated fitment as the only compatibility source. It explicitly
  replaces/deletes Inventory API SKU compatibility, verifies the exact rows,
  refreshes Inventory API offers, and withdraws a listing when live readback
  cannot be verified. Explicit legacy repair uses Trading API `ReviseItem` with
  `ReplaceAll=true`. Added the serial repair utility
  `backend/src/scripts/repair-ebay-compatibility.ts` for current Motors
  channels and their published-listing mirrors.

- **eBay stale-fitment repair completion:** Audited all current published
  Motors channels matching the source-empty/rejected-fitment pattern and
  repaired their sibling store channels as well. The repairer now has a safe
  default candidate query, explicit `--sku`/`--sku-list` sibling scope, exact
  Inventory + buyer-facing Trading readback, and a fresh-SKU recovery for eBay
  catalog projections that survive same-SKU replacement. Fresh recovery
  publishes neutrally with catalog-product details disabled, restores seller
  title/aspects only after zero-row verification, and marks genuinely ended
  listings ended locally. Production audit completed with zero remaining
  default candidates.

- **Durable pending-fitment publishing:** Added a BullMQ-backed workflow that
  reprocesses every pending catalog fitment with forced MVL validation and then
  synchronizes only validated rows to published eBay channels. Empty,
  rejected, and review-only results are skipped; the queue is durable across
  backend restarts. Enqueue with
  `backend/src/scripts/queue-pending-fitment-publish.ts --apply`.

- **BullMQ Redis safety:** Documented and enforced the Compose Redis
  `noeviction` policy for durable background queues; the production Redis
  runtime was corrected from the legacy `allkeys-lru` setting without
  restarting the active queue.

- **eBay Inventory location reconciliation before publish:** The final eBay publish path now verifies the configured merchant location against the seller's live Inventory API locations before creating an offer. Disabled or missing keys are replaced with an enabled existing location or a provisioned Dubai `AE_Dubai` location, with a short per-store cache to avoid one lookup per listing; repaired marketplace defaults are persisted. This prevents eBay error 25002 (`Location information not found`) when a database key survives deletion or disablement on eBay. Deployed to the production backend on 2026-08-21; Superior Auto Parts is ready for a safe retry.

- **Published-listings sync prune timeout fix (Blackline/SalvageA large stores):** The post-upsert prune step (`markUnseenActiveAsEnded`) was aborting the whole sync with `canceling statement due to statement timeout` on large bloated mirrors (Blackline: 150k active rows across a 1.5GB / 78k-block heap). The `find()` filtered active rows with only the single-column `idx_epl_account` index → a lossy bitmap heap scan reading 88k blocks (~690MB) took ~58s, exceeding the pool's 30s `statement_timeout` (set in `app.module.ts` `extra.statement_timeout`) — and this fired *after* the 124k-row upsert loop had already finished, so every sync since Aug 7 failed at the very end. Fixes: (1) added partial composite index `idx_epl_active_acct_mp_item (ebay_account_id, marketplace_id, ebay_item_id) WHERE listing_status = 'active'` (migration `1790000000000`) so the prune read can be an index-only scan; (2) rewrote the prune to select only index-covered columns + batch-UPDATE unseen rows by `ebay_item_id` via the `uq_epl_account_item` unique index (no full heap scan), wrapped in a transaction with `SET LOCAL statement_timeout = 300s` + `work_mem = 64MB` so it is resilient to heap-bloat / stale visibility maps; (3) ran `VACUUM (ANALYZE, PARALLEL 0)` on the production `ebay_published_listings` table (reclaimed 86,917 dead tuples). Files: `backend/src/published-listings/services/published-listings-sync.service.ts`, `backend/src/migrations/1790000000000-PublishedListingsActiveAcctMpItemIndex.ts`.

- **All users can publish to all stores:** Publish-related permissions (`listings.publish`, `listings.approve`, `listings.revise`, `channels.publish`, `ebay.publish`, `published_listings.sync`, `published_listings.manage`, `published_listings.bulk`) now default to `READ_ONLY` — granted to every human system role (super_admin, admin, manager, staff, supervisor, catalog_manager, listing_manager, ops_user, listing_user, viewer). The machine role `api_published_listings_reader` remains read-only. `listings.delete` and `listings.price_override` stay restricted. On the US production instance, all active users were also set to `store_access_all = true` so the store-access gate no longer scopes them to assigned stores. Applied via `permission-registry.ts` (rebuilt backend image) + direct `role_permissions` insert for the customized `staff` role (skipped by boot-sync). See `docs/architecture/AUTH_RBAC.md` → Publish policy.

- **All users can upload to pipelines and receive output listings:** `pipeline.run` now defaults to `READ_ONLY` (all human roles), so every user can upload files via `POST /api/pipeline/upload` and submit single listings. Previously `READ_WRITE` excluded viewer, listing_user, and supervisor. Combined with `pipeline.view`/`pipeline.export` (already `READ_ONLY`) and `store_access_all = true`, users who upload see their own pipeline jobs, can download output templates, and the imported `listing_records` are visible in the Listings/Catalog views (store filter bypassed). Applied via `permission-registry.ts` rebuild; boot-sync added the perm to the three non-customized roles (viewer, listing_user, supervisor). The customized `admin`/`staff` roles already had `pipeline.run`.

- **Cross-store publish fix (profile name fallback):** When a listing's profile name (e.g. "BLAP shipping policy 3 KG") doesn't exist on the target store's eBay account, the publish flow now falls back to the marketplace default policy IDs with a warning log, instead of throwing `BadRequestException`. This enables publishing listings created for one account to a different account that doesn't have matching policy names. Previously the publish was blocked. Fix in `ebay-publish.service.ts:1508-1548`. Only throws if no default policy is set either.

- **Org-role publish gate removed:** `EbayIntegrationPermissionsService.canPublishListing()` now returns `true` for all organization member roles (was `owner`/`admin`/`editor` only). The RBAC `@RequirePermissions('ebay.publish')` check is the sole gate. Also added `sales@superiorcarautoparts.com` to the Super Admin organization (was missing org membership entirely).

- **Southern Cross policy sync:** Synced 25 business policies (20 fulfillment + 2 payment + 3 return) for the "K. Southern Cross Auto Parts - AU" eBay account from the eBay Account API. The account previously had zero policies in `ebay_business_policies`, blocking all direct publishes.

- **eBay pagination infinite loop fix:** The `EbaySellAccountApiService.listPaged()` and `listInventoryLocations()` methods had `for (;;)` loops that could hang indefinitely. The eBay Account API has a quirk: when `offset === total`, it returns the first page again instead of an empty page. If an account had exactly a multiple of `limit` (20) policies, the loop never broke, causing the policy sync to hang for all accounts. Fix: read the `total` field from the API response and break when `offset + batch.length >= total`. Added `MAX_PAGES` guard (50 for policies, 20 for locations) as a safety net. This fixed the systemic policy sync hanging that affected all 12 eBay accounts.

### Added
- **Recursive Image Drive folder upload:** The Image Drive page now accepts drag-and-drop or folder selection for nested image trees. Browser-relative paths are uploaded in existing 50-file multipart chunks; backend path validation maps the deepest likely part-number directory to a linked Image Drive folder, preserves nested paths, keeps unmatched images under the top-level upload folder, queues variants, and makes retries idempotent. Pipeline finalization records Image Drive match counts and fills missing listing and catalog-product image fields without overwriting existing images. API: `POST /api/image-drive/upload-folder`.

- **Image Drive v2 — Google Drive-style file manager:** Complete redesign of Image Drive from a flat part-number lookup table to a folder-based file browser backed by S3. New `image_drive_folders` table with name, S3 prefix, and optional linked part number; redesigned `image_drive_assets` table with folder FK, resize variant keys (`s3_key_thumb`, `s3_key_medium`), dimensions, and blurhash. Upload flow generates `_thumb` (200px) and `_medium` (800px) WebP variants via existing `storage-thumbnails` BullMQ queue (new `generate-drive-variants` job type). Auto-attach: listings auto-attach images from folders whose name matches or whose `linked_part_number` matches. Frontend: folder grid with thumbnail mosaics, file grid/list view, breadcrumbs, create/rename/delete folders, drag-drop upload with auto-create folder option, part number linking UI. API: `/image-drive/folders` CRUD, `/image-drive/folders/:id/files`, `/image-drive/folders/:id/upload`, `/image-drive/upload` (auto-create), `/image-drive/lookup/:partNumber`, `/image-drive/lookup` (batch), `/image-drive/search`, `/image-drive/stats`. Removed auto-record-on-upload from `StorageController` and `SingleListingFormService` (images are now managed exclusively through Image Drive UI).

- **Image Drive enhancements:** Search bar for searching folders by name/part number. Sort options (name, date, size) for folder list. File preview lightbox (via `ImageZoom`) — click any image to view full-screen with zoom and navigation. Copy CDN URL button on file cards (grid + list views). Download file action on file cards. Bulk select mode with bulk delete for files. Pagination controls for file lists (50 per page). Upload button available at root level with auto-create folder flow. New backend endpoints: `GET /files/:id` (file details), `POST /files/bulk-delete` (bulk delete). New `StorageService.copyObject` and `moveObject` methods for S3 object management.

- **Filter state lost on navigation:** Filters, search, sort, and pagination now persist via `sessionStorage` across SPA navigation. Enhanced `useUrlFilters` hook with optional `storageKey` parameter — URL params take priority for bookmarked/shared links, sessionStorage provides fallback for back/forward navigation. Applied to all 9 filtered pages: Catalog, Inventory, Pipeline, Published Listings, Orders, Notifications, Motors Dashboard, Review Queue, Audit Trail. Catalog `ActiveFilters` (25 fields) additionally persisted via `useSessionState` hook.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Image Drive folder drag-and-drop:** Bound the browser's `webkitGetAsEntry()` call to its `DataTransferItem` and handle `dragenter` so dropped folders are read reliably by Chromium instead of failing before the upload request is sent.

- **S3 orphan image cleanup & root-cause prevention:** Audited 1,106,359 S3 objects under `mhn/` against all DB references (`image_assets`, `catalog_products.image_urls`, `listing_records.itemPhotoUrl`, `master_products.image_urls`), including derived variants (`_thumb`/`_sm`/`_medium`/`_lg.webp`). Found and deleted 170,418 truly orphaned objects (~51 GB) across `temp/` (16K), `catalog-images/pipeline-images/` (117K), `catalog-images/c61dfa85.../` pipeline UUID (26K), `catalog-images/inventory/` (7.5K), and others. Root cause: the intake form (`single-listing-form.service.ts:390`) set `listingId` on `image_assets` rows without calling `confirmUpload()` to move the S3 object from `temp/` to `originals/`, so the CleanupProcessor's orphan filter (`listingId: IsNull()`) never matched them. Fixes: (1) `CleanupProcessor` now has a third pass that finds temp/ assets with `listingId IS NOT NULL` and moves them to `originals/` via `confirmUpload()`; (2) `SingleListingFormService` now moves S3 objects from `temp/` to `originals/` when setting `listingId`; (3) `StorageService.buildDurableKey()` added as public wrapper for `withKeyPrefix()`; (4) healed/ key prefix bug fixed — `healIfReferenced()` now uses `buildDurableKey()` so healed objects land at `mhn/catalog-images/healed/...` instead of outside the prefix; (5) S3 lifecycle policy applied: `mhn/temp/` objects auto-expire after 3 days as a safety net. Also backfilled `listing_records.itemPhotoUrl` from `catalog_products.image_urls` (27,343 rows populated, 900 remain NULL with no matching product). Removed 943 broken `catalog-images/healed/` URL references from `catalog_products.image_urls`.

- **Catalog/inventory image loading speed (on-demand variant self-healing):** Catalog listing thumbnails and inventory detail modal images were still loading slowly because many catalog images were missing their responsive variants (`_thumb`/`_sm`/`_medium`/`_lg.webp`). When `OptimizedImage` requested a missing variant it 404'd, then fell back to the full-size original (up to 8 MB) — a double request plus a multi-MB payload per image. Root cause: the Aug 5 variant backfill marked products done immediately after queueing (before generation completed); a Redis restart (~22 h uptime) lost the pending/completed BullMQ job state; and `mirrorRemoteImages` `skipExisting` doesn't re-queue variant generation for already-mirrored images, so post-backfill imports stayed variant-less. Fix: (1) the `/api/storage/serve/{key}` endpoint now generates a missing variant on demand from the original (probes extension → `processImage` generates all four variants → streams the requested one), bounded to 4 concurrent Sharp generations with per-original in-flight dedup — one request succeeds directly, no 8 MB fallback, then nginx caches it 30 d; (2) `storage-thumbnails` queue gets `defaultJobOptions` with `removeOnComplete`/`removeOnFail` (1-day age) so `jobId` dedup no longer blocks re-queues after a Redis restart or re-import; (3) `scripts/check-and-backfill-variants.js` now sets `removeOnComplete`/`removeOnFail` on its queued jobs to avoid Redis bloat. Backfill run (DESC `createdAt` = upload-time descending) queued 459 missing images (1836 variant files), 0 failures. Verified: recent product variants 5 KB thumb / 35 KB medium / 70 KB lg (vs 7 MB original), 0.04–0.14 s load. Files: `backend/src/storage/storage.controller.ts`, `backend/src/storage/storage.module.ts`, `scripts/check-and-backfill-variants.js`.

- **Catalog/inventory image loading speed (nginx-cached image proxy):** Catalog listing thumbnails and inventory detail modal images were loading slowly or not appearing, especially for distant users. Root cause: the frontend loaded images directly from S3 (`solarrisebackupbucket.s3.amazonaws.com`, us-east-1) — a separate DNS/TLS connection per browser session, with ~250-400ms RTT for non-US users and no edge caching. Fix: (1) `toProxyUrl()` in `src/lib/imageUrl.ts` now rewrites our S3 image URLs to `/api/storage/serve/{key}` proxy paths, so the browser reuses its existing connection to the app origin instead of opening a new one to S3; (2) the host nginx config for `mhn.realtrackapp.com` now includes a dedicated `location /api/storage/serve/` block with `proxy_cache` (30-day, 1 GB, `proxy_cache_use_stale`) — first request fetches from S3 through the backend (cache MISS), all subsequent requests are served from the nginx cache on the EC2 host (cache HIT, ~16ms vs ~100ms direct S3); (3) gzip was enabled on the host nginx (was commented out, so JSON API responses were uncompressed); (4) duplicate nginx server blocks were cleaned up. The OptimizedImage fallback chain was also simplified to remove dead code (the inner proxy retry is now unreachable since `toProxyUrl` already routes through the proxy). Verified: `X-Cache-Status: MISS → HIT`, 50/50 concurrent requests succeed on cold cache, 16ms cache-hit TTFB. Files: `src/lib/imageUrl.ts`, `src/components/ui/OptimizedImage.tsx`, `/etc/nginx/nginx.conf`, `/etc/nginx/sites-available/mhn.realtrackapp.com`.

- **Image proxy rate limiting (429 Too Many Requests):** The `/api/storage/serve/` endpoint had `@SkipThrottle()` which in NestJS throttler v6 only skips the `default` throttler — but this app uses named throttlers (`short`, `medium`, `long`), so it skipped nothing. On a cold cache with 25+ concurrent image requests, 33 out of 50 got 429 (the `short` limit is 10/s). Fix: changed to `@SkipThrottle({ short: true, medium: true, long: true })` in `backend/src/storage/storage.controller.ts:392`. Verified: 50/50 concurrent requests now succeed on cold cache. This was the root cause of "images not showing" on page load.

- **Image Drive folder rename S3 prefix bug:** Renaming a folder now correctly moves all S3 objects (original + thumb + medium variants) from the old prefix to the new prefix, and updates all asset records with the new S3 keys and CDN URLs. Previously, renaming a folder only updated the DB prefix, leaving existing assets pointing at stale S3 keys.
- **Image Drive delete confirmation:** Folder and file deletes now require confirmation via `window.confirm()` dialog before proceeding.

- **Ops script: force-redo Browse API + MVL for all warehouse-intake parts:** `scripts/redo-warehouse-intake-part-identification.cjs` re-enqueues `auto-enrich` (force) for every `sourceFileName='warehouse-intake'` listing with a manufacturer/OEM part number, regardless of current `enrichmentStage`, re-running both `PartIdentificationService.identifyAndCorroborate()` (Browse API brand+MPN corroboration) and `EbayMvlService` fitment validation for each. Relies on the existing in-process Browse API token-bucket (2 req/s, shared across the `inventory` queue's `concurrency: 2` workers) plus 429 backoff for rate-limit safety; `DRY_RUN=1` prints a candidate count and rough Browse API call estimate before anything is enqueued so volume can be checked against the eBay app-token daily quota first. Companion `scripts/check-warehouse-intake-redo-progress.cjs` reports live progress (read-only) by grouping the same candidate set by `enrichmentStage` (not-started/vision_lookup/enrichment/completed/needs_review/failed) plus BullMQ `inventory` queue counts.
- **Editable SKU in inventory/catalog detail modals:** Part Detail (`InventoryDetailModal`) supports inline SKU edit (same pattern as location). Catalog quick-view edit mode includes SKU; `PUT /api/listings/:id` with `customLabelSku` renames the linked `catalog_products.sku` and US/AU/DE sibling listings, rejecting collisions.
- **Catalog table serial numbers:** Always-on `#` column with continuous numbering across pages (`page * pageSize + index + 1`) for the current filtered result set.
- **PartsBazar360 published-listings contract:** Reader-safe `GET /api/published-listings/stores` + `GET /api/published-listings/sync-status` (no `stores.view` required). Detail payloads now include `descriptionHtml` / `descriptionText`, ordered large `imageUrls` + `images[]`, `brand` / `mpn` / `oeNumbers`, and `salvageDetails`. Trading GetItem enrichment persists description + item specifics into the mirror (budget default `PUBLISHED_LISTINGS_ENRICH_MAX_PER_SYNC=500`). Health flags: `missing_description`, `sync_stale`; sync-status surfaces `store_sync_failed` / `empty_active_mirror`. Stable list pagination via secondary `id` sort. Docs: `docs/operations/api-users.md`.
- **Bounded listing-page scrape enrichment (no Trading):** When `PUBLISHED_LISTINGS_SCRAPE_ENRICH=1`, thin published listings can be backfilled from the public `listingUrl` HTML (gallery / description / specifics / fitment) after Browse. Detail on-demand via `PUBLISHED_LISTINGS_ON_DEMAND_ENRICH=1` (skips Trading). `PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH=1` avoids GetItem while usage limits are hot. Browse now also maps `localizedAspects` → `itemSpecifics`.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Corrected inventory/catalog photo updates appeared not to upload:** `StorageService.mirrorRemoteImages` wrote durable copies under deterministic `catalog-images/{namespace}/{index}` keys. Inventory “Attach photos” only mirrors the *new* batch (always starting at index 0), so a corrected second upload overwrote the same CDN URL as the first photo; `updateListingImages` then deduped it away (`if (!merged.includes(url))`). Catalog replace-at-index hit the same trap via `PIPELINE_MIRROR_SKIP_EXISTING`. Keys are now hashed from the source URL/temp key so a new photo always gets a distinct durable URL while same-source pipeline re-runs still skip. Regression: `storage.service.spec.ts`.
- **Catalog edit version conflict looked like a hard error:** Saving price + shipping could hit optimistic-lock `409` and show a red "modified since you loaded it" banner. Save now puts the listing first (then catalog), auto-retries once with a fresh version, and shows a calm amber notice asking to save again if needed.
- **Catalog edit: shipping saved but price stayed $100:** Selecting an eBay store in `CatalogInventoryDetailModal` re-ran the draft init effect (`selectedStoreId` dep) and wiped in-progress price/qty edits before save. Shipping still persisted because policy state lived in a separate `profiles` object. Fix: seed the field draft once on entering edit mode; apply store policy defaults without resetting `initialProfiles` or the draft; also map product-detail inline `price` → API `startPrice`. Live proof: BLA-18758–18762 (2026-07-23) revisions show shipping updated while `startPrice` remained `100.00`.
- **Salvage / EU listing URLs returned German (or FR/IT) titles:** Trading often stored `ebay.de` / `ebay.fr` listing URLs for SalvageA international listings. Enrichment now treats non-English eBay hosts as needing locale repair, always fetches Browse US + scrapes `ebay.com/itm/{id}`, and persists English `title` / `description` plus an `ebay.com` `listingUrl`. Trading GetItem is skipped during locale repair so marketplace-local text is not re-applied.
- **English list-feed backfill (PartsBazar360):** Ops script `scripts/backfill-published-listings-english.cjs` walks active buyable rows with EU `listing_url` hosts. Browse US worked until quota exhaustion; public `ebay.com` scrape returns **403 from EC2**. Fallback: `scripts/backfill-published-listings-english-translate.cjs` translates stored titles via OpenRouter (`gpt-4o-mini`) and rewrites `listing_url` to `ebay.com` (no Browse). Production translate run: SalvageA then Blackline. Log: `/tmp/english-backfill.log`.
- **Published-listings feed wiped by policy/order sync watermark collision:** `connected_ebay_accounts.lastSuccessfulSyncAt` is the live hard-gate watermark for `GET /api/published-listings`, but eBay policy sync, SellerPundit policy sync, Inventory listing sync, and order import all stamped it to `NOW()` — pushing the watermark ahead of every mirror row and returning `total: 0` for Blackline/Salvage despite tens of thousands of active rows. Those writers no longer touch the field (only a successful full Trading published-listings sync may). Production remediation: rolled Blackline/SalvageA watermarks back to `MIN(active last_synced_at)` (API totals 83,986 / 24,899 / default 108,885) and slowed `PUBLISHED_LISTINGS_SYNC_CRON` while Trading API usage limits are exceeded. (A correlated SQL self-heal was tried then removed — it statement-timed-out on ~100k-row mirrors.)
- **Published-listings API feed restored after hard-gate wipe-to-zero:** Targeted `listingIds` syncs were advancing `connected_ebay_accounts.lastSuccessfulSyncAt` without refreshing the rest of the live set, so the active hard-gate (`lastSyncedAt >= watermark − 6h`) hid Blackline + Salvage and the default reader total dropped to `0`. Production watermarks were rolled back to each account’s `MIN(active last_synced_at)`; partial syncs no longer advance the live watermark (only a successful full Trading fetch may).
- **Published-listings `status=active` hard-requires non-zero quantity:** Default/active feed is buyable offers only (`quantityAvailable > 0`). Zero-qty live rows stay `listingStatus=out_of_stock`; `quantityMin=0` / `lowStock=out` no longer reintroduce them under `status=active`.
- **Listing soft-delete contract made explicit (simple delete + re-import):** Soft-delete hides that listing row and it stays deleted. Pipeline matches active SKUs only (`deletedAt IS NULL`); re-uploading the same donor INSERTs a **new** listing for that SKU and never `recover()`s the soft-deleted row. Routing extracted to `pipeline-listing-routing.util.ts` with regression tests.
- **Mercedes C350 title/fitment corruption → eBay "All compatibilities are invalid" (pipeline `7b7cb423`):** Source titles like `Mercedes-Benz s C350` were parsed as model `s`, then loose MVL `pickCanonical` / sibling expansion rewrote the model to classic numeric `170`, which structured title composition wrote into `optimized_title`. Fitment discovery preferred that optimized title, locking the loop; publish preferred status-blind `fitment_data` that still carried soft-invalid rows, so eBay rejected every compatibility PUT. Fix: harden `extractMakeModelFromTitle` (skip junk tokens, prefer series codes), require exact-only canonicalization for short MVL queries, prefer source titles for discovery, write only `valid` rows into `fitment_data` with status tags, and select publish fitment from valid `fitment_rows` (omit `needs_review`/`rejected`; empty fitment still allowed). **Follow-up:** US Motors MVL uses series models (`C350`), not European `C-Class` — repaired pipeline fitment/titles to `C350` and stopped applying platform Class aliases into discovery fitment rows. Files: `extract-make-model-from-title.ts`, `fitment-mvl.util.ts`, `platform-generation.util.ts`, `ebay-mvl*.ts`, `fitment-discovery.service.ts`, `listing-builder.service.ts`, `ebay-publish.service.ts`, `scripts/lib/platform-generation.mjs`.

### Added
- **Gemini title slots for Position + Part Name:** Pipeline GridX titles still follow `[Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used`, but **Position** and **Part Name** are now batched through OpenRouter `google/gemini-3.1-flash-lite` (heuristic `extractPosition` / `cleanPartName` remain fallbacks). Enterprise US/AU optimization uses the same lane via `TitlePositionPartNamePipeline` and assembles titles with `buildStructuredEbayTitle`. Year/Make/Model/OEM/`OEM Used` stay deterministic. Env: `PIPELINE_TITLE_SLOT_*`, `TITLE_POSITION_PART_NAME_*`.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Manual listing title edits reverted after save:** Catalog product PATCH always synced *every* field onto matching `listing_records`, including `title`. The inventory/catalog editors saved a corrected title only onto the listing row, so the next brand/image/country PATCH (or a same-save brand+title edit) stomped the listing title back to the stale `catalog_products.title`. Sync now writes only fields present in the PATCH DTO, uses `update()` so listing `@VersionColumn` is not bumped mid-save, and the editors also persist title onto the catalog product. Files: `catalog-product.service.ts`, `CatalogInventoryDetailModal.tsx`, `CatalogProductDetail.tsx`.
- **Trading rate-limit sync no longer wipes active listings:** When GetSellerList/ActiveList threw (e.g. eBay usage limit), sync treated the empty result as a live set, pruned every active row to `ended`, and advanced `lastSuccessfulSyncAt` — Salvage went to API total 0. Full sync now skips prune + watermark update unless Trading returns a successful live fetch (`liveFetchOk`).
- **Published listings API defaults to Blackline + Salvage, active, in-stock only:** Omitting `storeId`/`storeSlug` now scopes results to [blacklineusedautoparts](https://www.ebay.com/str/blacklineusedautoparts) + [salvagea](https://www.ebay.com/str/salvagea) (`storeSlug` default `salvagea,blackline`, overridable via `PUBLISHED_LISTINGS_DEFAULT_STORE_SLUGS` or `storeSlug=all`). Active results also require `quantityAvailable > 0`. The in-app Published Listings page passes `storeSlug=all` so operators can still browse every connected store.
- **Published listings API returned only one image URL:** Trading ActiveList/SellerList sync only had `GalleryURL` (a single thumbnail) and each re-sync **overwrote** any previously enriched full gallery back to that one URL — production had ~242k active rows with `imageUrls.length === 1`. Sync now (1) parses all `PictureURL` values when present, (2) uses `preferRicherImageUrls` so multi-image galleries are never shrunk, (3) spends leftover `PUBLISHED_LISTINGS_ENRICH_MAX_PER_SYNC` (default raised 50→500) on a post-sync GetItem/Browse backfill for active rows still thin (≤1 image / empty description / empty specifics / unchecked compatibility). API responses keep the full `imageUrls[]` once enriched.
- **Camaro pipeline publish blocked by `Chevorlet` brand typo (job `60d50eb8`):** Source GridX `Vehicle Make` was misspelled `Chevorlet`, which was stamped into `catalog_products.brand` / titles / extracted make. Fitment title-parse then produced Make=`Chevorlet` (rejected by eBay MVL) so publish crashed with "Structured fitment rows exist but none contain a valid Year, Make, and Model." Fix: normalize `chevorlet`→`Chevrolet` in brand maps + pipeline import (`listing-guards`, `extract-make-model-from-title`, `mvl-fitment-expander`, `pipeline.processor`); fitment discovery prefers `optimizedTitle` when present. Production job data corrected and optimization re-run → 414 pass / 5 review / 0 blocked.
- **MVL fitment never dumps an entire make/model history when donor year is missing:** Pipeline `queryMvl()` previously returned every eBay MVL row for the make/model if no donor year was resolved (VW Jetta job `1d561867` → 308 products with 718 rows / titles like `1980-2027 Volkswagen Jetta…`). Now `scopeMvlRowsByDonorYear` returns empty instead of the full table; donor year is scanned from multiple description rows; ±5/±8 windows never fall back to `all`. `FitmentDiscoveryService` discards over-expanded catalog fitment (span > 12yr) and refuses MVL expansion without a donor year; title year-range parse capped at 12 years. Shared helpers: `scripts/lib/mvl-donor-scope.mjs`, `backend/src/fitment/mvl-donor-scope.util.ts`.
- **Corrupted pipeline SKU blocked eBay publish (`VW-0643-FS-SEATMH`):** Excel stored the custom label as a quoted multiline cell (`"VW-0643-FS-SEATMH\n"`), which eBay Inventory rejected with HTTP 400. Catalog + listing SKU cleaned to `VW-0643-FS-SEATMH`; enrichment script and pipeline import now strip wrapping quotes/newlines/whitespace from SKUs via `cleanSku` / `sanitizeSku`.
- **eBay publish rejected long OEM `Type` aspect values (VW Jetta job `1d561867`):** Bulk publish job `d815550c` landed 573/588 targets; the 15 hard failures were eBay Inventory error 25002 — `Type`'s value is too long (max 65 chars) from raw supplier part descriptions (e.g. "Flat Contact Housing With Contact Locking Mechanism…"). `buildListingAspects` / `sanitizeListingAspects` / `buildEnglishItemSpecifics` now truncate every aspect value to 65 chars (word-boundary). Transient eBay "Core Inventory Service internal error" / Internal Server Error (HTTP 500) on ~33 targets still succeeded after retry with live listing IDs. Files: `ebay-listing-aspects.util.ts`, `ebay-english-listing.util.ts`.
- **Item location must be pure Dubai, AE (no US state/ZIP mix):** Warehouse inventory locations still carried leftover `stateOrProvince=TX` / `postalCode=77001` after the country flip, and pipeline HTML defaults still assumed US. Production now keeps only **enabled** `AE_Dubai` (`addressLine1=Dubai`, `city=Dubai`, `country=AE`) and **disables** legacy `US_77001`/`default` keys; catalog/listing/`ebay_published_listings.location` normalized to `Dubai, AE` (bin codes are warehouse storage, not item location); `ReviseItem` sets `Location=Dubai` + `Country=AE` on **app-published listings only** (from `ebay_listing_job_targets` success + `listing_records.ebayListingId`, not the full SellerList mirror) via `scripts/fix-dubai-location-pure.cjs` (`FIX_APP_ONLY=1`). Code: AE addresses never emit state/postal; seller-country / shipping HTML defaults to Dubai AE; pipeline `Location` is `Dubai, AE`.
- **Dubai sync stores published with US Houston location (`US_77001`):** Auto-provisioned inventory locations defaulted to Houston TX `77001` / country `US`, and policy sync blindly took `locations[0]` — so Dubai-based stores stored `US_77001` as `default_inventory_location_key` and listings showed a US location. Production: created/enabled `AE_Dubai` (city Dubai, country AE) on all active stores, updated existing `US_77001`/`default` warehouse addresses to Dubai, and remapped all marketplace defaults + `stores.location_key` to `AE_Dubai`. Code: defaults are now Dubai/`AE`; `pickPreferredInventoryLocationKey` prefers AE/Dubai and deprioritizes legacy Houston keys. Files: `ebay-inventory-location.util.ts`, `ebay-inventory-api.service.ts`, `ebay-policy-sync.service.ts`.
- **Pipeline imported Excel-hidden ("deleted") rows and mixed vehicles:** GridX/XLSX uploads that used Excel Hide Rows / soft-delete left cell values in the file with `sheet['!rows'][i].hidden = true`. SheetJS still returned those rows, so job `1d561867` (VW Jetta) imported 323 hidden Bentley SKUs, stamped shared photos onto them via `propagateSourceImages`, and upserted over existing Bentley catalog products. Fix: `sheetToVisibleAoa` / enrichment script now skip hidden rows; upload logs `hiddenRowsSkipped`; bulk image propagation is per-SKU only (shared stamping reserved for explicit single-source uploads). Production cleanup soft-deleted the 323 Bentley listings on that job and restored Bentley catalog rows from prior Bentley-branded listings.
- **Published listings hard-gate + storeSlug filter for eBay storefront parity:** Default/active list results now join `connected_ebay_accounts` and only return rows from an **active** connection whose `lastSyncedAt` falls within the latest successful live Trading sync window — so the API cannot return more “active” rows than SellerList/ActiveList wrote (stale Blackline/Salvage overcounts and the disabled Salvage duplicate are excluded). Added `?storeSlug=salvagea,blackline` (aliases include `blacklineusedautoparts`) mapped to RealTrack store IDs for [salvagea](https://www.ebay.com/str/salvagea) (`3b84b063-…`) and [blacklineusedautoparts](https://www.ebay.com/str/blacklineusedautoparts) (`d16199c4-…`). Sync now pulls **GetSellerList ∪ ActiveList** as the live set (ActiveList alone is hard-capped ~25k and under-counted these storefronts), then prunes any remaining extras. BullMQ `published-listings-sync` lock raised to 2h so large-store SellerList jobs are not stalled mid-run.
- **Published listings API defaults to active-only and enriches legacy listings:** `listingStatus=active` by default (`status=all` to override). Trading sync enriches via GetItem/Browse for fuller `imageUrls[]` + compatibility; 15-minute sync cron.
- **Add Part (`/listings/new`) no longer requires photos at submission:** `createIntakePart` had been rejecting warehouse intake with fewer than two images even though the Add Part UI treats photos as optional and identification now runs from OEM/MPN via the eBay Browse API. Parts save to inventory as drafts without images; photos can be added on Inventory before publish.
- **Warehouse-intake titles still missing years / leaking category buckets after Browse identification:** Browse `fitmentHints` (year/make/model) were logged into the description note but never seeded onto `catalog_products.fitmentData`, so MVL expansion started from an empty Year and deterministic titles published as "Volkswagen Rear Exterior…" with no year when discovery found nothing. `runBrowseLookup` now returns `year`/`make`, `lookupAndApplyToListing` applies them to `extractedMake`/`cType`, and inline enrich seeds a Browse fitment row onto the catalog product *before* discovery. Also rejects eBay category-tree buckets ("Exterior, Grilles & Body Parts", "Shocks, Struts & Assemblies") as part names.
- **Warehouse-intake enrichment quality — five root causes behind wrong titles and stuck `needs_review` items:** (1) `alignGenerationAndYearRange` (`backend/src/fitment/platform-generation.util.ts`) treated a missing donor year as year `0` (`Number(null) === 0` passes `isFinite`), composing live titles like "0 Jaguar Column Switch … OEM Used" (97 production titles) — the anchor-year fallback now requires `>= 1900`. (2) `ListingQualityValidator` hard-failed any part without a `Placement on Vehicle` item specific, blocking parts that legitimately have no placement (intake manifolds, ECUs) — 75 production items stuck; missing placement is now a soft fail (`SOFT_SPECIFICS`). (3) The composite quality score was biased to the old Mercedes model-comparison harness: title make points only for `mercedes|bmw|toyota|ford|honda` and a 10-point chassis-code bonus only for Mercedes/BMW-style codes, so Audi/Lexus/VW/Jaguar parts could never mathematically reach the 85 auto-approve threshold (~44 items stuck at scores 46–76). The make regex now covers all mainstream makes and the chassis bonus is alternatively satisfied by year-range + recognized make. (4) The inline-enrich gate in `InventoryWorkbenchService` blocked completion on a score shortfall alone even with zero hard fails, although the deterministic post-steps (category resolution, MVL fitment, structured title) replace exactly what the score measures — now only hard fails (MPN mismatch, cross-make, hallucinated number, missing Brand/MPN/Type) block; a low score is logged and the category+fitment gate decides. (5) `EnrichmentPipeline.withHallucinationCheck` flagged the operator's own intake-entered part number as "hallucinated" when it didn't match the brand's usual numbering format (e.g. genuine short-form BMW "9112730") — the check is skipped when the output OEM number equals the user-provided one. Also hardened `composeDeterministicTitle`: strips a leading duplicate make from the model segment ("Audi AUDI Q7" → "Audi Q7"), rejects filler part names ("OEM", "general", "Salvage", "Other … Parts & Accessories") with fallback to the category name, strips OEM/Used/Genuine qualifiers that duplicate the "OEM Used" suffix, and refuses OEM part-number fields that are a bare year ("2012") or shorter than 4 chars. Stale test updated: `ebay-listing-text.util.spec.ts` asserted the pre-strict-guard behavior of preserving non-guideline stored titles.
- **Pipeline titles could carry stray supplier symbols, and OEM part numbers could contain embedded spaces:** `scripts/ebay-enrichment-pipeline.mjs` (the script `pipeline.processor.ts` spawns for every `/pipeline` GridX bulk-import job) read `Part Number` and description-derived part-name text straight from the source sheet with only whitespace trimming — a raw value like `AB 123 456` or a description containing `#`, `%`, quotes, or `®` flowed unchanged into the composed title and the `C:Manufacturer Part Number` / `C:OE/OEM Part Number` output columns. eBay File Exchange treats the part number column as a single token and titles are penalized for stray symbols. Fix: part numbers now have all whitespace stripped once at parse time (inherited by every downstream use — title, compatibility rows, output columns), and `buildTitle()` runs every composed segment (year/make/model/position/part name/OEM#) through a new `stripTitleSpecialChars()` allowlist filter (letters, digits, spaces, `- / & . , +`) before assembling the title.
- **Add Part enrichment could permanently fail with zero retries due to an `OpenAiService` startup race:** `OpenAiService` (`backend/src/common/openai/openai.service.ts`) built its raw `OpenAI` SDK client inside `onModuleInit()` instead of the constructor, with no readiness guard in `chat()`. A burst of queued BullMQ `auto-enrich` jobs picked up by the `inventory` worker right after a container restart could race ahead of `onModuleInit()` completing, hitting `this.client.chat.completions.create()` while `this.client` was still `undefined` — a bare `TypeError: Cannot read properties of undefined (reading 'chat')`. `EnrichmentRetryService`'s classifier intentionally treats "cannot read propert…" as a non-retriable code bug (`PERMANENT_MARKERS`), so these failed permanently with zero retries and never self-healed. Root-caused on production: 23 listing_records failed with this exact error within a ~200ms window (consistent with a post-restart job burst). Fix: the `OpenAI` client is now constructed synchronously in the constructor.
- **Add Part photo-validation only ran as an optional UI hint, not a hard gate:** the "must include a label/part-number close-up and an overall part shot" check already existed (`single-listing-form.service.ts`, via the vision model's `imageCoverage`) but only ran during the *optional* AI-assist step while filling the form. A user could skip that assist and submit anyway; the listing was created, and the *mandatory* background enrichment job ran the same check hours later, threw, and permanently failed the listing with no live feedback to whoever added the part (16 production records hit this). Fix: `createIntakePart` now rejects a submission with fewer than `PART_LOOKUP_MIN_VISION_IMAGES` (2) photos immediately, before the listing is created.
- **Correcting photos on a permanently-failed Add Part listing never actually resumed enrichment:** `updateListingImages` (the "Add photos" action) already re-triggered enrichment when enough photos were attached, but `InventoryAutoTriggerService.enqueueAutoEnrich` silently no-ops on any listing with `enrichmentPermanentFail = true` unless called with `force: true` — which this call site never passed. Uploading the missing photo just sat there; the listing stayed "failed" until someone separately hit the manual `reset-enrichment-retry` endpoint. Fix: `updateListingImages` now passes `force: listing.enrichmentPermanentFail` so a corrected photo set auto-resumes enrichment.
- **Pipeline dropped prices and images when GridX header row was corrupted:** If the source XLSX header row had duplicate/missing names (e.g. every column labeled `Part Number` after a bad Excel copy/paste), `scripts/ebay-enrichment-pipeline.mjs` failed to resolve `Price` / `Image URLs` by name and wrote `Start price=0` with empty `PicURL` for every listing. The script now detects corrupted GridX headers and falls back to the standard positional column map (Part Number, Price, Quantity, Vehicle Make, Description, Image URLs, SKU, Weight Major). Job `2d926d0e-062f-46a0-a55a-3df8a64c57ed` was recovered on production by repairing the source headers and backfilling catalog/listing prices and images from the source sheet.
- **Pipeline upload now requires the GridX sample header contract:** `/pipeline` ships `public/pipeline-gridx-sample.xlsx` (Download Sample Input). Client and server reject files whose header row is missing `Part Number`, `Price`, `Quantity`, `Vehicle Make`, `Description`, `Image URLs`, or `SKU`, or whose headers are duplicated/corrupted — before the job is enqueued. Files: `src/lib/pipelineGridxFormat.ts`, `backend/src/ingestion/pipeline-gridx-format.ts`, `src/components/pipeline/PipelinePage.tsx`, `backend/src/ingestion/pipeline.service.ts`.
- **Catalog filters "not working" — root cause was client-side SKU dedup fighting server pagination:** Every catalog filter (brand, condition, marketplace, team, shipping, status, stock, price, date, and all combinations) was verified correct end-to-end against the live API — the visible breakage came entirely from `CatalogManager` de-duplicating marketplace/SKU siblings **one page at a time** while the pager used the raw server `total`. On production data (19,342 rows / ~15,081 unique SKUs) this inflated the count ~28%, rendered fewer than `pageSize` rows per page, and — because 2,270 of 2,374 duplicated SKUs have their US/DE/AU siblings on *different* pages — showed the same SKU repeatedly across pages. Fix: dedup moved server-side behind a `groupBySku=1` flag on `GET /api/listings/search` (`backend/src/listings/search.service.ts`). The service now collapses siblings with `ROW_NUMBER() OVER (PARTITION BY <sku> ORDER BY <prefer US → title → image → marketplace → team → id>)` and aggregates every sibling marketplace via `array_agg(marketplace) OVER (PARTITION BY <sku>)`, so `total`, pagination, and rows are all SKU-consistent (rows without a SKU stay individual). Ordering/paging happen in an outer query over the deduped set. The catalog grid sends the flag and no longer dedups client-side (`src/components/catalog/CatalogManager.tsx`); other `/listings/search` callers omit the flag and get raw rows unchanged. New `SearchItem.marketplaces` carries the aggregated list for the badge. Backward-compatible and gated. Files: `backend/src/listings/dto/search-query.dto.ts`, `backend/src/listings/search.service.ts`, `src/types/search.ts`, `src/components/catalog/CatalogManager.tsx`.
- **Pipeline title generation now strictly follows eBay Listing Title Guidelines:** All titles enforced to `[Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used`. Part numbers compacted (spaces/dashes removed), parenthetical abbreviations stripped, concatenated models de-duplicated, platform-code slashes cleaned, fitsEbayTitleStructure tightened, OEM Used suffix preserved during truncation, AI prompt strengthened. Files: scripts/lib/strict-title.mjs, scripts/lib/platform-generation.mjs, scripts/lib/motors-enrichment-prompt.mjs, scripts/lib/listing-quality.mjs, scripts/lib/english-listing.mjs, scripts/ebay-enrichment-pipeline.mjs, backend/src/common/openai/listing-guards.ts.
- **Pipeline validation crash fixed (ReferenceError: Cannot access vehicle before initialization):** TDZ bug in validateAndFix() � const vehicle at end of loop body was block-hoisted. Moved to top of loop, removed 3 redundant declarations.
- **eBay publish now preserves reviewed listing titles and per-listing business policies:** Durable multi-store jobs retain the exact source `listing_records.id` through each target instead of re-resolving only the canonical catalog row. Publishing treats a non-empty stored title as authoritative (subject only to eBay's 80-character limit), so structured year/make/model fields no longer silently recompose it. Shipping, payment, and return profile names are resolved case-insensitively to IDs on each target eBay account; a missing or incompatible named policy is refreshed from eBay and then blocks the target rather than falling back to an unrelated store default. Per-listing policy resolution also no longer overwrites `ebay_account_marketplaces.default_*`, eliminating concurrent bulk-publish races that changed later targets' policies.
- **eBay revise propagation errors now retry:** Inventory API responses such as `Availability not found` and temporary `Cannot revise listing ... try again later` errors are classified as transient by the durable publish worker, using its existing exponential retry policy instead of permanently failing the target on the first response.
- **eBay publish preserves zero stock:** A reviewed listing quantity of `0` is now sent to eBay as zero instead of being coerced to `1` by the publish-request fallback. Placeholder bulk requests still hydrate quantity from the exact source listing row.
- **Export templates truncated images to 9 instead of eBay's 24-image limit:** `TemplateGeneratorService.setImages()` hardcoded `p.imageUrls.slice(0, 9)` and the US/AU/DE template headers only defined 9 image columns (`Item photo URL` + `AdditionalPicURL` through `AdditionalPicURL7`). Products with 24 images had 15 silently dropped on export. Fix: expanded all three template headers to include `AdditionalPicURL8` through `AdditionalPicURL23` (24 total image columns) and changed the slice cap from 9 to 24. Data pipeline was unaffected — `catalog_products.image_urls` and `listing_records.itemPhotoUrl` already stored all images; the truncation was export-only.
- **Pipeline catalog-import silently dropped an entire job's listings on a cross-job SKU collision:** `saveMarketplaceToCatalog` (`backend/src/ingestion/processors/pipeline.processor.ts`) bulk-inserts a marketplace's parsed rows into `listing_records` in one multi-row `INSERT ... ON CONFLICT (sourceFileName, sheetName, sourceRowNumber) DO NOTHING`. That conflict target only guards re-running the *same* job twice — it doesn't cover `idx_listing_sku_marketplace_unique_active` (SKU+marketplace unique among non-deleted rows), which is enforced DB-wide across jobs. The existing-row lookup used to decide UPDATE-in-place vs. INSERT was scoped to `pipeline_job_id = thisJob`, so a SKU already active from an *earlier, different* job (e.g. re-listing more parts off the same donor vehicle days later) wasn't recognized as existing. Postgres aborts an entire multi-row `INSERT` on any constraint violation, so one reused SKU silently zeroed out the whole job's listings — while the job itself still reported `completed` with no error recorded (`error_count` stayed 0, `last_error` empty), and `catalog_products` (upserted separately via `ON CONFLICT (sku) DO UPDATE`, which fails soft per-row) looked fine, masking the failure. Root-caused from job `0a46e03d-719c-48d5-9008-3cd454f8d478`: `Listing insert failed (offset 0): duplicate key value violates unique constraint "idx_listing_sku_marketplace_unique_active"` → `listing records — updated 0, inserted 0 (of 215)`. Fix: the existing-row lookup now matches by SKU+marketplace globally (any job, `deletedAt IS NULL`) instead of scoping to the current job, so a reused SKU is updated in place (and repointed to the current job) rather than poisoning the batch insert.

### Added
- **eBay-Browse-first part detection for warehouse intake — photos no longer required to identify a part:** `SingleListingFormService.lookupPart` / `lookupAndApplyToListing` / `autoEnrichListing` now identify each part from live eBay listings carrying the same OEM/MPN via the existing `EbayBrowseApiService.searchByMpn` (application token, deterministic, zero AI cost) **before** any vision or OpenAI-text lookup. New `runBrowseLookup` prefers items whose MPN aspect exactly matches the queried number, derives the part name from the `Type` aspect (falling back to a cleaned competitor title), and carries brand/category/fitment hints back into the standard `PartLookupResult` (`source: 'ebay_browse'`). Consequences: (1) the "Fetch details requires at least 2 photos" gate in `lookupAndApplyToListing` is removed — inline enrichment stage 1 no longer needs images at all; (2) the vision path only runs as a fallback when eBay has no matching listings, and its "Photos must include both a label/part-number close-up and an overall part shot" check no longer hard-fails a usable identification — incomplete coverage now just caps confidence at `medium` (it only throws when coverage is incomplete AND the model couldn't name the part). This retires the failure mode that permanently failed 19 production intake listings (`client_error_400: Photos must include both…`). (3) `InventoryAutoTriggerService.enqueueAutoEnrich` no longer returns `insufficient_images` — Browse-first enrichment proceeds even when a listing has fewer than 2 photos. The ≥2-photo gate at `createIntakePart` remains — photos are still required to *create* a part because eBay listings can't publish without them — but identification/enrichment enqueue no longer depends on them. Frontend `PartLookupResult.source` unions updated (`inventoryApi.ts`, `pipelineApi.ts`). Tests: `single-listing-form.service.spec.ts` (Browse-primary + fallback ordering).
- **`listing_records.origin` replaces the `sourceFileName === 'warehouse-intake'` sentinel-string pattern:** whether a part came from the "Add Part" form vs. the automated pipeline was previously inferred by string-comparing `sourceFileName` against the magic value `'warehouse-intake'`, repeated across ~9 call sites in `inventory-workbench.service.ts` (raw SQL and TS). New `origin` column (`'add_part' | 'pipeline_import'`, migration `1789200000000-AddOriginToListingRecords`, backfilled from the same sentinel) is now set explicitly at every creation site: the single-part intake form, the generic manual-listing API, CSV/catalog-import pipelines, AI-ingestion review approval, the eBay VIN-search cache, and marketplace clones (which propagate the source listing's `origin`). `sourceFileName`/`sourceFilePath` are unchanged — still load-bearing for the `uq_listing_source_row` unique constraint and real pipeline filename lineage. The inventory API's `intakeSource` boolean is now derived from `origin` server-side instead of the string comparison; no frontend changes needed there. Also added `failureReason`/`failureClass` (`code_bug | needs_data | system`) to the inventory list/detail API and a "Needs photo" badge state in `InventoryManager.tsx`, so ops can tell a missing-photo failure (self-serve: add the photo, it auto-retries) apart from an engineering bug without reading raw error text.
- **Title/part consistency verification (manual, on-demand):** New `POST /api/pipeline/jobs/:id/verify-titles` (`pipeline.review` permission) runs a batched, text-only Gemini check — does each catalog product's title actually match its identified part (`partType`/`mpn`/`oemPartNumber`/`brand`/`categoryName`)? No images, no eBay Browse API calls (Browse is throttled to 2 req/sec and used only for fitment/MPN lookups elsewhere); this only cross-checks fields already extracted during enrichment. Closes a gap `ListingQualityValidator`'s existing `MPN_MISMATCH` check didn't cover — that only compares declared vs. generated MPN, never whether the title *text* is consistent with the identified part. Mismatches are flagged only (`manualReview=true`, `optimizationStatus='needs_review'`, structured entry appended to `optimizationWarnings`) — titles are never auto-edited. New `TitleVerificationService` (`backend/src/listing-optimization/title-verification/`) batches products (`TITLE_VERIFICATION_BATCH_SIZE`, default 25) into single AI calls with bounded concurrency and a per-batch timeout, mirroring the existing listing-optimization chunking pattern; a batch-level failure leaves those products unprocessed rather than falsely flagging them. New `pipeline_jobs.title_verification_{status,processed,total,flagged_count,cost_usd}` columns track progress per job, surfaced automatically via the existing `GET /api/pipeline/jobs/:id`. Ships as a manual trigger only — not auto-chained into every pipeline run yet — to validate false-positive rate against real jobs first. Env: `TITLE_VERIFICATION_MODEL` (default `google/gemini-3.1-flash-lite`), `TITLE_VERIFICATION_BATCH_SIZE`, `TITLE_VERIFICATION_CONCURRENCY`, `TITLE_VERIFICATION_CHUNK_TIMEOUT_MS`.

- **Dead-temp-URL image bug — structural prevention (root-caused after the `1c3a0f2a`/batch recovery incidents above):** The `016cb03` fix and subsequent recoveries only patched `mirrorRemoteImages` and repaired existing data; they didn't stop new leaks. Two-layer fix: (1) **Self-healing cleanup** — `CleanupProcessor` (`backend/src/storage/processors/cleanup.processor.ts`) previously hard-deleted any `image_assets` row with `listingId`/`jobId` both null after 24h, trusting that FK linkage reflects "in use." But `itemPhotoUrl`/`image_urls` are plain string/array columns with no FK back to `image_assets`, so an upload referenced only by a raw URL (never routed through `POST /storage/confirm`) looked orphaned and got permanently destroyed even while a listing pointed at it — the exact mechanism behind every incident above. The processor now checks, before deleting any `temp/` object, whether its URL still appears in `listing_records.itemPhotoUrl` or `catalog_products.image_urls`; if so it mirrors the object into `catalog-images/healed/` and repoints those rows first, then deletes the original. This is a backstop that closes the loss vector regardless of which code path caused the leak. (2) **Write-time guards** — an audit of every site that persists `itemPhotoUrl`/`image_urls` found three that accepted raw client-supplied URLs with no validation: `InventoryWorkbenchService.updateListingImages` (photo-attach UI), `CatalogProductService.update`/`updateBySku` (catalog product edit, fanning out to all matching `listing_records` via `syncToListingRecord`), and `SingleListingFormService.createIntakePart` (warehouse intake). All three now route incoming URLs through `StorageService.mirrorRemoteImageUrls` before persisting — a no-op for already-durable URLs, but it promotes any `temp/` reference to a durable `catalog-images/` copy immediately instead of leaving a ticking 24h fuse. `StorageModule` now also registers `ListingRecord`/`CatalogProduct` (`TypeOrmModule.forFeature`) so `CleanupProcessor` can query them; `InventoryModule` now imports `StorageModule`. Regression test: `cleanup.processor.spec.ts`. **Known remaining gap:** `catalog-product.controller.ts` accepts an unvalidated `Record<string, unknown>` body instead of a typed DTO — broader input-validation hardening, tracked separately, not specific to this bug.
- **WYSIWYG item description editor:** On catalog product edit (`/catalog/products/:id` → Edit), “Item description from the seller” now defaults to a Visual (WYSIWYG) editor with formatting toolbar (bold/italic/underline, headings, lists, links). An **HTML** tab remains available for raw source edits. Same editor is used in the File Exchange edit panel and inventory marketplace version editor (`RichTextDescriptionEditor`).
- **Responsible soft-delete for inventory & listings (RBAC):** Defaults to `super_admin` + `admin` only; super admin can reassign via Roles UI. New `inventory.delete` permission with `DELETE /api/inventory/listings/:id` and `POST /api/inventory/listings/bulk-delete` (soft-delete). Catalog/listings delete UI gated by `listings.delete` (no longer `VITE_SHOW_CATALOG_DESTRUCTIVE_UI`). Confirmation modals on inventory single/bulk delete and catalog single/bulk delete.

### Changed
- **`listings.delete` default roles:** Narrowed from manager+ to `super_admin` + `admin` only (non-customized roles re-synced on boot). Managers lose delete unless a customized role grants it.
- **Clear catalog UI:** Gated by `catalog.clear` permission instead of the env flag.

### Added
- **`offerId` filter on published-listings endpoints:** `GET /api/published-listings` (and the store-scoped `GET /api/stores/:storeId/listings/published`) now accept an `offerId` query param, matching the existing `storeId`/`ebayAccountId` filters. Added `offerId` to `PublishedListingsQueryDto` and the query builder in `PublishedListingsService.list`.
- **Published Listings Reader API user — full documentation refresh:** Reset credentials, verified the account's exact permission scope (`published_listings.view` only) against production, and thoroughly tested pagination on all three published-listings query modes (unfiltered, `storeId`, `offerId`) plus 401/403 boundary checks. Documented with real, verified request/response examples and the full connected-store ID list in `docs/operations/api-users.md`.

### Added
- **OEM part identification via eBay Browse (identity truth-gate):** The enrichment pipeline now anchors each row's part **name/type** to eBay's live catalog instead of inferring it from the noisy supplier description. New `scripts/lib/browse-oem-identifier.mjs` searches the row's OEM/MPN part number on the Browse API (application token, `EBAY_US`), then derives the authoritative component by **agreement**: the leaf category the live listings majority-share, plus the majority `Type` aspect from the top items. A new pipeline step (`identifyPartsByOem`, run after VIN decode and before category mapping) does one Browse lookup per **unique** part number (bounded concurrency, disk-cached in `config/.ebay-oem-identity-cache.json`, per-run daily cap, 429 retry). When ≥2 listings agree on a leaf **and** a `Type` aspect is found, the verified type overrides `part.partName`/`_shortPartName` and is passed to the enrichment LLM as `verifiedPartType` — so the AI titles the correct component (`2008 Audi Q7 Fog Light 8T0941699E OEM Used`) rather than a wrong one. Rows it can't confidently anchor (blank/garbage part number, no agreement, no Type) keep the existing description-derived path — no regression. The verified name also flows into `buildCategoryKeywords`, improving category suggestion. Env: `PIPELINE_OEM_IDENTIFY` (default on), `PIPELINE_OEM_IDENTIFY_CONCURRENCY` (3), `PIPELINE_OEM_IDENTIFY_RPS` (2), `PIPELINE_OEM_IDENTIFY_DAILY_CAP` (4000), `PIPELINE_OEM_IDENTIFY_MIN_AGREEMENT` (2). Report block `oemIdentification` tracks unique numbers, anchored, low-confidence, and rows updated.
- **Published Listings Reader API user:** Created a read-only integration account (`api-published-listings@realtrack.local`) restricted to a single custom RBAC role (`api_published_listings_reader`) holding only `published_listings.view` — can call `GET /api/published-listings*` and `GET /api/stores/:storeId/listings/published*` and nothing else (verified: 403 on `/api/listings`, `/api/dashboard/*`, sync/revise/bulk actions, user/role admin). Documented in `docs/operations/api-users.md`. Uncovered and noted a gap: the admin API has no endpoint to attach a custom role to a user (`roleSlug` is validated against the fixed system-role enum on both `POST /api/rbac/users` and `PATCH /api/rbac/users/:id/role`), so this required a direct `user_roles` DB update — tracked as R10 in `docs/RBAC_AND_SECURITY.md`.
- **Store-scoped published-listings endpoints:** `GET /api/stores/:storeId/listings/published` and `GET /api/stores/:storeId/listings/published/:id` return the complete published listing data (title, price, images, item specifics, shipping/return policies, compatibility, health flags) currently live for a given connected store, sourced from the local `ebay_published_listings` mirror kept in sync by `PublishedListingsSyncService`. New `StorePublishedListingsController` (`backend/src/published-listings/store-published-listings.controller.ts`) reuses `PublishedListingsService.list`/`getById` with a new `storeId` filter, enforcing the same `published_listings.view` permission and per-user `StoreAccessService.assertStoreAccess` check as the existing org-wide `/api/published-listings` routes.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Add Part duplicate-save race:** `/listings/new` warehouse intake now allocates `sourceRowNumber` from a PostgreSQL sequence (`warehouse_intake_row_seq`) instead of `MAX(sourceRowNumber)+1`, preventing concurrent saves from colliding on `uq_listing_source_row`. Generated-SKU duplicate conflicts also retry automatically before returning an error. Migration: `1789100000000-CreateWarehouseIntakeRowSequence`.
- **Pipeline category/title guard for overlapping part keywords:** Category relevance checks now choose the most specific deterministic keyword match and override valid-but-wrong automotive categories before persistence (e.g. Center Console Armrest no longer lands in Door Panels). Updated US/AU/DE helper category IDs away from retired leaves, made the script-side Motors guard conservative around verified current IDs, and added duplicate title phrase rejection/cleanup for generated titles (A Pillar A Pillar, Center Console Center Console, etc.). Production remediation for pipeline 52292964-b8c5-4443-a076-088ed292a5a1 corrected 38 category rows and 26 duplicate-title rows across both listing_records and catalog_products; deterministic category mismatches and duplicate title phrases now verify at zero for that batch.
- **Pipeline generic part-identity guard:** Follow-up on pipeline 52292964-b8c5-4443-a076-088ed292a5a1 found rows whose extracted type was only Part, Not Specified, Miscellaneous, or Automotive but whose categories had been promoted to Fuel Injectors, ECUs, Hood Panels, Liftgates, etc. Script and backend category guards now reject generic identities unless a trusted deterministic keyword confirms the part family, reject broad/root IDs (6000, 262124, 262320), and fall back to publishable leaf 9886 for reviewable unknowns. Production remediation updated 48 listing rows and 49 catalog rows; generic titles now avoid those placeholder terms, Door Body/Radiator/Hardware rows use safer categories, and verification shows zero generic-to-specific category rows left in that batch.
- **Catalog images missing (recurrence) — pipeline job `1c3a0f2a` predates the `temp/` mirroring fix:** `/catalog?pipelineJobIds=1c3a0f2a-064c-4d86-8c37-c31f60ffd272` (903 Audi listings) rendered no images. Same root cause as the `375d6081` incident below (`mirrorRemoteImages` referencing ephemeral `mhn/temp/*.jpg` keys verbatim) — this job ran 2026-07-10, a day before the `016cb03` fix landed (2026-07-11), and was never included in that incident's one-off recovery. The daily `storage-cleanup` orphan sweep (`CleanupProcessor`, 24h TTL on unlinked `temp/` uploads) had since permanently deleted most of the referenced objects. Of 925 distinct dead image URLs for this job, only 23 (a shared reference-photo set reused across nearly all 903 rows) had a surviving `.webp` copy; recovered those into `mhn/catalog-images/recovered-1c3a0f2a/` and repointed `listing_records.itemPhotoUrl` + `catalog_products.image_urls` (pre-change values snapshotted in `img_recovery_backup_20260713_listing` / `_catalog`). Result: 902/903 rows now show their shared photos (each still missing one unique per-part close-up with no surviving object — needs source re-upload); 1/903 fully restored. **Follow-up (2026-07-14):** Ran the same probe-and-recover pass across the 10 other pre-fix pipeline jobs (`e087d840`, `4bb40db9`, `8fe03707`, `2b67af63`, `5d5c2413`, `6892099a`, `446cf813`, `5c2f95d4`, `589afdf3`, `bda73177` — ~4,300 additional `listing_records` rows). 8 of 10 jobs had a fully-recoverable shared reference-photo set and are now **100% restored** (2,903 rows: `e087d840` 1318, `4bb40db9` 649, `8fe03707` 573, `6892099a` 335, `446cf813` 16, `5c2f95d4`/`589afdf3`/`bda73177` 4 each), recovered into `mhn/catalog-images/recovered-{job8}/` and repointed on both tables. **`2b67af63` (563 rows) and `5d5c2413` (359 rows):** the one dead `temp/` URL per row has no surviving S3 object at any extension — but it's a secondary photo (each listing has ~20+ images from `_fitments`/compatibility photos); the primary/thumbnail image (first in the pipe-delimited list, what the catalog grid renders) is a correctly-mirrored `catalog-images/pipeline-images/...` URL and was never affected. Verified: 0/563 and 0/359 rows have a dead thumbnail. So the catalog grid for these two jobs was never actually broken — only the full image gallery in the detail modal is missing one photo per listing, and that one needs source re-upload (no further automated recovery possible). All pre-change values for the 8 fully-restored jobs snapshotted in `img_recovery_backup_20260714_listing` / `_catalog`. Note: a further 489 `listing_records` rows carry dead `temp/` refs with no `pipeline_job_id` (likely single-listing intake, not pipeline output) — not yet triaged.
- **eBay publish: wrong shipping policy and misspelled/year-less title on business-policy-rejection retry:** Two related bugs surfaced live on a published Motors listing (item `366539919376`, store "Primemotive"). (1) `EbayPublishService.refreshPoliciesFromEbayApi` — used when eBay rejects the submitted business policies mid-publish and the app refreshes+retries — picked `isDefault` or else the **first policy eBay happened to return** for fulfillment/payment, ignoring the originally-requested profile name (`req.requestedFulfillmentPolicyName`/`requestedPaymentPolicyName`). On an account with no `isDefault` fulfillment policy set, this silently applied an unrelated policy ("Bl Policy - 1000" instead of the configured "BLAP shipping policy 3 KG"), changing the live listing's shipping terms without any error or warning. `pick()` now matches the requested profile name first, falling back to `isDefault`/first only when no name match exists; both call sites (initial resolution and the reject-and-retry path) now pass the requested names through. Return-policy selection (which already has P&A-compliance-aware logic via `pickReturnPolicyIdForListing`) is intentionally left untouched to avoid narrowing its candidate pool in a way that could exclude the only compliant policy for P&A-required listings. (2) `ListingBuilderService.build` never derived a `yearRange` for the deterministic title composer (see "Deterministic eBay Motors title composition" below) and sourced `make` only from raw columns (`snapshot.brand`/`listingRecord.cBrand`), which can carry source-data typos (observed: "Bently" instead of "Bentley"). It now derives both from `catalogProduct.fitmentData` (via `parseFitmentEntry`) when present — fitment enrichment resolves make against the canonical `fitment_makes` table and carries the real compatible year span — so composed titles get a correct, spell-checked make and a real (non-fabricated) year range instead of silently omitting the year and republishing a raw-column typo. Live listing was manually corrected; regression test added in `listing-builder.service.spec.ts`.
- **eBay publish (recurrence, second code path) — same title bug in the catalog page's actual Publish button, plus a title-budget bug:** The prior fix above only covered `ListingBuilderService.build()`, used by the bulk multi-store BullMQ queue (`EbayListingPublishProcessor`). Two more incidents (Audi job `1c3a0f2a`, Lincoln job `5d5c2413`) showed the same symptom — misspelled brand, no year — after that fix was already deployed, because `POST /api/channels/ebay/publish` (`EbayPublishController` → `EbayPublishService.publish()`, the catalog page's actual Publish action) builds its title through a **separate, independent call to `sanitizePublishListingText`** that sourced `make` from `listing.cBrand`/`listing.extractedMake` (raw, uncorrected `listing_records` columns) and never passed a `yearRange` at all. `publish()` now derives `fitmentMake`/`fitmentYearRange` from `catalogProduct.fitmentData` the same way `ListingBuilderService` does, and prefers it. Separately, `buildStructuredEbayTitle` treats `yearRange`/`make`/`oemPartNumber` as never-dropped "essentials" — but a part with several superseding OEM numbers stored as one comma-joined field (observed: 5 numbers, ~60 characters) could consume nearly the entire 80-character budget on its own, silently producing a title with no year/model/part name at all (`"AUDI 8K0837440J, 8K0837440E, ... OEM Used"`). `buildStructuredEbayTitle` now caps `oemPartNumber` to its first comma/semicolon-separated value for every caller — eBay search only needs one identifying number in the title. Both live listings manually corrected; regression tests added in `ebay-listing-text.util.spec.ts` and `ebay-publish.service.spec.ts`. Also fixed, while restoring test coverage to actually verify this: `ebay-publish.service.spec.ts`'s mock constructor call was missing the `taxonomyCache` argument, silently shifting every subsequent mock one position out of place and causing 8 unrelated pre-existing test failures — added the missing mock, which fixed 7 of the 8 (the 8th is a stale assertion tracked separately).
- **eBay publish — fitment-derived make could mislabel the manufacturer entirely on cross-brand platform-sharing parts:** A DB-wide audit run after the two fixes above (checking how many *other* published listings hit the same brand/year bug) surfaced a real risk in that fix itself: `fitmentData[0].Make` is not always the same manufacturer as the part — fitment rows commonly include legitimate cross-brand platform-sharing applications (a Nissan part's compatible-vehicle rows can list Infiniti; a Lincoln part on a Ford platform can list Ford; also observed Audi/BMW, Chevrolet/Buick, Mini/BMW, Toyota/Lexus, VW/Audi). Blindly preferring `fitmentData`'s make in those cases — as the two prior fixes did — would silently swap in a wrong-but-plausible-looking manufacturer, a new bug rather than a fix. Audited 11,049 published listings joined to their catalog product: 1,652 had a raw-brand vs. fitment-make mismatch, but a Levenshtein/substring similarity pass showed only ~150 were genuine typos or formatting variants of the *same* make (`Lincon`/`Lincoln`, `CADILAC`/`Cadillac`, `JAGAUR`/`Jaguar`, `INFITY`/`INFINITI`, `PEGUOT`/`Peugeot`, `Bently`/`Bentley`, etc.) — the rest were legitimate cross-brand fitment. New `isSameMakeVariant` (`backend/src/fitment/fitment-mvl.util.ts`) gates the override: `EbayPublishService.publish()` and `ListingBuilderService.build()` now only replace the raw brand with `fitmentData`'s make when they're a typo/formatting variant of each other (or the raw brand is missing entirely) — otherwise the raw brand (the part's actual manufacturer) is kept, even if that means a fitment-listed make goes unused for the title. Regression tests added in `fitment-mvl.util.spec.ts` (both directions) and `listing-builder.service.spec.ts` (Nissan/Infiniti case). Historical mislabeled listings from the ~150 genuine-typo set were not bulk-corrected as part of this change — flagged separately for a deliberate, reviewed remediation pass since it touches thousands of live eBay API calls.
- **Pipeline re-runs now refresh existing listings (were silently dropped):** The post-enrichment catalog import upserted `listing_records` with `ON CONFLICT ("customLabelSku","marketplace")`, but a re-run collided on the `uq_listing_source_row` constraint `(sourceFileName, sheetName, sourceRowNumber)` and aborted the entire batch (`upserted 0`) — so re-running a job never updated its titles/data. `saveMarketplaceToCatalog` now matches existing rows by the stable part identity **`customLabelSku`** (scoped to `pipeline_job_id` + marketplace) and UPDATEs them in place — preserving row ids and FK links (`ai_enhancements`, `channel_listings`, `image_assets`) — inserting only genuinely new SKUs. (`sourceRowNumber` is the XLSX row position and shifts between runs as fitment rows change; the source-row triple is also date-stamped via the output filename, so neither is a usable conflict key.) Verified on job `572e96dd`: a resume-import reported `updated 652, inserted 0` and landed the OEM-anchored titles.

### Changed
- **OEM identify — one Browse call per part (was ~4):** `scripts/lib/browse-oem-identifier.mjs` now issues a single `item_summary/search?fieldgroups=MATCHING_ITEMS,ASPECT_REFINEMENTS` call: the leaf category comes from the item summaries (the `categoryDistributions` histogram only returns the broad `eBay Motors` root, id 6000 — not publishable) and the part **Type** comes from the `aspectDistributions` histogram computed over ALL matching listings. Only when the histogram omits Type for a category (e.g. Air Filter Housings) does it fall back to fetching a couple of items — so most parts cost one call while Type coverage is fully preserved. Verified live against production eBay: `8T0941699E`→Fog Light/33709, `03H133185G`→Intake Manifold/36474, `7L6129607AT`→Air Cleaner Filter Box Housing Lower Half/43946. Roughly 4× fewer Browse calls with equal-or-better identification.
- **Idempotent image mirroring — skip already-mirrored images on re-runs:** `StorageService.mirrorRemoteImages` now HEAD-checks the deterministic `catalog-images/{namespace}/{index}` key (probing the URL extension then common variants) and references the existing object instead of re-downloading + re-uploading it. This removes the largest wall-clock cost of a pipeline re-run (every image was re-uploaded each run). New `objectExists()` (HEAD, no body) + `PIPELINE_MIRROR_SKIP_EXISTING` env (default on). Same images — no quality change.
- **Donor-vehicle context from the uploaded filename:** The enrichment pipeline (`scripts/ebay-enrichment-pipeline.mjs`) now parses a donor vehicle from the upload filename (e.g. `Q7 AUDI SILVER 2008.xlsx` → `{ year: 2008, make: Audi, model: Q7 }`) and uses it to gap-fill `getVehicleInfo` for parts that lack a VIN or a descriptive sheet name. Without this, a single-vehicle workbook whose rows carry no VIN produced empty year/make/model, so the AI enrichment prompt had no vehicle context — parts were mis-identified and titles omitted the leading Year/Make/Model. A new dictionary-driven resolver (`resolveVehicleFromText`) identifies make/model **independent of token order** and ignores color/trim noise words ("SILVER"), reusing the same `VEHICLE_MAKE_MODELS`/`VEHICLE_MAKE_ALIASES` maps now hoisted to module scope (previously duplicated inside `parseVehicleFromDescription`). `parseVehicleFromSheetName` also tries the resolver first so reversed-order sheet names resolve correctly. VIN and sheet data always win — only empty fields are filled — so multi-vehicle files are unaffected. The backend `PipelineProcessor` passes the original filename to the script via the new `PIPELINE_ORIGINAL_FILENAME` env var (falls back to the stored file's basename, timestamp prefix stripped).
- **Parallelized MVL fitment validation during catalog import:** The post-enrichment `saveToCatalog` phase previously validated fitment data for each catalog product **sequentially** (1,229 products × 1 `await` per product = slow). Replaced the sequential `for` loop with a bounded-concurrency `mapWithConcurrency` worker pool (default 8 workers, configurable via `PIPELINE_MVL_IMPORT_CONCURRENCY`). Each product still gets individual MVL validation with the same semantics (per-product fitment data checked against the local MVL store, rejected/valid counts accumulated, progress reported every 10 products). Expected ~8× speedup for large jobs. The `mapWithConcurrency` helper preserves result ordering and is safe for in-place product mutation (JS single-threaded).
- **Deterministic eBay Motors title composition:** `buildEbayListingTitle` (and the publish path through `ListingBuilderService` and `EbayPublishService.sanitizePublishListingText`) now assembles listing titles deterministically into the house structure `Year Range → Make → Model/Generation → Position → Part Name → OEM Part Number → "OEM Used"` when structured catalog/listing fields are available, instead of publishing a free-text/AI title verbatim. New `buildStructuredEbayTitle` in `backend/src/channels/ebay/ebay-listing-text.util.ts` caps the result at 80 characters on a word boundary, drops optional segments in priority order (position → generation → model → part name, keeping year range / make / OEM number), and appends `OEM Used` only when space permits. Year range and generation are **not** fabricated — explicit values only; the composed title starts with `Make` when no explicit year range is carried. Manual per-store `titleOverride` still wins verbatim. A `recomposed` warning is emitted when an existing stored title is replaced.
- **Catalog publish UX — inline progress panel:** Publishing listings to eBay no longer blocks the catalog page with a full-screen overlay modal. The `PublishModal` now only handles store selection; after clicking "Publish", a new inline `PublishProgressPanel` appears above the catalog table showing per-store progress (pending → publishing → success/failed) with a progress bar and collapsible results. Users can continue browsing the catalog while publishing runs in the background.
- **Catalog high-volume eBay publishing:** Catalog pagination now supports 500 rows (`GET /api/listings/search` accepts `limit=500`). A bulk action submits up to 500 listings once to `POST /api/ebay/listings/publish-bulk`; the server persists one `ebay_listing_jobs` row plus per-listing/per-store targets and queues them through BullMQ at concurrency 5. Jobs survive browser closure, expose live target polling, retry transient failures up to four times with exponential backoff, preserve per-store outcomes, and enforce an organization-wide UTC-day quota of at most 5,000 listing/store targets (`EBAY_DAILY_PUBLISH_TARGET_LIMIT`, capped at 5,000). Progress polling has publish-specific throttle overrides without weakening other application routes.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Pipeline title sanitization — VIN/duplicate make-model stripping + eBay title template:** Pipeline listings (e.g. job `572e96dd`) had titles like `2005-2015 AUDI Q7 Wauay54l98d068586, Audi, Q7, Ultrasonic Sensor 8E0054635A OEM` containing VIN numbers and duplicate make/model in the title. Root cause: the source spreadsheet's raw data (including VINs) was passed through to the AI enrichment prompt, which faithfully included it in the title. No existing guard stripped VINs from titles. Fix: (1) Added `sanitizeTitle()` to `listing-guards.ts` — deterministic regex-based stripping of VIN blocks (17-char alphanumeric + ", Make, Model, " duplicates). Integrated into `applyListingGuards()` as `TITLE_SANITIZED` fix. (2) Updated all 3 enrichment prompt templates and compliance service title prompt with the eBay title structure: `[Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used` — VINs and duplicate make/model are forbidden; OEM part numbers are required. (3) Added VIN to `TITLE_FORBIDDEN_PATTERNS` in `ebay-compliance.service.ts`. (4) Added `POST /catalog-products/sanitize-titles` endpoint for retroactive bulk cleanup. (5) Production: rebuilt all 766 titles for job `572e96dd` following the template (e.g. `2005-2015 Audi Q7 Ultrasonic Sensor 8E0054635A OEM Used`) — 766 listing_records + 766 catalog_products, 0 remaining VINs, all ≤80 chars.
- **Catalog bulk publish transient recovery and throttle safety:** Bulk publishing now uses one durable job-submission request rather than one request per listing. BullMQ retries only transient SellerPundit/eBay failures (`Product not found`, Core Inventory 500, timeout, rate-limit, and `Too Many Requests`) with exponential backoff. `CatalogManager` keys the progress panel by publish-job ID so a new job cannot inherit stale listing state.
- **eBay error 25005 follow-up — root category was not publishable:** Pipeline job `1c3a0f2a` contained 903 Audi listings and exposed that the emergency category fallback `6000` is the Motors Parts & Accessories root, not a leaf accepted by eBay Inventory. Changed the hardcoded emergency fallback in `EnterpriseListingIntelligenceService.getFallbackLeafCategory()` to proven leaf `9886` (`Other Car & Truck Parts & Accessories`) while retaining subtree-based leaf discovery as the preferred path. Repaired both `listing_records` and `catalog_products` for the affected pipeline before republishing to BLACKLINEAUTOPARTS and Primemotive.
- **Catalog images missing — dead `temp/` URLs from unmirrored uploads:** Catalog products/listings from Gridx-sourced pipeline jobs (e.g. `375d6081`) rendered no images because their `image_urls`/`itemPhotoUrl` pointed at `s3://…/mhn/temp/*.jpg` objects that return 403 (AccessDenied). Root cause: uploads are processed to `.webp` (original `.jpg` removed), but the Gridx sheet's "Image URLs" column bakes in the `.jpg` URL, and `StorageService.mirrorRemoteImages` short-circuited any URL already in our own bucket — it copied the ephemeral `temp/` key verbatim into the catalog instead of persisting a durable copy. When the `.jpg` disappeared, the catalog rows went dead. Fix: `mirrorRemoteImages` now detects `temp/` keys (via `isTempKey`) and copies them into the durable `catalog-images/` prefix, with a `.webp` fallback when the referenced extension is already gone; permanent keys (`catalog-images/`, `originals/`) remain a no-op. Production remediation: recovered all 48 S3-recoverable images (surviving `.webp`) into `mhn/catalog-images/recovered/`, then repointed 1,190 `catalog_products` + 2,248 `listing_records` rows (pre-change values snapshotted in table `img_recovery_backup_20260711`). Job `375d6081` fully restored (659/659 products + listings, HTTP 200). Remaining 1,865 catalog / 4,180 listing rows reference images with no surviving S3 object of any extension (several with malformed UUIDs) and require source re-upload.
- **eBay error 25005 — invalid category IDs from Motors category resolver:** Pipeline job `6892099a` had all 335 draft listings assigned to 37 non-Motors eBay categories (e.g. 31373 "Lincoln Memorial", 2518 "Other Educational Toys", 11774 "Other Welding Equipment") by the AI taxonomy suggestions, causing every `publishOffer` to fail with eBay errorId 25005. Root cause: `ebay_category_mappings` table was empty (seed migration `1709769600000-MotorsIntelligenceSystem` was never run on production) AND `isMotorsCategory()` in `enterprise-listing-intelligence.service.ts` returned `true` by default for any unmapped category, allowing non-automotive suggestions to pass validation. Fix: (1) `isMotorsCategory()` now returns `false` for unmapped/unknown categories, forcing fallback to `6000` (Parts & Accessories); (2) seeded `ebay_category_mappings` with 15 known Motors categories + the `6000` default; (3) bulk-updated all 335 `listing_records.categoryId` to `6000` for the affected pipeline job. Deployed to EC2 via backend image rebuild.

- **eBay compatibility/fitment publish invariant:** Listings with vehicle fitment visible in description HTML were not always sending structured `product_compatibility` data to eBay. `EbayPublishService.enrichPublishRequest` now derives compatibility centrally from `catalog_products.fitment_data` or `fitment_rows` for bulk, legacy, and queue callers. Fitment-capable Motors categories are blocked when validated Year/Make/Model rows are absent; invalid stored rows are rejected instead of silently omitted. Listings with compatibility use the direct eBay Inventory API path even for SellerPundit-connected stores, write `PUT /inventory_item/{sku}/product_compatibility`, read it back, and verify every requested row before `publishOffer`. Compatibility rows are deduplicated; rejected rows, year ranges, and mixed-case field names remain normalized by `fitment-mvl.util.ts`.
- **Shipping policy resolution bug:** Pipeline-published eBay listings showed free shipping instead of the configured "BLAP shipping policy 3 KG" because `enrichPoliciesFromMarketplace` never resolved the shipping profile **name** (stored on `listing_records.shippingProfileName`) to its eBay fulfillment policy ID — it fell back to the marketplace default ("BL Auto Speedpak shipping policy - Free Shipping", ID `264471251019`). Fix: `EbayPublishService.resolvePolicyByName()` now looks up `ebay_business_policies` by name + type + marketplace and feeds the resolved ID into the coalesce chain alongside synced-table and store defaults. `enrichPublishRequest` backfills `requestedFulfillmentPolicyName`/`requestedReturnPolicyName`/`requestedPaymentPolicyName` from the listing record. Production remediation: 68 published + 32 unpublished offers from pipeline job `8fe03707` were updated to the correct fulfillment (`268965917019`), payment (`264471151019`), and return (`264471195019`) policies via eBay Inventory API `PUT /offer` + `POST /offer/{id}/publish`.
- **Published-listings policy update endpoint:** `PATCH /api/published-listings/:id/policies` now accepts `fulfillmentPolicyId`, `paymentPolicyId`, `returnPolicyId` and calls `updateOffer` + `publishOffer` to revise policies on already-live listings. Bulk action `update_policies` added to the bulk job processor.
- **Pipeline category misclassification fix:** 141 catalog products from pipeline job `8fe03707` were assigned non-Motors eBay categories (Bags & Backpacks, Motherboards, Mugs, Shower & Bath Seats, etc.) by the AI category classifier, causing 32 offers to fail eBay's `publishOffer` with error 25005 ("invalid category ID"). Fixed by remapping all wrong categories to `14769` (Other Exterior Parts & Accessories — a valid eBay Motors US leaf category) on both the eBay offers (`updateOffer` + `publishOffer`) and the `catalog_products` table. All 32 previously-unpublished offers are now live on eBay with correct shipping/policies.
- **Catalog date filters:** "Today" and "Yesterday" under Date Added now map to the correct local calendar day (yesterday previously used today's range). Search uses `importedAt::date` for inclusive day matching.
- **MVL import on Linux Docker:** Password-protected US/UK workbooks now resolve `python3` (with `python` symlink in the backend image) for `decrypt_xlsx.py`. Large US workbooks import in parse chunks (`EBAY_MVL_PARSE_CHUNK_SIZE`, default 5000) to avoid Node heap OOM.
- **Production MVL Docker setup:** `docker-compose.yml` mounts `drive-download-…` as `/app/mvl-data`, sets `EBAY_MVL_*` and `FITMENT_*` env defaults, and defaults `PIPELINE_SKIP_MVL_ON_IMPORT=false`. `PATCH /api/rbac/roles/sidebar-config` was matched by `@Patch(':id')` first, so the body was validated as `UpdateRoleDto` and rejected with "property configs should not exist". Static `sidebar-config` routes are now registered before parameterized `:id` routes.
- **Add Part export template failure:** Parts added via "Add Part" (warehouse intake) only created a `ListingRecord` but no corresponding `CatalogProduct`, causing export templates to fail with "No catalog products found for given IDs". Now creates a catalog product on intake. Backfill script: `scripts/backfill-intake-catalog-products.sql`.
- **Pipeline exit code 1 crash:** `categoryAiMinConfidence` variable was referenced in the AI category classifier setup but never declared, causing `ReferenceError` at line 643 and every pipeline job to exit with code 1. Added the missing `const categoryAiMinConfidence = Number(env.PIPELINE_CATEGORY_AI_MIN_CONFIDENCE)` declaration alongside `categoryAiModel` and `categoryAiBatchSize`.

### Added
- **Pipeline catalog import progress:** Post-enrichment catalog import now reports debounced progress during spreadsheet parsing, eBay MVL fitment validation, and DB writes (`stage_details.catalogImport`, sub-stages `catalog_parsing` / `mvl_validation` / `catalog_saving`). Pipeline wizard shows live counts and suppresses stale-progress warnings while import is active.
- **Pipeline resume-import:** `POST /api/pipeline/jobs/:id/resume-import` re-runs only the catalog import phase for a job that finished enrichment + output generation but got stuck during import (e.g. slow MVL validation on a worker without the batched lookup optimization). Reuses on-disk output XLSX files — does NOT re-run enrichment. Cleans stale BullMQ jobs before enqueuing a `resume-import` worker job. Requires `pipeline.manage`. Bulk upload requires marketplace (US, UK, AU, DE), eBay store, and shipping/return/payment profiles. Choices persist on `pipeline_jobs` and stamp output rows + catalog import (row values win when present). Store selection filters by marketplace for cross-list anchoring. Queue table shows marketplace and store columns. UK category template is generated alongside US/AU/DE outputs (`output_uk_path`, `GET /api/pipeline/jobs/:id/download/uk`).
- **Settings → Store policies:** New tab on `/settings` lists every connected eBay store with configured/incomplete status, per-store policy sync, and inline default fulfillment/payment/return/location mapping (`StoreDefaultPoliciesTab`, shared `EbayAccountPolicyEditor`). Requires `ebay.view`; saving requires `ebay.manage`.
- **MVL-driven fitment expansion:** Enrichment prompt v4 (`enrichment-v4-mvl-fitment`) removes AI `compatibility[]` output; fitment is expanded deterministically from platform generation + local `ebay_mvl_entries` (`MvlFitmentExpanderService`, `scripts/lib/mvl-fitment-expander.mjs`). Optional interchange micro-call when row count is thin (`FITMENT_AI_INTERCHANGE=auto`). Env: `FITMENT_EXPANSION_MODE` (default `hybrid`), `FITMENT_MIN_MVL_ROWS`, `FITMENT_SIBLING_EXPANSION`, `FITMENT_MVL_REQUIRED`. `ai_run_logs` tracks `fitment_source`, `tokens_saved_estimate`. Migration: `1785600000000-AddFitmentSourceToAiRunLogs`.
- **eBay MVL reference database:** Official Master Vehicle List spreadsheets (US/AU/DE/GB) import into `ebay_mvl_releases` + `ebay_mvl_entries`. `EbayMvlService` validates and cascades Make/Model/Year from PostgreSQL first (Taxonomy API fallback). CLI: `cd backend && npm run mvl:import`. API: `POST /api/fitment/ebay-mvl/import`, `GET /api/fitment/ebay-mvl/status`. Env: `EBAY_MVL_DATA_DIR`, `EBAY_MVL_WORKBOOK_PASSWORD`. Pipeline catalog import auto-validates fitment when local MVL is loaded (`PIPELINE_SKIP_MVL_ON_IMPORT` defaults to off in that case).
- **Catalog inventory summary modal:** Clicking a row title on `/catalog` opens `CatalogInventoryDetailModal` — structured read-first view with inline **Edit Details**, **eBay Store & Policies**, and full **image management** (drag reorder, delete, upload up to 24). Title links to full editor when not editing field details. `teams` and `team_members` tables, RBAC permissions (`teams.view`, `teams.manage`), Settings → Teams admin UI, and team assignment on pipeline upload. Every part in an upload inherits the selected team; catalog search supports `teamIds` filter with membership-scoped access; pipeline queue shows upload ID, team, condition, and uploader.
- **Pipeline page redesign:** Single-page layout matching the operations mockup — bulk upload card (condition + team + drag-drop), rules explainer, and paginated pipeline queue with status filters.
- **Docker migration entrypoint:** Backend container runs pending TypeORM migrations on start when `DB_MIGRATIONS_RUN=true` (uses `DB_MIGRATION_HOST` for direct Postgres, avoiding PgBouncer for DDL).
- **Catalog bulk policy edit:** "Edit Policies" action on selected listings respects the active team filter; server validates team scope via `POST /api/listings/bulk-profiles`.

### Changed
- **Pipeline single-marketplace flow:** Bulk upload picks the marketplace from the selected eBay store (no separate marketplace dropdown). The enrichment script honors `PIPELINE_TARGET_MARKETPLACE` from the job — only that marketplace gets category mapping, localization, XLSX output, and catalog import. US jobs skip UK/AU/DE localization entirely. Legacy jobs without a marketplace still generate all four outputs.
- **Catalog search API enrichment:** `GET /api/listings/search` and facets now return `teamId`, `teamName`, `teamColor`, `catalogStatus`, and `shippingProfileName` per row. New query filters: `stockLevel`, `shippingProfiles`, `catalogStatus`, `importedFrom`, `importedTo`. Team facet includes `color`.
- **AI category classifier default:** `PIPELINE_CATEGORY_AI_MODEL` defaults to `google/gemini-2.5-flash` (90% benchmark accuracy on Motors leaf categories). Marketplace-aware prompts and per-tree Taxonomy resolution for AU/DE.

### Added
- **AI category mapping tier:** When eBay Taxonomy quota is exhausted (`PIPELINE_CATEGORY_MODE=auto`), pipeline batches category classification via OpenRouter (`google/gemini-2.5-flash` default), resolves to real eBay IDs via Taxonomy API per marketplace tree, and caches 90 days. Benchmark: `node scripts/model-comparison/category-model-benchmark.mjs`.

### Changed
- **MVL fitment validation parallelized & batched:** `EbayMvlService.validateParsedRows()` store branch now validates fitment rows via phased batched lookups instead of per-row sequential queries. ~16,000 per-row `COUNT` queries collapse to ~3–5 batched `IN (...)` queries plus a small number of canonicalization lookups for non-matching makes/models (run concurrently, bounded by `MVL_VALIDATION_CONCURRENCY` default `6`). New `EbayMvlStoreService.batchExistingMakes/Models/Years()` perform set-based existence checks. Validation logic and accept/reject/needs_review outcomes are unchanged — the make → model → year cascade is reorganized into phases but each phase depends only on the previous phase's output, so decisions are identical. Result order preserved. Cuts catalog-import time on large jobs (e.g. 573-part / 3,355-fitment-row jobs) from ~30+ min toward ~1–3 min. API-fallback branch remains sequential (circuit breaker + shared cache).
- **Pipeline output stage reliability (659+ part jobs):** Cap export fitment rows (`PIPELINE_EXPORT_MAX_FITMENT_ROWS=80`, description HTML `PIPELINE_DESC_MAX_FITMENT_ROWS=30`) to avoid multi-hundred-thousand-row XLSX files. Write US/AU/DE templates sequentially with progress sub-stages. Skip redundant marketplace AI backfill when all three regional outputs exist. Skip per-row eBay MVL re-validation on catalog import by default (`PIPELINE_SKIP_MVL_ON_IMPORT=true`). Post-output steps now report sub-stages (`mirror_images`, `catalog_import`, `finalizing`) instead of appearing stuck on Output.
- **Pipeline speed & progress accuracy:** Fixed misleading `output_generation` stage during AU/DE localization and image fetch (now stays on `validation` with `subStage` labels). Default localization mode `copy` AI-translates titles and descriptions for AU/DE; fitment/compatibility data (`_fitments`, `Compatibility`, `fitment_flat`) is built before localization and preserved in all marketplaces. `PIPELINE_FAST_MODE=1` enables rule-only localization, skips validation, and skips post-pipeline marketplace AI backfill.
- **Neutral processing UI (Tier A):** Pipeline job view no longer shows AI token counts or OpenRouter messaging; stale-progress hint and enrichment status panel use generic “processing / content service” language. Inventory enrichment badges and stage labels de-emphasize AI. Removed `Sparkles` icon app-wide (replaced with contextual icons).

### Added
- **ECU vision identification prompt:** Specialised AI vision prompt for ECUs, TCMs, BCMs, and electronic control modules. Extracts hardware numbers, software numbers, OE/OEM numbers, and all visible label text instead of hallucinating vehicle make/model. Auto-detected from part type keywords (ECU, TCM, BCM, Steuergerät, etc.).
- **eBay catalog lookup by MPN in fitment discovery:** When no catalog fitment data exists, searches eBay Browse API for existing listings of the same part number. Extracts category ID, EPID, and Year/Make/Model from item specifics. Applied to both fitment rows and category resolution. Confidence: 0.70.
- **Image reorder and remove:** Drag-and-drop reordering of listing images via `@dnd-kit/sortable`. Remove button on each thumbnail. "Save image order" button updates the pipe-delimited URL string and syncs `image_assets.sort_order` for eBay publish. New `PATCH /inventory/listings/:id/images/reorder` endpoint.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Pipeline upload 503:** Upload no longer counts queued `pending` jobs against `MAX_CONCURRENT_PIPELINE_JOBS` (only actively processing stages). Stale jobs with no progress for 6h are auto-failed to free slots. Upload UI now shows the backend error message (e.g. capacity reached) instead of generic "503 Service Unavailable".
 `POST /api/inventory/inline-enrich` enqueues BullMQ `auto-enrich` (no blocking HTTP). `updateListingImages` auto-enqueues at 2+ photos. `POST /api/inventory/listings/:id/retry-enrichment` forces re-run. `enrichmentStage=failed` on errors; `needs_review` when category ID or fitment missing after run.
- **eBay Taxonomy 429 during inline enrich:** Category suggestions retry with exponential backoff; in-memory cache + 800ms spacing between US/AU/DE lookups. Improved category query strings (skip generic `OEM` part type).
- **Inline enrich fitment:** Runs `FitmentDiscoveryService` and writes `catalog_products.fitmentData`. `completed` requires both resolved `categoryId` and fitment rows.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **SKU allocation race condition:** Replaced application-level `readMax + check + retry` SKU allocation with a PostgreSQL `SEQUENCE` (`sku_seq`). Concurrent listing creation now gets guaranteed-unique `BLA-XXXXX` SKUs via `nextval()`. Removed `GET /pipeline/single-listing/next-sku` endpoint (SKU is now assigned server-side at save time). Frontend shows "Auto-assigned on save" instead of a pre-fetched SKU. Migration `1785200000000-CreateSkuSequence` seeds the sequence from existing data.
- **Catalog product field persistence:** Fixed field name mismatch where frontend sent `countryOfManufacture` but backend expected `countryOfOrigin`. Added missing `cMaterial`, `cPlacement`, `countryOfOrigin`, and `conditionLabel` columns to `listing_records` entity. Updated `syncToListingRecord()` to sync these fields from catalog products to listing records. Migration `1785100000000-AddFieldsToListingRecord`.

### Added
- **Catalog bulk profile selection:** When listing on channels or downloading export templates from the catalog bulk action bar, users can pick shipping, return, and payment profiles from store-fetched dropdowns. Profiles apply to eBay publish (`publish-by-listings` policy IDs + profile names) and export templates (`export-templates` overrides with optional persist). Components: `ProfileSelectors`, `ExportTemplatesModal`; `PublishModal` bulk/single flows updated.
- **Published Listings Management Module:** Central dashboard at `/published-listings` with Inventory API sync, **Trading API GetSellerList fallback** for legacy listings, **Browse API competitor pricing**, health flags (including price vs market), bulk actions, audit revisions, and scheduled 6h sync. Permissions: `published_listings.view|sync|manage|bulk`. Migration `1785000000000-PublishedListingsModule`.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Pipeline jobs queued serially:** BullMQ `pipeline` worker concurrency was hardcoded to `1`, so only one enrichment job ran at a time even when `MAX_CONCURRENT_PIPELINE_JOBS` allowed two. Worker concurrency now follows `MAX_CONCURRENT_PIPELINE_JOBS` (default `2`); per-job progress debouncing is isolated for safe parallel runs. (`PipelineProcessor`)
- **Per-marketplace category resolution & fitment (US/AU/DE):** Inline enrichment now resolves each marketplace's eBay category against its **own category tree** (US→`0`, AU→`15`, DE→`77`) instead of always using the US tree. Empty category resolution no longer silently marks enrichment `completed` — it now surfaces `needs_review`. Inline enrichment also upserts the `catalog_products` master row so the catalog detail page has a `categoryId`/`fitmentData` source even without a batch pipeline run. (`InventoryWorkbenchService.inlineEnrichListing`)
- **AU category tree ID corrected:** `CategoryLookupService.KNOWN_TREE_IDS.EBAY_AU` was `'100'` but eBay's `get_default_category_tree_id` for `EBAY_AU` returns `'15'`. AU category lookups now return correct results (e.g. `261899 Fuel Vapour Canisters`). (`CategoryLookupService`)
- **AU motors fitment enabled:** `EBAY_AU.supportsMotorsFitment` was `false` but AU tree `15` supports `Year/Make/Model/Trim/Engine` compatibility. Now `true`. (`EbayMarketplaceConfigService`)
- **Fitment discovery per-marketplace:** `FitmentDiscoveryService.discover()` now accepts `marketplace` + `categoryId` options and resolves the correct category tree for compatibility checks and MVL validation, instead of hardcoding the US tree (`'0'`). `ListingOptimizationService.optimizeProduct()` resolves the per-marketplace `categoryId` from the matching `listing_records` row. (`FitmentDiscoveryService`, `ListingOptimizationService`)
- **MVL validation tree threading:** `EbayMvlService.validateFitmentData()`, `validateParsedRows()`, `getMakes()`, `getModels()`, `getYears()`, `resolveCanonicalMakeModel()` now accept an optional `treeId` parameter so fitment validation can run against AU/DE trees, not just US. (`EbayMvlService`)
- **Shared marketplace→tree utility:** New `resolveCategoryTreeId()` helper provides canonical eBay category tree IDs per marketplace. (`ebay-marketplace-tree.util.ts`)

- **Published listings sync:** Trading API fallback failed because `GetSellerList` omitted required `EndTimeFrom`/`StartTimeFrom`; sync now uses **GetMyeBaySelling ActiveList** as the primary source for all live listings, with Inventory API enrichment afterward. Inventory API `GET /offer?sku=` 404 no longer aborts sync.

- **Pipeline-grade enrichment with stage tracking:** `inlineEnrichListing` now runs the full flow — vision part lookup → `EnrichmentPipeline.enrich()` (AI enrichment with category mapping, item specifics) → marketplace content generation (US/AU/DE). Stages written to new `enrichmentStage` column on `listing_records`. Frontend polls `GET /inventory/listings/:id/enrichment-status` and shows human-readable labels ("Detecting part from photos...", "Running AI enrichment...", "Generating US eBay listing..."). (`InventoryWorkbenchService`, `InventoryAutoTriggerService`)
- **Inline enrichment (`POST /api/inventory/inline-enrich`):** Runs complete enrichment synchronously — creates marketplace `listing_records` directly, no BullMQ pipeline job. (`InventoryWorkbenchService.inlineEnrichListing`)
- **Auto-trigger enrichment on 2 images:** Background `auto-enrich` job calls inline enrichment instead of pipeline. (`InventorySyncProcessor.handleAutoEnrich`)
- **Elaborate inventory filters:** New query params on `GET /inventory/listings`: `dateAddedFrom`, `dateAddedTo`, `brand`, `make`, `model`, `category`. Metadata endpoints: `GET /inventory/filters/brands`, `/makes`, `/models?make=X`, `/categories`. Frontend collapsible filter panel with date pickers and cascading make/model dropdowns. (`InventoryWorkbenchService`, `InventoryListingsQueryDto`)
- **Send to catalog (`POST /api/inventory/send-to-catalog`):** Creates/updates `CatalogProduct` records from enriched listing data. Replaces "Send to pipeline" as the primary action. (`InventoryWorkbenchService.sendToCatalog`)
- **Frontend hooks:** `useFilterBrands`, `useFilterMakes`, `useFilterModels`, `useFilterCategories`, `useSendToCatalog`, `useInlineEnrichListing`. (`inventoryApi.ts`)
- **Migration `1784000000000-AddEnrichmentStageToListingRecords`:** Adds `enrichmentStage` varchar column with index to `listing_records`.

### Removed
- **"Fetch details" button** removed from modal and table — enrichment auto-fires on 2 images.
- **"Send to pipeline"** toolbar action — replaced by "Send to catalog".
- **`useInventoryPartLookup`, `useInventoryBulkPartLookup`** hooks removed.
- **Per-row "Actions" column** removed from inventory table.

### Changed
- **Inventory heading description** updated to reflect auto-enrich + send-to-catalog flow.
- **Photo upload hint:** "2 required: label close-up + overall shot for automatic enrichment".
- **`EnrichmentBadge`** now shows stage hints (e.g. "Vision...", "AI Enrich...", "US...") during enriching.
- **Catalog column** replaces Pipeline column in the inventory table.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Inventory auto-enrich trigger:** When a listing reaches **2+ images**, a background BullMQ job auto-fires vision lookup (part#/brand discovery) followed by pipeline enrichment (US/AU/DE). No button clicks needed. Added `enrichmentStatus` (idle/ready/enriching/completed/failed) to the workbench list + detail endpoints, a polling endpoint, and animated status badges in the table. (`InventoryAutoTriggerService`, `auto-enrich` job handler)
- **Inventory multi-marketplace editor (`/inventory/:id/edit`):** New full-page editor replacing the read-only modal. Shows 3 tabs (US/AU/DE) with editable title, description, price, quantity, and condition. Store selector dropdown scoped to user's accessible eBay stores, with cascading payment/return/fulfillment policy dropdowns from cached policy data. Part summary card shows SKU, brand, category, images, fitments. **Save persists** edits to sibling `listing_records` + `catalog_products.optimization_payload`. Accessible via "Open full editor →" link in the detail modal. (`InventoryEditorService`, `InventoryListingEditor`, `MarketplaceVersionEditor`, `StorePolicySelector`)
- **Direct publish from editor:** New `POST /inventory/:id/publish` endpoint auto-creates a catalog product (if needed) and invokes the multi-store publish flow. UI policy selections are saved to `listing_store_overrides` and applied at publish via `ListingBuilderService`. Sticky publish action bar at the bottom of the editor shows target marketplaces and per-target progress (queued → success/failed/skipped). (`InventoryPublishService`, `PublishActionBar`)
- **Inventory per-store eBay status:** List and detail endpoints expose `storeListings` (store name, marketplace, offer ID, live price/qty, status) from `ebay_listing_channels`.
- **Catalog dedup + marketplace badges:** Catalog grid groups listing records by SKU — one card per part. Each card shows colored marketplace badges (US/AU/DE) in both grid and list views. The existing `CatalogProductDetail` page at `/catalog/products/:id` already had multi-marketplace tabs, completing the catalog polish. (`CatalogManager` dedup logic, `ListingCard`/`ResultsGrid` badge display)
- **Add Part GridConnect intake (`/listings/new`):** Two-column form with part type (OEM / Aftermarket / Salvage), condition (New / Used), brand, optional vehicle make, price, and qty. **Process SKU** runs text AI lookup (when available) and saves a draft to inventory — photos are optional at intake. Salvage auto-defaults condition to Used.
- **Inventory photo upload:** `PATCH /api/inventory/listings/:id/images` attaches S3-uploaded photos to draft listings (`listings.update`). Detail modal includes upload zone + **Attach photos** action; min 2 photos still required for Fetch details / Send to pipeline.
- **AI enrichment: platform generation alignment:** Shared `shared/automotive-platform-ranges.json` + `platform-generation.util.ts` validate chassis codes against year ranges (e.g. Lexus RX AL20 ≠ 2013–2021). Pipeline and enterprise listing builders auto-align titles/specifics for **US, AU, and DE**; quality gates hard-fail `GENERATION_YEAR_MISMATCH`. German titles include RX350/RX450h-style variant tokens; English US/AU titles use the same platform builder (`ebay-english-listing.util.ts`). Dashboard trim maps to category 33717. `/listings/new` is now **Add Part** (OEM + brand + min 2 photos → draft `listing_records` with `sourceFileName=warehouse-intake`; form resets for next part). `/inventory` is the selection hub: one row per SKU, part detail modal, **Send to pipeline** (creates pipeline CSV with vision on photos; auto-navigates to `/pipeline?job=…`). Re-queue warns when a part already has a completed pipeline job. Enrich/publish removed from inventory — use `/pipeline` and `/catalog`. Permission `inventory.enrich` gates send-to-pipeline. APIs: `POST /api/pipeline/single-listing/add-part`, `GET /api/inventory/listings`, `GET /api/inventory/listings/:id/detail`, `POST /api/inventory/send-to-pipeline` (alias `POST /api/inventory/enrich`).
- **Multi-marketplace listing generation (`ensureMissingMarketplaceListings`):** Pipeline now auto-creates US, AU, and DE listing records for every catalog product, regardless of which marketplace the source data was from. When only DE data is imported, English AI-optimized listings (US/AU) and native German listings (DE) are generated using marketplace-specific prompts. Language is maintained throughout — titles, descriptions, and SEO content are properly localized per marketplace.
- **Composite unique index on `listing_records` (`customLabelSku`, `marketplace`):** Replaced the single-column unique index on `customLabelSku` with a composite index that allows the same SKU to have separate listing records per marketplace. Migration `1783000000000-ListingSkuMarketplaceUniqueIndex`.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Pipeline catalog publish readiness (images + identity):** Enrichment cache keys now include intake fingerprint (part name, seller note, upload URLs) so the same MPN with different warehouse identity is not reused as stale AI copy. Source/upload images are preserved when the image API fails; `propagateSourceImages` copies intake photos onto `catalog_products.image_urls` and all US/AU/DE `listing_records` after pipeline save. Catalog master upsert uses **US output only** (DE/AU no longer overwrite shared title/images). Listing upserts keep existing `itemPhotoUrl` when pipeline output is empty.
- **Inventory Fetch details restored (vision-first):** `/inventory` again supports per-row and bulk **Fetch details** using OEM + brand + photos together (vision-first AI). Updates title, category, brand, model, and SEO-oriented description notes on the draft before **Send to pipeline**. `lookupPart()` now runs vision when 2+ images are present; OEM text is only used when no photos are supplied.
- **Add Part (`/listings/new`) 500 on second part:** Warehouse intake used a fixed `sourceRowNumber=0` for every part, violating `uq_listing_source_row`. Each intake now gets the next row index; duplicate-key errors return 409 with a clear message.
- **Inventory detail modal crash:** `startPriceNum` from the API can arrive as a string; price display now coerces safely before `.toFixed()`.
- **Pipeline listing upsert:** Raw SQL upsert in `saveMarketplaceToCatalog` was missing
  the `version` column (`@VersionColumn`), causing every listing record insert to fail
  with "null value in column 'version' violates not-null constraint".
- **Pipeline listing upsert:** Backfilled `pipeline_job_id` on existing listing records
  for completed pipeline jobs that had 0 listing records due to previous `orIgnore()` behavior.

### Added
- **eBay MVL integration (end-to-end):** Pipeline catalog import now validates AI/export fitment rows against live eBay Taxonomy MVL before saving (`MvlStatus` on each row). Catalog publish builds `product_compatibility` from `fitmentData` (or store fitment override) via Inventory API. Part lookup on `/listings/new` canonicalizes brand/model against MVL after AI inference. Shared utilities in `fitment-mvl.util.ts`; validation centralized in `EbayMvlService.validateFitmentData`.
- **Add Part form (`/listings/new`, superseded):** Previously a full enrichment form with Fetch details + pipeline submit; moved to inventory workbench (see warehouse intake split above). SKU/brands APIs unchanged.
- **Password management:** Users can change their own password via `PATCH /api/auth/change-password` (Settings → Account tab). Admins/super-admins can reset any user's password via `PATCH /api/rbac/users/:id/reset-password` using the `users.reset_password` permission (Users admin → Manage user modal). Both actions are audit-logged.
- **Multi-user Phase 3 (testing/observability):** Concurrency unit tests for job visibility, scheduler leader, heavy job limiter, and listing version conflicts; k6 baseline script; `GET /api/health/runtime`; global `X-Response-Time-Ms` header and slow-request logging (`SLOW_REQUEST_MS`).
- **Multi-user Phase 2 (scale):** PgBouncer + prod compose overlay; Redis 512MB in prod; `GET /api/health/queues` (admin); heavy job caps (`MAX_CONCURRENT_PIPELINE_JOBS`, `MAX_CONCURRENT_CATALOG_IMPORTS`); job-scoped pipeline uploads; Socket.IO Redis adapter (`REDIS_SOCKET_ADAPTER`); scheduler leader election (`SCHEDULER_LEADER_ENABLED`); per-user rate limits on pipeline/catalog heavy routes.
- **Multi-user P0 hardening (Sprint 1):** `ALLOW_PUBLIC_REGISTRATION` env gate (default off in production/Docker); self-registered users receive Viewer role; `GET /api/auth/public-config` for login UI; JWT default expiry reduced to 4h (`JWT_EXPIRY_SECONDS=14400`).
- **Channel connection scoping:** `GET /api/channels` uses JWT user id (removed `userId` query param); disconnect/test scoped to owner.
- **WebSocket auth:** Notification gateway verifies JWT from `handshake.auth.token` before joining user rooms.
- **Job attribution:** Pipeline, ingestion, and catalog-import uploads record `createdBy` from JWT; review endpoints record reviewer id.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Pipeline listing records not saved to catalog:** `orIgnore()` on listing record inserts silently skipped all rows when `customLabelSku` already existed in `listing_records` (due to `idx_listing_sku_unique_active` partial unique index). Replaced with raw SQL upsert (`ON CONFLICT ("customLabelSku") WHERE ... DO UPDATE SET`) to properly update existing records with the new `pipeline_job_id`.
- **Multi-user P1.3:** `createdBy` wired on all job creation/mutation paths (ingestion, pipeline, catalog-import start/retry/cancel, motors product create, fitment bulk-import queue); legacy null `createdBy` backfilled on retry/cancel/start; review reject records `reviewedBy`.
- **Multi-user Phase 1:** Partial unique index on active listing SKUs; pessimistic lock + retry on create; `version` required for PATCH status and optional per-id in bulk update; ingestion/pipeline/catalog job lists scoped by `createdBy` (admins with `users.view` see all).
- **Security:** Removed DEBUG JWT/secret logging from auth module and JWT strategy.
- **CURRENT_TRUE_STATE_OF_APPLICATION.md**: Comprehensive codebase analysis document covering architecture, database, APIs, frontend, backend, integrations, deployment, testing, and documentation accuracy. Generated 2026-06-11.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.
 (Documentation)
- **Corrected documentation counts**: Migrations (21→27), entities (~79→82), permissions (~90→73), backend specs (9→24), e2e tests (1→0). Updated across ARCHITECTURE.md, CONTEXT.md, CURRENT_STATE.md, KNOWN_ISSUES.md, AGENT_SYSTEM_MEMORY.md, DATABASE_SCHEMA.md, AUTH_RBAC.md, FEATURE_REGISTRY.md.
- **Added new security finding**: DEBUG JWT logging in `auth.service.ts` and `jwt.strategy.ts` exposes full tokens to console. Added as R3b to KNOWN_ISSUES.md.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **User management (`/settings/users`) create/role assign failures:** `POST /api/rbac/users`
  and `PATCH /api/rbac/users/:id/role` returned 400 because inline DTOs lacked
  `class-validator` decorators and were rejected by the global `ValidationPipe`. Added
  `CreateRbacUserDto` / `AssignRoleDto` with proper validation; frontend `rbacApi` now
  surfaces API errors instead of leaving the modal stuck on "Creating…".
  (`ebay-german-listing.util.ts`) replaces word-substitution localization. DE AI prompt,
  interior-vs-exterior category correction (e.g. door armrest → Interior Door Panels),
  expanded German item specifics (`Hersteller`, `Einbauposition`, `Universelle Kompatibilität`),
  US-seller transparency in DE shipping copy, and pre-publish DE validation rules.
- **EBAY_DE SellerPundit publish auth + Hersteller errors:** Direct eBay Inventory API fallback
  now localizes item specifics (`Brand` → `Hersteller`) for German marketplace listings.
  SellerPundit store sync probes each imported token against eBay Inventory API (not Identity,
  which returns 404 without scope) so `connection_status` reflects eBay acceptance, not only
  SellerPundit connectivity. Pre-publish validation live-checks SellerPundit tokens and blocks
  with `reconnect_sellerpundit_ebay` when eBay returns invalid access token. Publish failures
  after invalid-token retry mark the account `reconnect_required` with guidance to refresh eBay
  OAuth inside SellerPundit admin (RealTrack re-sync alone cannot fix tokens issued to SP's app).
- **Pipeline mandatory listing optimization stuck:** Catalog upsert after enrichment used
  camelCase column names in `ON CONFLICT DO UPDATE` (`brandNormalized` etc.) while PostgreSQL
  expects snake_case (`brand_normalized`), so products never saved and optimization ran on 0
  listings. Parallel US/AU/DE optimization jobs also raced on `optimization_by_marketplace`
  JSONB updates, leaving `optimization_status` stuck at `running`.

### Changed
- **AI token optimization (models unchanged):** Compact Motors enrichment prompts
  (`enrichment-v2-compact`), year-range fitment output with code-side expansion,
  MPN enrichment file cache (`config/.enrichment-cache.json`), compact JSON inputs,
  low-value SKUs (&lt;$50, `AI_LOW_VALUE_MAX_PRICE`) skip LLM fitment generation,
  localization translates metadata fields only (not full HTML descriptions),
  vision defaults to `OPENAI_VISION_DETAIL=auto`, and backend `EnrichmentCacheService`
  for duplicate MPN hits.
- **AWS t3.medium tuning:** Default env profile for 2 vCPU / 4 GB RAM — Node heap
  **1536 MB** (was 8192), DB pool **10/2** (was 20/5), pipeline concurrency **3**
  (was 6–8), catalog import concurrency **2**, Postgres `shared_buffers=128MB`,
  Redis `maxmemory 128mb`. See `.env.example` and `docker-compose.yml`.
- **Pipeline eBay taxonomy hardening:** Category tree ID is cached on disk
  (`output/.ebay-taxonomy-cache.json`), rate-limit failures use negative cache
  with backoff (15 min for HTTP 429), tree resolution is single-flight, default
  taxonomy concurrency lowered to **3**, and taxonomy errors surface in the
  enrichment report + pipeline UI when keyword fallback is used for all categories.
- **Pipeline parallel processing:** Enrichment, localization (AU+DE), and image
  fetch stages now use a continuous concurrency pool (default **8** AI batches in
  flight). Removed global `CONFIG` mutation race in batch routing. OpenRouter
  429 responses get longer exponential backoff. Post-enrichment: validation runs
  first, then **images + localization in parallel** (was sequential). Tunable via
  `PIPELINE_AI_CONCURRENCY`, `PIPELINE_LOCALIZATION_CONCURRENCY`, etc.

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- **Pipeline zombie jobs after Docker restart:** On backend boot, pipeline jobs still
  marked in-flight but absent from the BullMQ queue are failed with a retry hint
  instead of showing endless `enrichment` at 0/N. Stats API now returns
  `processing` / `pending` counts expected by the UI (was only `byStatus`).
- **Pipeline processing UX:** Processing view shows time since last progress update
  and a stale-progress hint when enrichment pauses for several minutes.
- **Pipeline enrichment progress frozen at 0%:** `[PROGRESS]` markers were only
  emitted after *all* AI batches finished (`Promise.allSettled` then loop), so
  large jobs (e.g. 958 parts) showed `0 / N` for the entire enrichment phase.
  Progress now updates as each batch completes. UI shows a clear **queued**
  message when status is `pending` (worker concurrency is 1).
- **Docker OpenRouter probe failures:** Backend `NODE_OPTIONS` now sets
  `--dns-result-order=ipv4first` and `--no-network-family-autoselection` so Node
  reaches `openrouter.ai` inside Docker Desktop (IPv6 connect was timing out with
  `Connection error` / `ETIMEDOUT`). Pipeline script imports the same IPv4
  bootstrap before OpenAI calls.
- **eBay Taxonomy API fallbacks:** Production `EBAY_CLIENT_*` credentials added to
  root and `backend/.env`; backend container restarted via Compose. Enrichment
  pipeline now resolves `EBAY_MOTORS_US` category tree (not hardcoded tree `0`)
  for `get_category_suggestions` and `get_item_aspects_for_category`.
- **RBAC sync race on boot:** `RbacService.syncFromRegistry()` is now single-flight
  and tolerates duplicate `role_permissions` inserts so backend starts cleanly
  when permissions are added.
- **Pipeline OpenRouter validation:** `validateOpenAiKey()` uses `max_tokens: 16`
  (gpt-4.1-mini minimum) instead of 5, which blocked all enrichment runs. Probes
  a fallback model list when the configured default is unavailable.
- **GridX / fallback listing quality:** `extractPartNameFromDescription()` strips
  donor boilerplate (VIN, year/make noise) so fallback titles and item specifics
  use the actual part name. Fitment export now maps Mercedes C350/C300-style
  donor models to eBay MVL `C-Class` with trim preserved. Enrichment report
  adds `totalListingsGenerated`, `totalAiEnriched`, and `enrichmentMode` so
  fallback runs are not misread as zero listings.

### Added
- **AU/DE marketplace copy localization:** Post-enrichment pass translates titles,
  descriptions, and tabbed policy shells for AU (`en-AU`) and DE (`de-DE`) outputs.
  Rule-based German enum mapping applies when OpenRouter is unavailable.
- **Pipeline enrichment status panel:** `/pipeline` job view surfaces `enrichmentMode`,
  AI vs fallback counts, OpenRouter probe errors, and localization stats from the
  enrichment report via `stageDetails`.
- **Production AI routing enablement scripts:** `scripts/import-ai-run-logs.mjs`,
  `scripts/seed-ebay-categories-from-mappings.mjs`, and SQL helpers to seed
  `ebay_categories` from mappings and bulk-load pipeline `ai-run-logs.json` into
  PostgreSQL for the optimizer dashboard.
- **AI routing dashboard + Phase 4 completion:** `/settings/ai-routing` UI for segment
  stats, optimizer recommendations, and policy JSON. `EbayTaxonomyTruthService`
  (opt-in via `AI_TAXONOMY_VALIDATION_ENABLED`) validates cached eBay category
  leaf + required aspects. Optimizer reward uses `compliance_score`, `hardFailRate`,
  and `publishErrorRate` from `ai_run_logs`. Compliance outcomes backfilled from
  catalog `EbayComplianceService` and motors `ComplianceEngineService`. Unit tests
  for reward, canary hash, and listing guards. Migration `1775710000000`.
- **Ingestion routing parity:** `VisionEnrichmentPipeline` routes vision ingestion through
  `ModelRouter`, guards, validator, and `ai_run_logs`; image enrichment uses `text` lane
  with run logging. Offline regression gate `scripts/model-comparison/regression-check.mjs`
  + GitHub workflow `ai-routing-regression.yml`. Pipeline `ai-run-logs.json` includes
  per-lane attempt/cost summary.
- **AI routing API + backlog wiring:** `GET/POST /api/ai/routing/*` for segment stats,
  recommendations, policy read, and optimizer run (`ai.routing.view` /
  `ai.routing.manage`). Optimizer writes `ai_routing_policy_history`; guard fixes
  log to `compliance_audit_logs` when product/import context exists;
  `AiRunLog.enhancement_id` set on enrichment create; per-lane session cost
  tracking; CLI `--apply` appends `config/ai-routing-policy-history.json`.
- **eBay Motors AI model comparison:** Benchmark harness + report under
  `scripts/model-comparison/` and `docs/model-comparison/`. Runs the production
  enrichment prompt over a representative 8-part sample from
  `docs/2008 Mercedes C350 AMG.xlsx` across 8 OpenRouter models, scoring
  title/description/specifics/fitment, schema reliability, live cost, and latency.
  Finding: recommend switching default from `minimax/minimax-m3` to
  `openai/gpt-4.1-mini` (deeper legitimate fitment, faster, ~$2.10/1k); use
  `deepseek/deepseek-chat-v3-0324` for low-cost bulk and `google/gemini-2.5-flash`
  for flagship listings. `nova-lite`, `claude-3.5-haiku`, and `llama-3.3-70b`
  failed to return valid JSON at batch size 8. See `docs/model-comparison/REPORT.md`.
- **AI optimization implementation plan:** `docs/ai-optimization/IMPLEMENTATION_PLAN.md`
  — multi-model router, quality gates, escalation, `ai_run_logs` learning loop,
  nightly optimizer, and phased rollout (5 phases).
- **AI optimization plan status:** `docs/ai-optimization/IMPLEMENTATION_PLAN.md` updated
  with Phase 0–3 completion markers, file map, backlog (§9.4), and ops reference (§22).
- **AI optimization system (Phase 1–3 foundation):** Multi-model `ModelRouter`
  (`backend/src/common/openai/model-router.ts`, `scripts/lib/model-router.mjs`)
  with seeded policy `config/ai-routing-policy.json`. Default lane
  `openai/gpt-4.1-mini`; flagship `google/gemini-2.5-flash`; bulk
  `deepseek/deepseek-chat-v3-0324`. Deterministic guards + `ListingQualityValidator`
  with one-shot escalation. `ai_run_logs` table + `AiRunLogService`; approve/reject
  backfill in `AiEnhancementService`; publish outcome hook in `EbayComplianceService`.
  Pipeline writes `output/ai-run-logs.json`. Advisor CLI:
  `scripts/ai-optimize-routing.mjs`. Nightly `AiOptimizerService` (opt-in via
  `AI_OPTIMIZER_ENABLED`). Operator guide: `docs/ai-optimization/README.md`.
- **SellerPundit eBay connection source:** Import eBay stores from SellerPundit
  (`connection_source = sellerpundit`) without a new channel type. Backend module
  `backend/src/integrations/sellerpundit/` handles login, store/token sync,
  policy sync, and publish via `bulk-create-using-api`. Migration
  `1775600000000-SellerPunditExtensions`. API under
  `/api/integrations/ebay/sellerpundit/*`. Publish wizard shows per-target
  SellerPundit errors from `error_payload`. Settings UI: import/sync on eBay stores
  page; SellerPundit badge on store detail (native listing/order sync hidden).

### Fixed
- **eBay legacy inventory-location placeholder:** Publish location resolution now treats the literal default key as a legacy placeholder and uses the required enabled Dubai location AE_Dubai instead; location-list selection applies the same rule.
- **eBay collision and warehouse-policy failure handling:** Account-level SKU collisions now use a deterministic bounded alternate for every valid imported SKU family (including FORD-*), while existing channel mappings reuse the assigned alternate on later publishes. eBay overseas-warehouse location blocks (reference 1276646 / SRM_HIS_WH_Location_Mismatch_Inventory_Block) are classified as permanent and bulk revise actions now preserve the detailed eBay reason with actionable location/authorization guidance.

- OpenRouter AI calls now use **MiniMax M3 only** (`minimax/minimax-m3`):
  enrichment pipeline no longer falls back to GPT-4o/GPT-5.x; pipeline script
  routes through `OPENAI_BASE_URL`; model env vars added to `backend/.env`.
- Bulk/stub eBay publish no longer forces `condition: NEW` over
  `listing_records.conditionId`, which incorrectly required seller-paid P&A return
  policies for used salvage parts (buyer-paid 30-day returns are valid for Used).
- Publish enrichment and the inventory Publish modal no longer default missing
  condition to `NEW`; salvage listings keep `3000` / Used so buyer-paid 30-day
  return policies (e.g. `287569277015`) are accepted.
- SellerPundit policy sync no longer assigns cross-geo defaults (e.g. `EBAY_DE`
  return policy `287569277015` on `EBAY_MOTORS_US`). US P&A return blocking is
  scoped to US marketplaces only; blocked messages include listing condition and
  geo mismatch hints.
- SellerPundit import/publish now infers marketplace from account names like
  `(SVG-DE) German Salvage Dismantlers` → `EBAY_DE`, fixing "Missing business
  policy IDs after sync" when DE-only policies were synced against a US default
  marketplace row.
- Catalog → SellerPundit store publish no longer hits `API 504: Gateway Time-out`
  as often: removed redundant policy sync on every publish, parallelized SP
  `get-all-policies` fetches, stopped forcing full `get-all-tokens` refresh before
  each bulk-create, skip eBay Account API overlay when cached REST policy ids are
  valid, retry SP bulk-create once on 504, extended nginx/Vite timeouts for
  `/api/channels/ebay/publish*`, and treat SP 504 as a platform error with direct
  eBay fallback in `auto` mode.
- Catalog → store publish for SellerPundit-linked eBay accounts no longer fails with
  `eBay authorization failed` / OAuth `Invalid access token` when the cached token
  is stale. SellerPundit token expiry now respects `lastTokenRefreshDate`, tokens
  refresh aggressively before direct eBay Inventory API fallback, and publish retries
  once after a forced SellerPundit re-fetch.
- Catalog → Motors store publish no longer fails at `publishOffer` with
  `invalid shipping policy` / invalid fulfillment policy when SellerPundit sync
  stored internal policy ids (e.g. `2770043`) instead of eBay REST ids
  (e.g. `410665908022`). SellerPundit policy sync now extracts REST ids from
  `policy_details`, re-syncs when marketplace defaults are invalid, overlays
  eBay Account API policies when the token allows, and direct publish refreshes
  policies + retries `updateOffer`/`publishOffer` on policy rejection.
- Direct eBay Inventory API publish no longer fails with `Could not serialize field
  [marketplaceId]` for Motors stores. Offer payloads now map internal `EBAY_MOTORS_US`
  to eBay's `EBAY_MOTORS` MarketplaceEnum while request headers keep `EBAY_MOTORS_US`.
- Motors P&A catalog publish no longer fails with error `25021` (invalid item condition)
  for legacy `3000-Used` imports. File Exchange id `3000` now maps to `USED_EXCELLENT`
  (not `USED_GOOD`), with an automatic retry when eBay rejects other used enums.
  Republish also reuses existing unpublished offers (error `25002`) instead of failing.
- All eBay publish entry points now converge on `EbayPublishService` (catalog wizard
  processor, Motors channel queue, multi-store production publish). Inventory Manager
  bulk publish calls `POST /api/channels/ebay/publish-by-listings` with server-side
  enrichment instead of sending `{ listingIds }` to the wrong batch shape.
- Catalog eBay publish for Parts & Accessories scopes seller-paid return rules to
  **New / New Other only** (per eBay June 2025 Seller Center). Used Motors listings
  may publish with buyer-paid 30-day return policies again; mandatory seller-paid
  enforcement, pre-flight blocks, and auto-upgrade apply only when condition is
  New or New Other. If eBay still returns a P&A return error on a used listing,
  publish surfaces a condition-mismatch hint (verify `3000` / `USED_EXCELLENT` is
  sent to SellerPundit/eBay).
- SellerPundit `bulk-create-using-api` no longer fails user-facing publish in `auto`
  mode when SP returns the known `tokens.marketplaceId` SQL defect. Adapter
  force-refreshes tokens, sends `marketPlaceId`/`tokenId` aliases, tags platform
  errors, and `EbayPublishService` transparently completes via direct eBay Inventory
  API (including errors previously only present in the `errors[]` array).
- Catalog eBay publish no longer fails with `Invalid value for title` when
  catalog titles are empty or longer than 80 characters. Titles are normalized,
  truncated at word boundaries, and fall back to brand/MPN/SKU before publish
  (listing builder, validation warnings, direct eBay API, and SellerPundit paths).
- Catalog eBay publish no longer fails with `imageUrls cannot be null or empty`
  when products have blank, invalid, or pipe-delimited image entries. Image URLs
  are normalized to valid http(s) links, deduped, capped at 12, and blocked at
  validation/build time when none remain.
- Legacy catalog publish modal (`POST /api/channels/ebay/publish`) now backfills
  images from `listing_records.itemPhotoUrl` or `catalog_products.image_urls`
  when the client sends an empty or pipe-wrapped `imageUrls` array. SKU detail
  page splits pipe-delimited photos, shows a thumbnail strip, and links to the
  eBay publish wizard (`/catalog/products/:id/publish/ebay`).
- Catalog → store publish no longer fails with `Invalid value for description`
  (eBay requires 1–4000 characters). Imported HTML descriptions with embedded
  `<style>` blocks are stripped, long text is truncated at safe boundaries, and
  empty descriptions get a title/SKU-based fallback (`buildEbayListingDescription`).
- Catalog → store publish no longer fails with generic **The request has errors**
  from eBay when offers omit required Motors fields. Legacy publish now backfills
  Brand/MPN/Type aspects, sets `listingDuration: GTC`, adds used-item condition
  descriptions, refreshes SellerPundit policy IDs from the live eBay Account API
  for the target marketplace, and surfaces eBay `parameters` in error messages.
- Catalog → store publish no longer fails with **Missing inventory location**
  when a SellerPundit store has policies but no `default_inventory_location_key`.
  Publish and policy sync now list eBay inventory locations via the store token,
  auto-provision a default warehouse location when none exist, and persist the key
  on `ebay_account_marketplaces` and `stores.location_key`.
- Catalog → store publish no longer fails with eBay `Invalid request` when legacy
  condition codes (`3000-Used`, numeric File Exchange IDs) or missing
  `merchantLocationKey` are sent to the Inventory API. Conditions map to valid
  enums; listing records backfill SKU/title/category when the modal sends stubs;
  direct eBay publish validates policies and location before `createOffer`; and
  inventory locations are fetched for all stores when not mapped.
- Catalog → store publish no longer fails with `At least one valid image URL
  (http/https) is required to publish` when the catalog browse ID is a
  `listing_records` row (images in `itemPhotoUrl` or `image_assets`) rather than
  `catalog_products.image_urls`. `CatalogPublishResolverService` resolves either
  ID type, **materializes a `catalog_products` row** when missing (required for
  publish-job FK), backfills empty catalog images from the listing, and merges
  image sources; `EbayMultiStoreListingService` stores the canonical catalog id on
  job targets. Channel publish processor splits pipe-delimited `itemPhotoUrl`
  values; publish wizard loads listing title when catalog product lookup misses.
- Catalog eBay publish for SellerPundit-linked stores tries SellerPundit
  `bulk-create-using-api` first, then **falls back to direct eBay Inventory API**
  when SellerPundit returns the known platform error
  (`column tokens.marketplaceId does not exist`). Uses synced SellerPundit eBay
  tokens + marketplace policy defaults from `ebay_account_marketplaces`.
- Catalog eBay publish (`POST /api/channels/ebay/publish`) failed with
  `Invalid value for header Content-Language` because Inventory API calls did
  not send `Content-Language` (BCP-47, e.g. `en-US`) or
  `X-EBAY-C-MARKETPLACE-ID` derived from each store's marketplace.
- Catalog eBay publish (`POST /api/channels/ebay/publish`) returned opaque
  `401` for SellerPundit-linked stores: legacy `EbayAuthService` now refreshes
  tokens via SellerPundit and targets each store's production/sandbox API host
  instead of always using the global `EBAY_ENVIRONMENT` default.
- SellerPundit Docker: pass `SELLERPUNDIT_*` env vars through `docker-compose.yml`
  (container ignores `backend/.env`; use project root `.env`).
- SellerPundit missing credentials now returns HTTP 400 with a clear message instead of 500.
- Client settings save (`PATCH /api/client-settings`) returned 400 because the UI
  posted the full entity (`id`, `createdAt`, etc.). PATCH now sends only DTO
  fields; empty support email is normalized to `null`.
- Frontend API clients now send the JWT `Authorization` header on protected routes
  (catalog import, pipeline, listings, channels, orders, notifications, and
  others). Unauthenticated `fetch` calls were causing `401 Unauthorized` after
  RBAC was enabled.

### Documentation
- **Documentation reorganization (2026-06-06):** Reorganized all documentation into the
  Self-Sustaining AI Project Context framework. Created 4 new directories
  (`docs/context/`, `docs/planning/`, `docs/frontend/`, `docs/backend/`) with 37
  target files, consolidating content where there was genuine redundancy (e.g.,
  `docs/RBAC_AND_SECURITY.md` + `docs/architecture/auth-rbac.md` →
  `docs/architecture/AUTH_RBAC.md`). Anchor files preserved intact
  (`API_MAP.md` → `API_CONTRACTS.md`, `DATABASE_MAP.md` → `DATABASE_SCHEMA.md`,
  `BACKEND_MAP.md` → `MODULE_MAP.md`, `FRONTEND_MAP.md` → `COMPONENT_MAP.md`).
  12 new-gap stubs created with honest scope notes. Marked 30+ superseded files
  with redirect headers and 13 legacy files with LEGACY REFERENCE headers.
  Updated AGENTS.md, CLAUDE.md, README.md, CONTEXT.md, and
  AGENT_SYSTEM_MEMORY.md with all new paths. No existing content deleted.
- Established a documentation/memory system as the authoritative project handover
  (2026-05-29): added `CONTEXT.md`, `AGENTS.md`, this `CHANGELOG.md`; rewrote
  `README.md` as a full-stack overview with a docs map and first-read order;
  expanded `CLAUDE.md` with first-read list, risky areas, and the Continuous
  Documentation Protocol.
- Added `/docs/architecture/` (overview, codebase-map, api-map, database,
  auth-rbac, integrations, deployment).
- Added `/docs/development/` (setup, environment-variables, agent-workflow,
  task-completion-checklist).
- Added `/docs/product/` (features, known-gaps, user-roles).
- Added `/docs/operations/` (deployment-runbook, security-checklist).
- Added `/docs/decisions/` (adr-index, ADR 0001: Documentation as Project Memory).
- Added `/docs/handover/` (current-state, next-steps, risk-register).
- Preserved prior reference docs (audits, eBay handoffs, product catalog) as-is.
