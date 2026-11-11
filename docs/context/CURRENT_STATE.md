# Current State

**2026-11-09 (Fashion catalog image-missing cleanup)** — Soft-deleted 5,490
Fashion catalog drafts whose `catalog_products.image_urls` arrays were empty.
All candidates were drafts in the single Fashion organization, without manual
review, an eBay item ID, or a Fashion eBay channel. Production verification
found zero remaining non-deleted Fashion rows with empty image arrays and
5,490 matching audit entries. No eBay mirror or marketplace listing was
changed. A protected row-level before-image and the SKU-match caveat are in the
[operation record](../operations/FASHION_CATALOG_IMAGE_CLEANUP_2026-11-09.md).

**2026-11-05 (PrimeMotive US reconciliation committed)** — The approved
production repair reconciled the 90,535 supplied US source listings against
the completed current eBay inventory report: 71,911 mirror updates, 18,624
inserts, and 5,222 matching inventory publication-link updates. Independent
post-commit checks report zero mismatches: 50,935 active, 37,940 out of stock,
1,660 ended, and 62,221 advertised available units. The host before-image
backup checksum and operation results are in the
[production record](../operations/PRIMEMOTIVE_US_RECONCILIATION_2026-11-05.md).
This is an advertised-listing reconciliation, not physical-stock initialization.
Stock mappings/counts, recurring sync completeness, and consumer credential
configuration remain follow-ups. No marketplace quantity pushes were enabled.
After historical credentials returned 401, the user approved a reader-password
reset, completed at 08:20 UTC with a protected server-side credential file and
audit event. At 08:22 UTC, authenticated checks for active/out-of-stock/ended
listings and the dedicated PrimeMotive feed all passed with HTTP 200. Roles and
permissions were preserved. This verifies the API reader path, not MotoArk
consumption or physical-stock processing.

**2026-11-03 (MotoArk lifecycle deployed and verified)** — The approved
backend-only rollout completed on image
`realtrackapp-backend:motoark-lifecycle-20261102-candidate`. Both migrations
`1791500000000-MotoarkOrderLifecycle` and
`1791600000000-PrimemotiveOrderedChanges` are applied. The prior backend image
is retained for rollback. A full pre-migration archive passed `pg_restore`
validation and its SHA-256 is recorded in the
[release record](../operations/MOTOARK_RELEASE_2026-11-02.md). Local/public
health returned 200; unauthenticated protected routes returned 401. Signed
synthetic lifecycle, duplicate/conflict, quantity, snapshot, change-feed, and
legacy-receipt checks passed without creating an order or changing stock.
The separate lifecycle key is configured; the legacy sale secret is preserved.
Marketplace stock pushing remains off. The 200-row active Primemotive sample
still has 0 mapped inventory items, so verified warehouse counts/mappings are
required and unmapped sales stay pending. No opening balances were written.

**2026-11-02 (MotoArk lifecycle implementation)** — Implemented signed,
scoped order lifecycle events, atomic deduplication, warehouse reservations and
partial stock operations, physical return inspection/disposal, independent
refund records, quantity/status lookup, committed change cursors, listing
revisions, and scoped ordered callbacks. Production read-only checks found the
legacy sales secret configured, outbound callback unset, stock push disabled,
and 0 mapped inventory items in a 200-row active Primemotive sample. The rollout
was approved that day and completed on 2026-11-03. See the
[implementation and release record](../architecture/MOTOARK_ORDER_LIFECYCLE.md).

**2026-11-02 runtime correction:** The active image
`realtrackapp-backend:ebay-revise-00aad7cd` has no Primemotive controller paths,
sale receiver, or change sender, even though its October migration and secret
survive. Earlier Primemotive deployment entries below are historical. The
2026-11-03 release restored them and preserved the production-only PartsSearch
module when registering MotoArk; a wholesale local app-module replacement
would have removed that search feature.

The user confirmed verified warehouse counts as the opening-stock source, with
unmapped sales kept pending. Source counts/mappings still need operational
verification before purchase events can consume warehouse stock.

**2026-10-21 (Catalog condition-filter crash fixed and deployed)** — Selecting
condition **New** could surface rows with `needs_review` status, which the old
frontend bundle did not map to an icon. The catalog then crashed while reading
`cfg.icon`. Production now runs
`realtrackapp-frontend:catalog-condition-icon-20261021-r1`, an overlay on
`realtrackapp-frontend:fashion-catalog-import-20261021-b95045cd`. The catalog
renders the review icon, provides a fallback for unknown statuses, and labels
`needs_review` as **Needs Review** in the inventory detail modal. The isolated
frontend build passed. The public homepage, `/auto-parts/catalog`, new JavaScript
and CSS assets, and `/api/health` returned HTTP 200; the served JavaScript
contains `needs_review`. Only the frontend container was recreated; backend,
PostgreSQL, Redis, and PgBouncer container IDs stayed unchanged. No listing data
changed. Rollback image:
`realtrackapp-frontend:rollback-catalog-condition-icon-20261021-r1`.

**2026-10-20 (Catalog bulk-publish workspace scoping deployed)** — Production frontend image is
`realtrackapp-frontend:publish-workspace-20261020-r3`, based on the retained
`realtrackapp-frontend:main-ae12191b` release and including the `Needs Review`
shield icon and fail-closed catalog status fallback. Bulk publish scopes its
store list, job creation, and target polling to the active workspace. The r2
poll request omitted `organizationId`, so the API looked up the durable job in
the user's primary workspace and returned `Job not found`. Only the frontend
container was recreated; backend, PostgreSQL, and Redis container IDs were
unchanged. The homepage and `/api/health` returned HTTP 200, and the served
bundle contains the workspace-scoped target poll. Rollback image:
`realtrackapp-frontend:rollback-publish-workspace-20261020-r2`. No listings were
retried or published during verification.

**2026-10-15 (Production catalog status icon crash fixed)** — Production frontend
image `realtrackapp-frontend:catalog-status-icon-20261015-r2` renders
`needs_review` with its review icon and treats unknown status values as
non-publishable review holds. The active frontend build at `ae12191b` did not
recognize a status already returned by the catalog backend. The first overlay
also copied asset directories without permissions nginx needed; r2 applies
read/execute access to static assets. Only the frontend container was recreated.
The public homepage, catalog, JavaScript, CSS, and API health checks returned
HTTP 200, and Chrome rendered the homepage. Backend and data-service containers
were unchanged; no listing data changed. The base image
`realtrackapp-frontend:main-ae12191b` is retained for rollback.

**2026-10-15 (Infiniti EX35 review repair; 51 records ready)** —
The screenshot's 65 visible listings in pipeline
`1d2f793b-6dea-4117-8f5c-9e9cc7e7c9c1` have canonical Infiniti/EX35 context and
synchronized titles. Exact-MPN catalog applications for 55 rows are saved as
223 exact-part candidates checked against `US_MVL_2026_07`. The owner confirmed
separate dismantled parts and that shared donor-assembly photos are the normal
workflow when the listed component is visible in context. Gallery reuse alone
does not block readiness; descriptions clarify that only the named part is
included. After identity, fitment, placement, and readiness checks, 51 are
Ready to Publish and 14 remain Needs Review for specific MPN/side/condition
conflicts or unverified exact-part applications. The two fender-panel listings
have nine side-matched photos and five verified model years each. No eBay offer
was published. The deleted zero-price row was untouched. See
[scoped repair record](../operations/INFINITI_EX35_REVIEW_2026-10-15.md) for
before-images, evidence, final blockers, and the updated 65-row operator report.
**2026-10-15 (Primemotive feedback release deployed)** — Production runs backend
image `realtrackapp-backend:primemotive-feedback-20261015-r5`; migration
`1791400000000-PrimemotiveListingChangeFeed` is applied. The `/primemotive` API
returns active published rows from the authenticated organization's Primemotive
store with a non-empty eBay item ID, without a Mercedes item-specific filter;
its reported total was 91,496 on deployment, including the 10 synthetic test
rows, and its page limit is 200. CSV export supports independent 10,000-row
pages. The durable change feed records added,
updated, ended, and deleted listings and supports incremental polling. Signed,
retrying outbound webhook delivery is deployed but remains idle until its
callback URL and secret are configured. Ten marked synthetic listings are
seeded for the Primemotive organization; the minute simulator is enabled and
changes one synthetic row's price or quantity without calling eBay. A verified
pre-migration database backup is at
`/home/ubuntu/backups/primemotive-feedback-pre179140-20261015.dump`; local and
public health checks passed. The production runtime details below describe the
2026-10-13 deployment.

**2026-10-13 (Production database I/O pressure relieved)** — A read-only `psql`
query assembling listing/catalog rows and checking publication state had been
active for about 8 hours 50 minutes, waiting on PostgreSQL `DataFileRead`. It
included a correlated lookup against the 5.1 GB `ebay_published_listings`
table. After authorization, `pg_cancel_backend` canceled that query; it made no
database writes. Host I/O pressure's 10-second average fell from about 52% to
about 2% within roughly 20 seconds. The local API health endpoint and frontend
root returned HTTP 200 in 5–11 ms and under 7 ms respectively, and all five
containers remained up. The psql query's originating report or script is
unknown; investigate it before rerunning a full-catalog read, and keep such
reads bounded or paginated.

**2026-10-13 (Production US/AU MVL refresh)** — Imported `US_MVL_2026_07.xlsx`
and `eBay-AU_Master_Vehicle_List_202609.xlsx` into production. The active US
release is `US_MVL_2026_07` with 383,701 entries from 383,706 source rows; five
rows without a valid year were skipped by the importer. The active AU release is
`AU_MVL_2026_09` with 93,683 entries from 93,683 source rows. Each marketplace
has exactly one active release; the former US and AU releases are superseded
with zero entry rows. The pre-import release metadata and entries are backed up
at `/home/ubuntu/mvl-backups/2026-10-13-before-us07-au09/` in
`realtrackapp_mvl_releases_20261013.csv` and
`realtrackapp_mvl_entries_20261013.csv`. No application deployment or schema
migration was part of this data refresh. Production backend and PostgreSQL
remained healthy after both imports.

**2026-10-13 (Primemotive API runtime and feed filters repaired)** — Production
runs `realtrackapp-backend:primemotive-api-fix-20261013`. The previous running
container had been recreated without the saved Primemotive Compose override,
which explained why the deployed Primemotive path returned 404 despite existing
in the release image. The current Compose launch includes that override and
serves the route under `/api/published-listings/primemotive`; omitting `/api`
continues to address the frontend. The endpoint reads the RealTrackApp database
mirror only and is now fixed to the authenticated organization's Primemotive
store, explicit Mercedes-Benz item specifics, a non-empty eBay item ID, and
database `listingStatus=active`. `updatedAfter` and `updateAfter` are accepted.

Migration `1791300000000-PrimemotiveExportPermissionGrant` ran. The existing
`api_published_listings_reader` role now has view, external-feed, sales-notify,
and CSV-export permissions. Backend health returned HTTP 200; unauthenticated
feed requests with either timestamp spelling returned HTTP 401. An authenticated
payload still needs verification with the dedicated integration login.

The production database contains 238 rows meeting the Primemotive/Mercedes,
published-item-ID, and active-state filters. The Primemotive account is active;
its latest completed scheduled sync was 2026-10-11 10:23 UTC (25,000 processed,
0 failed). Sync status now uses the latest completed sync log, and production
sets its staleness threshold to 192 hours to match the weekly full-refresh
cadence. For the Seller Hub report generated 2026-10-07, 64,257 of 87,955 US
item IDs match active RealTrackApp rows, and 238 match the feed's narrower scope.
Across the 21 eBay store records in the Primemotive organization, corrected
sync-status results are 8 `ok`, 11 `inactive`, 1 `stale`, and 1 `never_synced`;
the non-ok states map to disabled/reconnect-required accounts, the Oct 4 stale
Salvage refresh, and one store without a connected account.
The 2026-10-12 initial release record and pre-deploy database backup remain
below as historical context.

**2026-10-12 (initial Primemotive Mercedes-Benz feed image; runtime superseded)** —
The Primemotive image and saved Compose override were created. The first follow-up
found that a later backend recreation used only the base Compose files, so this
image was not the running container at that time. The original migration
`1791200000000-PrimemotiveExternalApiPermissions` had run and granted feed and
sale-event permissions. The compressed pre-deploy database backup is
`/home/ubuntu/backups/pre-primemotive-20261012T115136Z.dump`.

**2026-10-11 (Production health recovered; DynaTrade next import staged)** —
The backend's 512 MB heap health cutoff had again marked a responsive process
unhealthy at 657.85 MB heap, with about 740 MiB RSS in a 1.8 GB container and no
OOM/restart. A backend-only derived image,
`realtrackapp-backend:health-heap-1024-20261011`, changes the health controller
cutoff to 1 GB while preserving the running image's other code. At 07:57 UTC the
database and memory health indicators were up, public health/runtime/frontend
root returned HTTP 200, and all five containers were running with the backend
healthy. Runtime heap reset to 88.30 MB after replacement; recheck its trend
before large imports.

The v106 source sheet has 6,046 rows and 6,032 distinct SKUs. Listing
descriptions are present on all 6,046 rows, image URLs on 4,098, and vehicle
compatibility summaries on 1,170. It has 249 fully verified enrichment rows,
4,873 still awaiting research, 185 held rows, and two research holds. Production
accounts for 922 exact DynaTrade SKUs (921
pre-existing, plus one Batch 33 create; the Batch 33 update is in the existing
921). Of the 247 remaining verified rows, 37 match catalog products, leaving a
safe 210-SKU new-record CSV with 38,789 unique validated fitment continuation
rows at
`deliverables/DynaTrade_US_Not_Live_SKUs_net_new_210_catalog_import_2026-10-11_v2.csv`.
The cleaned file removes 4,026 duplicate compatibility lines from the prior
209-SKU export and adds FEBI-41038 with 98 active US MVL fitments. No records
from the file have been imported. The supported route requires an authenticated
RealTrack account with `catalog.import`; the open production tab remains at the
sign-in form, and SSH only provides host access. The first-600 internal statuses
remain 471 `ready` and 129 `published`; no new eBay offers were published.

**2026-10-11 (Production backend health restored; DynaTrade first 600 reconciled)** —
The 600-row first batch is present in production: 471 listings are `ready` and
129 are already `published`. All 600 have matching USD prices, source
quantities, `New` condition, image URLs, and descriptions; the Superior policy
resolves to the active $38.99 eBay policy for both U.S. marketplaces. One
fitment-source conflict remains for E5KFR2D12 and must be resolved before
claiming every row publish-ready. The backend previously returned HTTP 503 at
335 MB heap against a 300 MB check, despite using about 462 MB RSS of its 1.8 GB
container limit. It now runs `realtrackapp-backend:health-heap-512-20261011`;
direct and frontend-proxied health checks return 200. All five containers run;
backend, PostgreSQL, Redis, and PgBouncer report healthy. Image review labels 56 exact-MPN photos and 544
category-matched photos; it does not claim exact-MPN visual confirmation for
all 600. No eBay publish action was performed. See the production audit and
deployment records in `docs/operations/` and `docs/architecture/DEPLOYMENT.md`.
A corrected 600-row live manifest is available at
`deliverables/DynaTrade_US_Not_Live_SKUs_RealTrack_600_batch_1_reconciled_2026-10-11_v7.csv`;
it adds `Condition=New`, current live statuses, and explicit no-duplicate/no-eBay-
publish actions while preserving the one fitment-review hold.
The active public application host `app.omnicoreholding.com` and its health
route return HTTP 200. `mhn.realtrackapp.com` and `enxi.realtrackapp.com` instead
resolve to `208.91.197.132`, not this EC2 server, and fail externally; their DNS
records need correction at the DNS provider.
The live frontend bundle served by `app.omnicoreholding.com` contains the
draft-first Add Part flow (`Saving draft…`) and no longer contains the stuck
`Identifying part…` status from the supplied screenshot. Container and health
checks pass, but an authenticated Add Part save has not yet been exercised.

**2026-10-11 (DynaTrade batch 37 audited; CSV only)** — FEBI-26383 from source
row 3175 has stock 51, New condition, $38.00 sale price, and Superior $38.99
shipping. FEBI's official PartsFinder identity and rendered Used In Vehicles
table support the Sprinter 906 and Crafter I year ranges. All 46 eBay
compatibility records match the saved full active `US_MVL_2026_05` detail set.
The image is the official exact-article product photo. The independent audit
accepted all 46 fitments; no production write or eBay publish occurred. The
v104 master has 248 verified CSV products, 4,874 research-pending products, 185
held rows, and two research holds. A separate Bosch follow-up audit found the
next 15 candidates not publish-ready; see
`deliverables/DynaTrade_BOSCH_next15_evidence_2026-10-11.csv` and `.json`.
The next Bosch slice is in
`deliverables/DynaTrade_US_Not_Live_next15_evidence_2026-10-11_part2.csv` and
`.json`; it also returned 0 ready and 15 held because exact part-specific
fitment or visual photo evidence is missing. The v105 source master keeps all
6,046 supplier rows and all 6,032 distinct SKUs. It has descriptions for 6,046,
image URLs for 4,098, and compatibility summaries for 1,169. It records 248
verified CSV products, 735 prior-production rows, 4,874 pending rows, 185 held
rows, two research holds, and two legacy published rows. HENGST-E5KFR2D12 is
now explicitly held with zero accepted fitments; its stored Aston Martin rows
are unsupported, while the saved Mercedes candidates lack exact part-to-vehicle
proof. Production was not changed for this conflict.

**2026-10-11 (DynaTrade batch 36 audited; CSV only)** — FEBI-34608 from source
row 620 is staged with stock 1,224, New condition, $38.00 sale price, and Superior
$38.99 shipping. FEBI's official PartsFinder page confirms the exact ATF product,
1 L volume, and BMW reference 83 22 0 144 137 matching supplier OE 83220144137.
The current 1500-by-1500 official photo visibly shows the FEBI 34608 bottle and
passed the live image/hash audit. Of 1,186 saved eBay product-ePID/MVL rows, 822
for BMW, Hyundai, Jaguar, Land Rover, Audi, and Volkswagen are retained; 364 Kia
rows are excluded because FEBI's official make/reference evidence does not support
Kia. These individual YMM rows are from the saved eBay/MVL file, not FEBI's own
vehicle applications; the raw API response was not preserved, and a seller item
page reports a separate Ford/Lincoln/Mercury set. The independent audit passed;
no production write or eBay publish occurred. The v103 master has 247 CSV-verified
products and 51,595 compatibility rows, with 4,874 pending, 186 held, and 2
research holds. See `docs/operations/DYNATRADE_CSV_ENRICHMENT.md` for files and
evidence.

# Current State
**2026-10-10 (DynaTrade batch 35 audited; CSV only)** — Batch 35 adds
HENGST-E1722L from source row 4381 with stock 10, New condition, $49.99 sale
price, and Superior $38.99 shipping. Hengst's official catalog confirms the air
filter insert, OE reference, Porsche 911 (991) application range, and dimensions.
The actual-product eBay WEBP photo passed visual review and the live-byte/hash
audit. The 94 saved eBay ePID compatibility rows each matched active
`US_MVL_2026_05`; seller item pages show different listing-level totals, so no
extra page rows were inferred. Batch CSV and fitments are staged in v102; there
was no production write or eBay publish. See
`docs/operations/DYNATRADE_CSV_ENRICHMENT.md` for output and evidence paths.

**2026-10-10 (DynaTrade batch 34 audited; CSV only)** — Batch 34 adds
HENGST-H14W30, source row 5471, stock 61, to the 6,046-row source-preserving
master v101. Its live actual-product image, exact Hengst type/OE evidence, 760
eBay compatibility rows matched to active `US_MVL_2026_05`, AED/USD price, New
condition, and Superior policies passed the independent audit. The batch and
detailed fitments are staged in the deliverables directory; no production write
or eBay publish occurred. See
`docs/operations/DYNATRADE_CSV_ENRICHMENT.md` for outputs and evidence.

**2026-10-10 (DynaTrade batch 33 applied to RealTrack production)** — FEBI-33602
was created as a `ready` listing and the existing FEBI-43556 listing was updated
in place. Both now have source quantities, `Condition=New`, their pricing-rule
prices, the Superior $38.99 shipping policy, official FEBI product photos, and
MVL-validated fitments (3 and 32 detailed rows, respectively). The applied batch
and manifest are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_33_production_applied_2026-10-10.csv`
and `deliverables/DynaTrade_batch33_production_apply_2026-10-10.json`; the
source-preserving master is v100. Neither was published to eBay. Production
frontend and API health checks passed with all five containers running.

**2026-10-10 (Inventory photo gallery duplication fix deployed)** — Production
frontend now runs `realtrackapp-frontend:inventory-photo-dedupe-20261010` from
`/home/ubuntu/realtrackapp-inventory-photo-dedupe-20261010/frontend`, activated
by `/home/ubuntu/realtrackapp-inventory-photo-dedupe-20261010.override.yml`.
The redundant “Part pictures” strip is removed; the larger primary photo and
existing Product Images gallery/editor remain. Frontend and `/api/health`
returned HTTP 200 (`status: ok`); the bundle contains Product Images and omits
the duplicate strip. Backend remains
`realtrackapp-backend:ebay-quantity-cap-20261010` and healthy. Only the
frontend container was recreated; no listing or database data changed. The
previous frontend image `realtrackapp-frontend:inventory-photo-fix-20261010`
remains available for rollback by omitting the new override. See [deployment
details](../architecture/deployment.md#current-production-inventory-gallery-deduplication-fix-2026-10-10).

**2026-10-10 (Initial inventory part photo display fix; superseded)** — Production frontend
now runs `realtrackapp-frontend:inventory-photo-fix-20261010`, built from the
isolated source at
`/home/ubuntu/realtrackapp-inventory-photo-fix-20261010/frontend` and activated
with `/home/ubuntu/realtrackapp-inventory-photo-fix-20261010.override.yml`.
Inventory Details shows the primary part photo larger with `contain` and shows
additional saved photos in a thumbnail strip. The reported SKU had 18 saved
photos. The frontend root and `/api/health` returned HTTP 200, its served bundle
contains the gallery, and backend health remained `ok`. Only the frontend
container was recreated; no listing data or database was changed. The previous
`realtrackapp-frontend:add-part-save-timeout-20261010` image and Compose override
remain available for rollback. See [deployment details](../architecture/deployment.md#current-production-inventory-photo-display-fix-2026-10-10).

**2026-10-10 (DynaTrade quantity/condition reconciliation expanded)** — After the
user's production request, 921 existing listing records with exact normalized
brand/MPN matches to the workbook were reconciled: all show New, and all 919
unambiguous quantities match the workbook. Two existing FEBI 101942 listings
remain at their prior quantities because the workbook has two rows for that MPN
with different stock counts and no row-to-listing mapping. The related 925
catalog products show New and match all unambiguous quantities. This pass changed
829 listing records and 223 catalog products, recording listing revisions. It
updated RealTrack data only; 29 records with internal `published` status had
quantity changes, but no eBay offer update was sent. The source-row 4298 MPN/OE
mismatch was retained with quantity 6 and New condition. All five containers
were running, the frontend returned HTTP 200, and `/api/health` was `ok`. Batch
This quantity/condition reconciliation preceded the separate Batch 33
application recorded above; the existing FEBI 43556 listing was updated in
place and FEBI 33602 was added without publishing either to eBay.

**2026-10-10 (DynaTrade quantity and condition sync verified)** — The 609 existing,
non-deleted production `listing_records` matched to the supplier workbook now carry
the workbook quantity and New condition (`conditionId=1000`, label `New`). There
were 59 quantity corrections and one missing condition; corresponding quantities
were synchronized to 608 linked catalog projections (one projection was absent).
One supplier/app MPN mismatch was reconciled by source row, brand, and OE reference;
the application MPN was preserved. The production app health checks passed with all
five Compose containers running. This was an inventory/listing-record update only;
it did not create or publish eBay listings.

**2026-10-10 (DynaTrade CSV batch 33 audit; pre-application checkpoint)** — The
pre-application source-preserving master was
`deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v99.csv`. The current
master is v100, which overlays the later RealTrack application IDs and actions
while retaining all 6,046 supplier rows. The applied batch and manifest are
listed above. This checkpoint retains
all 6,046 supplier rows and records 244 verified CSV products, 189 held rows, two
research holds, and 4,874 pending rows; verified products have 49,919 detailed
fitments. Batch 33 adds FEBI-33602 and FEBI-43556 from source rows 603 and 2068,
with 35 eBay compatibility rows matched to active `US_MVL_2026_05` vehicles. The
current official FEBI product photos show the pulley and bolts, and stabilizer
link and nuts; live image hashes passed. The official articles confirm product
types and references, whose numeric bases match the source OEs. Detailed YMM rows
are eBay metadata, not manufacturer-published applications. `Condition=New` is
explicit on all 6,046 rows in v99 and both batch rows, based on the user's
instruction. The independent workbook, identity, image, fitment, pricing, and
policy audit passed before application. Both rows were later applied to
RealTrack; neither was published to eBay.

**2026-10-10 (DynaTrade CSV batch 32 audited; not imported)** — The prior
source-preserving master at that checkpoint was
`deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v98.csv`. It retains
all 6,046 supplier rows and records 242 newly verified CSV products, 191 held
rows, two research-hold rows, and 4,874 pending rows; verified products have
49,884 detailed fitments. Batch 32 adds FEBI-06161 and FEBI-32600 from source
rows 835 and 874. Both official full-size bottle photos were visually checked;
the 116 detailed BMW eBay compatibility rows match active U.S. MVL records and
the source OE references match FEBI's BMW comparisons. The 32600 rows are limited
to BMW 323i/328i named in the matched eBay title. These are eBay compatibility
rows, not FEBI-published YMM applications; verify fluid approval by VIN and
vehicle documentation. The independent source, image, fitment, price, and policy
audit passed. No CSV batch was imported or published.

**2026-10-10 (DynaTrade CSV batch 31 audited; not imported)** — The prior
source-preserving master at that checkpoint was
`deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v97.csv`. It retained
all 6,046 supplier rows and recorded 240 newly verified CSV products, 193 held
rows, two research-hold rows, and 4,874 pending rows; verified products had
49,768 detailed fitments. Batch 31 adds FEBI-22806 with an official, visually
checked 1500-by-1500 product photo and 93 Mercedes-Benz eBay compatibility rows
matched to active U.S. MVL vehicles. The other 1,429 compatibility rows were
excluded. FEBI confirms the exact product/OE reference and recommended MB fluid
specifications, but does not publish those individual YMM rows; verify the
transmission's required fluid approval by VIN before sale/use. The independent
CSV audit passed source values, image hash, fitments, pricing, and Superior policy
checks. No CSV batch was imported or published.

**2026-10-10 (Add Part draft-first fix deployed)** — Production runs frontend
and backend image tag `add-part-save-timeout-20261010`. The app root and backend
health endpoint returned HTTP 200 with database/memory up, and all five
containers were running. The browser displayed the sign-in page; a signed-in
Add Part submission was not performed. The rollout did not import or modify
listing rows. See [deployment details](../architecture/DEPLOYMENT.md#current-production-add-part-draft-first-fix-2026-10-10).

**Historical snapshot — DynaTrade CSV batch 28 (superseded by v97; not imported)** — The
source-preserving master at that checkpoint was `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v94.csv`.
It retained all 6,046 supplier rows and had 237 newly verified CSV products, 196
held rows, two research-hold rows, and 4,874 pending rows; the 237 verified
products carried 49,637 detailed fitments. Batch 28 adds BOSCH-3397005046 with a
visually checked 900-by-900 actual-product photo and 12 exact active-MVL variants
limited to Bosch's 1998–1999 Mercedes-Benz S320/S420/S500/S600 applications.
The independent audit passed the original workbook, image hash, fitments, AED/USD
pricing, and Superior policies. The row is CSV-ready for later import; no
production listing was written. The full workbook remains unfinished.

**Historical snapshot — DynaTrade batch 24 (superseded by v94; not imported)** — The
source-preserving master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v90.csv`.
It retains all 6,046 workbook rows and records 232 newly verified CSV products,
196 held rows, and 4,881 research-pending rows. Batch 24 adds FEBI 172879, 179289,
and 178884 with 3,677 exact Jaguar, Land Rover, Cadillac, and Chevrolet fitments.
Fresh official PartsFinder pages confirm exact article types and supplier OE
references. The three official 1500-by-1500 photos visibly show the actual parts
and passed the live image hash audit. All detailed eBay fitments match active
`US_MVL_2026_05`. The independent audit passed all source rows, identity, fitments,
AED/USD pricing, and Superior policies. The master has 49,358 detailed fitments.
No production write occurred; the whole workbook remains unfinished.

**2026-10-10 (DynaTrade CSV batch 23 audited; superseded by batch 24; not imported)** — The prior
source-preserving master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v89.csv`.
It retains all 6,046 workbook rows and records 229 newly verified CSV products,
199 held rows, and 4,881 research-pending rows. Batch 23 adds FEBI 104873, 174408,
16343, 173581, and 46653 with 918 exact Jaguar, Land Rover, BMW, Audi, and Peugeot
fitments. The official images passed visual review and live hash checks. The v89
master had 45,681 detailed fitments. No production write occurred.

**2026-10-10 (DynaTrade CSV batch 22 audited; superseded by batch 23; not imported)** — The prior
source-preserving master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v88.csv`.
It retains all 6,046 workbook rows and records 224 newly verified CSV products,
204 held rows, and 4,881 research-pending rows. Batch 22 adds FEBI 174477, 34854,
172394, 192796, and 108638 with 252 exact Porsche, Land Rover, and Jaguar fitments.
The v88 master had 44,763 detailed fitments. No production write occurred.

**2026-10-10 (DynaTrade CSV batch 21 audited; superseded by batch 22; not imported)** — The prior
source-preserving master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v87.csv`.
It retains all 6,046 workbook rows and records 219 newly verified CSV products,
209 held rows, and 4,881 research-pending rows. Batch 21 adds FEBI 34293, 177109,
47368, 108577, and 107274 with 185 detailed fitments across Land Rover, Volvo,
Porsche, and Jaguar. Its five official photos passed visual review and live hash
checks after their URLs were corrected to the full-size gallery. The v87 master
had 44,511 detailed fitments. No production write occurred.

**2026-10-10 (DynaTrade CSV batch 20 audited; superseded by batch 21; not imported)** — The prior
source-preserving master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v86.csv`.
It retains all 6,046 workbook rows and records 214 newly verified CSV products,
214 held rows, and 4,881 research-pending rows. Batch 20 adds FEBI 34384, 39737,
24493, 31822, and 185706 with 123 exact fitments across Land Rover, Dodge, and
Mercedes-Benz. The master had 44,326 detailed fitments. No production write occurred.

**2026-10-10 (DynaTrade CSV batch 19 audited; superseded by batch 20)** — The latest
source-preserving master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v85.csv`.
It retains all 6,046 workbook rows and records 209 newly verified CSV products,
219 held rows, and 4,881 research-pending rows. Batch 19 adds FEBI 108213,
108214, 170680, 24771, and 29800 with 117 fitments across Porsche, Mercedes-Benz,
and Kia. Official PartsFinder pages verify each FEBI article and exact OE
comparison reference. All five actual-part photos are current official
1500-by-1500 JPEGs; each was re-fetched, visually reviewed, and matched by the
independent live image-hash audit. The exact eBay detail rows match active
`US_MVL_2026_05`; all 6,046 source rows, pricing, and Superior policies passed.
The master contains 44,203 detailed fitments. No production write occurred; the
whole workbook remains unfinished.

**2026-10-10 (DynaTrade CSV batch 18 audited; superseded by batch 19)** — The latest
source-preserving master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v84.csv`.
It retains all 6,046 workbook rows and records 204 newly verified CSV products,
224 held rows, and 4,881 research-pending rows. Batch 18 adds FEBI 10266, a
thermostat with sealing ring whose official PartsFinder article confirms
Mercedes-Benz comparison OE 616 200 04 15. Its current official 1500-by-1500
gallery image shows the actual thermostat and seal; the changed bytes were
re-fetched, visually reviewed, and matched during the independent live audit.
All 21 Mercedes-Benz fitments match active `US_MVL_2026_05`. The converted cost
is $6.47, sale price is $38.00, and Superior shipping is $38.99. The full audit
passed source preservation, identity, fitments, image, price, and policies. The
master contains 44,086 detailed fitments. No production write occurred; the
whole workbook remains unfinished.

**2026-10-10 (DynaTrade CSV batch 17 audited; superseded by batch 18)** — The latest
source-preserving master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v83.csv`.
It retains all 6,046 workbook rows and records 203 newly verified CSV products,
225 held rows, and 4,881 research-pending rows. Batch 17 adds BOSCH 0280218002,
a mass air flow sensor with official OE 06A906461A. Its exact converted cost is
$49.05 USD and the >$25 pricing rule sets the sale price to $98.10, with the
agreed $38.99 Superior shipping policy. Its 70 detailed fitments comprise 60
Volkswagen rows from saved eBay/MVL compatibility results and 10 Seat Toledo rows
from Bosch's official 2001–2004 application lookup joined to exact active
`US_MVL_2026_05` records. The official 1400-by-1400 product image shows the
physical sensor; its JPEG signature and SHA-256 matched during the independent
live audit. All source values, identity, fitments, price, policies, and CSV
hashes passed. The master now contains 44,065 detailed fitments. No production
write occurred; the whole workbook remains unfinished.

**2026-10-10 (DynaTrade CSV batch 16 audited; superseded by batch 17)** — This
source-preserving master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v82.csv`.
It retains all 6,046 workbook rows and records 202 newly verified CSV products,
226 held rows, and 4,881 research-pending rows. Batch 16 adds BOSCH 0280218175,
a mass air flow sensor with Bosch OE number 03H906461. Bosch's official U.S.
application lookup agrees with all 90 detailed Audi and Volkswagen fitment rows
matched to active `US_MVL_2026_05`. The selected live 1500-by-1500 eBay image
shows the actual sensor with its Bosch MPN stamped on the body; its content hash
matched during the independent audit. The audit passed all 6,046 source rows,
pricing/policies, ePID/title, exact fitments, photo bytes, and no-overlap checks.
The master now contains 43,995 fitment details. No production import, listing
writes, or email occurred.

**2026-10-10 (DynaTrade CSV batch 15 audited; not imported)** — The source-preserving
master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v81.csv`.
It retains all 6,046 workbook rows and records 201 newly verified CSV products,
227 held rows, and 4,881 research-pending rows. Batch 15 adds BOSCH 0281002956,
an air mass flow sensor with Bosch OE number 03L906461A. Bosch's official U.S.
application lookup agrees with all 69 detailed Audi and Volkswagen fitment rows
matched to active `US_MVL_2026_05`. The selected live 1000-by-946 eBay image was
visually confirmed as an actual Bosch-marked MAF sensor, and its content hash
matched during the independent audit. The audit passed all 6,046 source rows,
pricing/policies, ePID/title, exact fitments, photo bytes, and no-overlap checks.
The master now contains 43,905 fitment details. No production import, listing
writes, or email occurred.

**2026-10-10 (DynaTrade CSV batch 14 audited; not imported)** — The source-preserving
master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v80.csv`.
It retains all 6,046 workbook rows and records 200 newly verified CSV products,
228 held rows, and 4,881 research-pending rows. Batch 14 adds BOSCH 0392020073,
an auxiliary electric water pump, with OE references 3D0965561D and 95510656101.
The selected live 1500-by-1500 eBay image was visually confirmed as the actual
pump, and its content hash matched during the independent audit. Bosch's official
U.S. application lookup agrees with all 341 detailed Audi, Porsche, and
Volkswagen fitment rows matched to active `US_MVL_2026_05`. The audit passed all
6,046 source rows, pricing/policies, ePID/title, exact fitments, photo bytes, and
no-overlap checks. The master now contains 43,836 fitment details. No production
import, listing writes, or email occurred.

**2026-10-10 (DynaTrade CSV batch 13 audited; not imported)** — The source-preserving
master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v79.csv`.
It retains all 6,046 workbook rows and records 199 newly verified CSV products,
229 held rows, and 4,881 research-pending rows. Batch 13 adds HENGST E1000L with
156 Volvo fitment details matched to active `US_MVL_2026_05`. The official HENGST
catalog confirms the air-filter insert, dimensions, EAN, and Volvo OE references.
Its 1500-by-1500 exact-MPN retailer image shows the physical filter and its
E1000L-labeled packaging; the audit re-fetched the image and verified the approved
hash. The original eBay gallery image was 640 by 480 and did not meet the reviewed
batch's two-dimension minimum; the replacement is tied to the prior URL in the
review evidence. The independent audit passed all 6,046 source rows, source and
export hashes, pricing/policies, ePID/title, exact fitments, and no-overlap checks.
Batch 13 adds 156 detail rows to the previous 43,339, for 43,495 total. HENGST
E1722L remains held because no sufficiently large exact product photo passed
review. The eBay Browse API returned HTTP 429, so saved Sell Metadata API
fitments were reused. No production import, listing writes, or email occurred.

**2026-10-10 (DynaTrade CSV batch 12 audited; not imported)** — The source-preserving
master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v78.csv`.
It retains all 6,046 workbook rows and records 198 newly verified CSV products,
230 held rows, and 4,881 research-pending rows. Batch 12 adds 37 FEBI products and
6,807 detailed U.S. fitment rows. The independent audit passed the source workbook,
CSV/export plan, price and policy rules, official article/OE identity, saved eBay
identity, exact MVL detail rows, no-overlap check, and a live re-fetch/hash check
for all 37 visually reviewed official photos. The compact compatibility summary
is rebuilt from exact fitment years and preserves gaps. The eBay Browse request
returned HTTP 429; saved Sell Metadata API fitments were reused. No production
import or listing write occurred. The whole source workbook remains unfinished.

**2026-10-10 (production DynaTrade read-only fitment and health audit)** — All 600
batch-one SKUs exist in `catalog_products`. The production publisher's selected
compatibility source matches the canonical MVL detail file exactly for 598/600
products (85,094 vehicle rows). E989LC01-2 has 10 extra Mercedes rows in its
selected normalized source; E5KFR2 D12 has four Aston Martin rows instead of the
four reviewed Mercedes rows. Their raw catalog fitment arrays match the CSV, but
the publisher selects the mismatched normalized rows. No production data was
changed. The batch is not fully publish-ready pending supported repairs and policy
readback. Public frontend and `/api/health` return HTTP 200; all five containers
run and backend, PostgreSQL, Redis, and PgBouncer report healthy. Auto Parts
redirects to login, so the signed-in Add Part flow has not been exercised.

The follow-up photo audit found all 117 prior official URLs live. Thirteen still
served their approved bytes; the other 104 were refreshed and visually re-reviewed.
Batch 12's 37 photos were also visually reviewed from raw live bytes. The current
photo checkpoint contains 154 exact-hash approvals, and the batch planner gates on
the live image hash.

**2026-10-10 (DynaTrade CSV batch 11 audited; superseded by batch 12)** — The source-preserving
master is `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v77.csv`.
It retains all 6,046 workbook rows and records 161 newly verified CSV products,
267 held rows, and 4,881 pending rows. Batch 11 adds 17 HENGST products and 4,210
detailed compatibility rows. The independent audit passed image URL/hash, official
identity/reference, eBay identity, source workbook, price/policy, and detailed
fitment checks. Three Volkswagen rows for H326WK remain excluded because reviewed
official application evidence supports Audi only. The batch remains in CSV; no
production import or listing writes occurred. Application readiness remains
unverified.

**2026-10-10 (DynaTrade CSV batch 10 audited; superseded by batch 11)** — The
v76 master retained all 6,046 workbook rows and recorded 144 newly verified CSV
products, 284 held rows, and 4,881 pending rows. Batch 10 added FEBI 11816 and
FEBI 22251 with visually reviewed official images, exact manufacturer references,
and 1,010 detailed compatibility rows. For FEBI 22251, 986 Ford, Jaguar, Land
Rover, and Mazda fitments were retained; 51 Mercury and two Lincoln rows remained
excluded as unsupported by official evidence. No production import or listing
writes occurred.

**2026-10-10 (Add Part production health recheck; authenticated save still unverified)** — A
read-only SSH inspection found the backend running
`realtrackapp-backend:catalog-readiness-20261010` and the frontend running
`realtrackapp-frontend:add-part-photo-identity-217d09e3`. PostgreSQL, Redis,
PgBouncer and the backend report healthy; the frontend container is running and
serves HTTP 200. `/api/health` returns HTTP 200 with database and memory status
up. The deployed backend bundle contains the two-photo Add Part guard and the
inconclusive-lookup error path from the photo-identity fix. No signed-in Add Part
save was exercised, and no production listing rows were changed.

**2026-10-10 (DynaTrade CSV batch 9 audited; superseded by batch 10)** — The
previous source-preserving master was
`deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v75.csv`. It retained
all 6,046 workbook rows and recorded 142 newly verified CSV products, 286 held
rows, and 4,881 pending rows. Batch 9 adds FEBI 47894 with a re-reviewed
official 1500-by-1500 image and 154 BMW fitment rows. Four Lexus rows are excluded
because the official FEBI article supports BMW only. Batch 9 passed independent
workbook, pricing/policy, live photo URL/hash, and detailed fitment audits. Batches
7 and 8 also passed their audits. No production import or listing writes occurred;
these CSVs have not passed application readiness checks.

**2026-10-09 (Add Part photo-identity change — production flow not functionally verified)** — A
read-only production review of the reported Add Part case found that the
listing title had been manually corrected to a windshield wiper linkage, while
its part-type field still said “Front Left Door Control Module.” The workspace
fix now delays identification until at least two photos are saved, rejects an
inconclusive photo lookup instead of substituting a seller match by part
number, and prevents later enrichment from overwriting photo-derived identity.
Uploading new photos can restart a completed enrichment run. A read-only
production recheck found the backend and frontend images tagged
`add-part-photo-identity-557a9206` and `add-part-photo-identity-217d09e3`;
all five containers were running and the public health checks returned HTTP 200.
The browser session was unauthenticated at `/auto-parts/login`, so an Add Part
save was not exercised. No production listing writes were made during this
recheck; image tags and service health do not confirm the authenticated flow.

**2026-10-08 (complete OEM range search — deployed; v11 job active)** — Production
backend runs `realtrackapp-backend:title-fitment-20261008-v8` with listing
optimization version 11. GPT-6 Luna searches cited OEM catalogs through the
Exa web-search engine. The lookup compares exact-MPN catalog queries for the
complete contiguous application range; validation checks exact MPN, make,
target model/trim, cited year endpoints, and the target marketplace MVL. Model
and trim are normalized to the target MVL without dropping variant tokens.
Catalog evidence remains review-only; no compatibility or listings are
published during optimization. Backend and public health checks returned
`status: ok`; only the backend was recreated.

Pipeline `7239edb3-770b-4b18-a60f-288b5bdeba8c` contains 145 US products. The
initial v9 pass blocked 143 for missing supported year ranges and had 2 in
review. Forced v10 job `manual-oem-catalog-refresh-7239edb3-20261008-v10`
completed, but only 23 titles had a full year range. Forced v11 job
`manual-oem-catalog-refresh-7239edb3-20261008-v11` is active for all 145 products
with publishing disabled. Record its final title, fitment, and publish-state
counts after the worker completes.

**Superseded 2026-10-08 (part-specific title-year guard)** — An earlier
production state ran `realtrackapp-backend:title-fitment-20261008-v2` with
optimization version 7. It accepted only contiguous target-MVL-checked exact-
part years and prevented donor year or platform generation from supplying
fitment. That deployment did not re-optimize this pipeline job; see the v10
deployment state above for the completed rerun.

**2026-10-06 (Auto Parts catalog navigation — deployed)** — Production
`Shell.tsx` had stored the Catalog nav path as `/auto-parts/catalog` even though
the shell adds `/auto-parts`, so clicking it reached
`/auto-parts/auto-parts/catalog` and the Auto Parts catch-all. The corrected
frontend image `realtrackapp-frontend:catalog-route-fix-20261006` was built from
`/home/ubuntu/realtrackapp-main-release-20261005`; the production Compose
override now points the frontend build context there. The old frontend image
`realtrackapp-frontend:stock-20261005` and override backup
`/home/ubuntu/backups/realtrackapp-stock.override.yml.pre-catalog-route-fix-20261006`
are retained. Only the frontend was recreated. `/auto-parts/catalog` returned
HTTP 200 after deployment; backend, Postgres, Redis, and PgBouncer are healthy.

**2026-10-06 (OEM catalog title follow-up on recent pipeline uploads)** — The
isolated backend release `realtrackapp-backend:title-range-20261006` is healthy;
rollback image `realtrackapp-backend:pre-title-range-20261006` is retained. For
UPL-2026-000235 (`30 sep.xlsx`), exact OEM catalog lookups for five screenshot
MPNs passed the active US MVL and now prefix five draft titles with supported
applications: `BU1-15777` 2011 Infiniti FX35; `BU1-15789` 2014-2016 Toyota
Corolla; `BU1-15794` 2010-2015 Audi A4; `BU1-15765` 2007-2009 Audi Q7; and
`BU1-15746` 2015 Audi A8 Quattro. Their rows remain title-only
`needs_review` evidence, `fitment_data` is empty, and all five products are
marked for review. Four other screenshot MPNs remain blocked for lack of a
strong exact US application.

The optimizer initially widened three applications using generic platform or
MVL sibling rows. Those rows and their compatibility data were removed, and
the titles were reset to the exact OEM ranges. Do not force-retry these five
until title selection is constrained to exact part-number evidence. No eBay
listing or compatibility publish was invoked. Five UPL-235 records are now in
review; 48 still report `TITLE_YEAR_RANGE_MISSING`. UPL-2026-000234 still has
one review-only `2011 BMW 328I` title and 72 records blocked. One pre-existing
UPL-234 eBay listing (`BU1-15375`, item `307197235705`) remains unchanged.
Across those catalog records, 120 remain blocked and six are in review.
UPL-2026-000236 (`1 oct.xlsx`) remains unchanged with year-prefixed titles on
all 84 persisted records. Older workbooks without vehicle columns remain
ineligible for inferred fitment ranges.

**2026-10-06 (Bentley source alias and title-range repair)** — Make
normalization and donor filename parsing canonicalize the known source typo
`Bently` to `Bentley`. The generation-span title fallback described in this
historical repair was superseded on 2026-10-08; donor identity no longer
establishes a part's title years. Production backend image
`realtrackapp-backend:main-20261006-bently-alias-00206b9a` is healthy. Job
`b69699a1-445a-41da-9e58-02a9b9e8becd` had a 2008 Bentley Flying Spur donor;
162 catalog/listing titles and 170 CSV title cells now use the 2005–2013 model
generation range. The longest title is 80 characters. All 162 listings remain
drafts in review because validated publish compatibility is still absent; no
eBay item or fitment approval was changed. The original CSV is preserved as
`/app/output/pipeline-b69699a1/US-Motors-Listings-2026-10-05.csv.pre-year-range-20261006`.

**2026-10-05 (pipeline model-generation title ranges)** — Pipeline titles prefer
**Superseded 2026-10-08:** the donor-generation fallback in this historical
entry is no longer current behavior; see the 2026-10-08 title-fitment guard
above.
contiguous fitment year spans. When those are unavailable, a known donor
year/make/model can supply its full shared model-generation span to the title.
This is title context only: it does not add, widen, or approve compatibility
rows. Upload names may omit the model; optimization can use a model-prefixed
source title or a single unambiguous model already present in that pipeline
job. Optimization version 4 reprocesses older results on the next pass.
The current draft repair updated 103 Audi A6 titles for pipeline
`7edda15f-804f-4dbd-ba44-98d901b16a3c` to `2011-2018` and 73 Jaguar XF titles
for pipeline `f2696bdc-cbe9-4189-ad42-6029fd3fef86` to `2008-2015`, including
matching listing records and CSV exports. Both jobs remain draft-only; no eBay
items were published and fitment approvals were not changed. The production
backend deployment `realtrackapp-backend:main-20261005-year-range-00206b9a` is
healthy; `/api/health` reported the database and memory checks up.

**2026-10-03 (pipeline title year evidence guard)** — Title optimization now
canonicalizes the source spelling Infinity to Infiniti when parsing a matching
YYYY MAKE MODEL plus 17-character VIN filename. Donor year supplies vehicle
context only; title ranges require contiguous, part-number-matched fitment
years that pass MVL checks. Exact-MPN lookup uses the canonical donor make when
the catalog brand also includes a model. Missing or mismatched title ranges
block optimization, and version 3 marks older product results stale when they
enter optimization again. Production job
35833336-07b2-42b3-8661-083390b55e12 was found with 62 products whose donor
filename was present but donor fields and fitment rows were empty. The job
needs fresh per-part fitment discovery; if lookup cannot establish a supported
range, those products remain blocked for review.

**2026-10-02 (fitment year-range title fallback and OEM lookup correction)** —
Pipeline optimization now passes a valid `YYYY MAKE MODEL` + 17-character VIN
upload name into fitment discovery when product donor fields are blank.
Fitment-derived year ranges remain authoritative in the deterministic title
builder, which continues when the AI listing batch fails. Production draft
repair: job `997b1606-5d65-4e03-af32-7bc18c2c43cd` has 49 matching
catalog/listing/export titles with the complete 2010–2015 fitment range. Job
`7ac4ffa6-bda7-4152-b2f5-df81e5f33a66` reused the same 2014 Kia Sportage source
workbook; its 18 products have saved 2010–2015 platform fitment rows and
matching titles. Job `cde847fd-f3e1-46fc-8052-cf0386a5ea58` now has 41
matching catalog/listing/export titles with model ranges looked up by exact OEM
part number. Its 191 year-level fitment rows are all marked `needs_review` and
`manual_review=true` pending VIN/trim/PR-code and eBay Motors Vehicle Lookup
validation; they are not publishable compatibility. Each affected US export
has a dated pre-change backup. All 108 listing records remain drafts, with no
live eBay listings changed. The title-generation code fix was deployed earlier;
this last correction was a data-only update.

The permanent optimizer fallback now queries eBay Browse by exact normalized
Brand+MPN when no bounded year range is already available. Complete seller
Year/Make/Model hints are checked against the target marketplace MVL. MVL-valid
years may supply a contiguous, bounded draft-title range, while the underlying
rows remain `needs_review` in `fitment_rows`; they never become publishable
`fitment_data` or compatibility. These listing hints are leads rather than an
OEM application catalog, so part-specific confirmation remains required.
Optimization version 2 also prevents an older completed result from being
treated as current when the product next enters the optimizer.

**2026-10-05 (warehouse stock — deployed)** — Production now runs images `realtrackapp-backend|frontend:stock-20261005`, built from `~/realtrackapp-stock-release` (a copy of `~/realtrackapp-napa-release` plus the stock changes). Migration `1791100000000` was applied. A pre-deploy dump is at `~/backups/stock-20261005/`. The `admin` and `super_admin` roles (both customised, so skipped by the registry sync) were granted the `stock.*` permissions by hand. Stock setup ran for all 12 workspaces:
- Super Admin: 737 SKUs, 1,032 units, 21 stores linked.
- B&I: 407 SKUs, 407 units.
- Fashion: 3 stores linked.
- 9 empty personal workspaces: a default warehouse only.

Not adopted: about 38.3k Auto Parts catalog products and 36.5k listings with no `organization_id`. `stock_channel_push` is off.

**2026-10-05 (warehouse stock — implementation)** — `StockModule` (`/api/stock`) and the Stock workspace were added for all three verticals. They provide warehouses/bins, a SKU master, an append-only ledger, documents, order reservations, procurement of stock that is not on hand (POs with receive-to-order, dropship), and channel quantity sync. Channel sync runs in shadow mode by default. Order import now reserves stock, and shipping and cancelling update it; before this, sales never deducted stock. Migration `1791100000000` is additive. Each workspace must run **Stock → Set up** after deploy. Verified locally: 17 PostgreSQL integration tests; a full 67-migration replay from an empty DB; an end-to-end API run and UI walkthrough against an isolated backend. Not exercised: live eBay/PartsBazar360 pushes (push stays off), production data backfill. See `docs/architecture/WAREHOUSE_INVENTORY.md`.

**2026-10-01 (editable eBay custom labels)** — New fixed-price listings created
through the Trading API retain the seller SKU as eBay's Custom Label but track
the listing by item ID, allowing the label to be revised in Seller Hub. Existing
active listings created with ManageBySKU cannot switch tracking methods in
place; changing those labels requires a relist.

**2026-09-30 (NAPA listing images)** — Catalog detail views combine
catalog-product and listing-record image URLs, deduplicating the result. NAPA
CDN images use a fixed-host, same-origin
proxy with an nginx cache so thumbnail rendering does not depend on browser
access to the external CDN. See `CHANGELOG.md` and
`docs/architecture/ARCHITECTURE.md`.

**2026-09-29 (eBay primary-category publish guard)** — eBay Motors publishing now uses the existing safe Motors leaf category when category resolution yields a missing or malformed ID, and persists the repair. The Trading API rejects blank or malformed category IDs locally before making an eBay request. See `backend/src/channels/ebay/ebay-publish.service.ts` and `ebay-trading-api.service.ts`.

**2026-09-26 (pipeline donor-year titles)** — Pipeline optimization now uses
stored donor year/make/model fields. When those are absent, it can use a
source filename formatted as YYYY MAKE MODEL plus a 17-character VIN when the
make matches the product brand. Validated fitment years retain priority.
Production pipeline job c35a49cb-742d-4dc1-9ba5-f955bdd301b7 had 93 draft
titles corrected to match its US export and include the source-labeled 2015 Audi A8L donor vehicle; 23 listing/export title mismatches were resolved;
listing and catalog title copies now match, and no published eBay rows were
changed.


**2026-09-15 (B&I catalog published status)** — `/business-industrial/catalog`
was leaving live eBay items as Unpublished. `bniadmin@realtrack.local` has
`store_access_all = false` and no `user_store_assignments`, so catalog
publication SQL compiled `AND 1 = 0` and dropped every live channel. Publish
also never stamped `catalog_products.ebay_item_id`, and `ebay_published_listings`
had no B&I SKU rows. Catalog search now keeps live channel/`ebay_item_id`/
`listing_records` status even when the caller has an empty store list. Run
`scripts/backfill-catalog-publication-status.sql` to stamp existing live rows.

**2026-09-15 (eBay 25002 core-fitment retry)** — FEBEST publishes to Superior
Auto Parts failed with Inventory error 25002 (`All compatibilities are invalid`)
after the compatibility PUT succeeded. Source rows carried European-catalog
Trim/Engine values and a `Submodel` property that US Motors does not accept.
The documented publish retry was a no-op (same payload). `EbayPublishService`
now retries once with unique Make/Model/Year, and
`fitmentDataToCompatibilityPayload` no longer sends `Submodel`.

**2026-09-14 (B&I taxonomy hardening)** — Business & Industrial image intake
tries the AI-provided category search first, then deliberate combinations of
manufacturer, model, part type, category-family label, and source part name.
The live eBay taxonomy remains authoritative: a category is accepted only after
leaf verification and item-aspect retrieval. This improves B&I coverage without
inventing category IDs or weakening publish validation.

**2026-09-28 (Fashion quick capture)** — `/fashion/capture` and `/fashion/intake` added:
required photo slots, batch SKU generator, warehouses, garment measurement charts with a
branded size-chart image, photo banners and background identification (BullMQ
`fashion-intake-analysis`). Migration `1791000000000-CreateFashionIntake`; backend image now
installs `fonts-dejavu-core`. Measurements no longer become eBay item specifics. Live background identification verified
with OpenAI; S3 storage not verified because the local AWS key is rejected by AWS (see
KNOWN_ISSUES).
Not deployed. See `docs/architecture/FASHION_QUICK_CAPTURE.md`.

**2026-09-14 (Fashion photos-first Add Item)** — Fashion Add Item collects a
complete garment photo set before optional identification, reuses existing
storage and OpenAI vision, keeps photos when analysis fails, and persists
category-aware Fashion attributes on `vertical_attributes`. Confirmed user
edits and `_` identification metadata survive save/reopen. No schema
migration was added. Marketplace publish still requires authenticity approval
and the `multi_vertical_catalog` flag; this session does not deploy or publish
live listings. Local verification: focused Jest suites passed; frontend
`tsc -b` and `vite build` passed. Authenticated Add Item, live vision, camera
capture, and save/reopen against a running API were not exercised because
Docker, PostgreSQL, Redis, and the Nest process were unavailable on this
machine. `npx nest build` currently fails on pre-existing ingestion files
(`pipeline.service.ts` marketplace TDZ and `pipeline.processor.ts` conflict
markers), not on the Fashion vertical sources.

**2026-09-13 (light theme default)** — Branding defaults to `themeMode: light`.
The document starts with `data-theme="light"` and a light `theme-color`. Fashion
login and the shared change-password page (B&I / Auto Parts / Fashion) use a
light canvas instead of hardcoded slate-950. Client Settings can still select
dark or system. Migration `1790900000000` flips stored `dark` rows to `light`.

**2026-09-13 (B&I mobile / cross-platform)** — Phone and tablet layouts for the
B&I shell, login, catalog, editor, and remaining workflows use dynamic viewport
height, `viewport-fit=cover`, 16px form controls, and contained scrolling.
Catalog result cards show below the `lg` breakpoint; the table remains on
desktop with its own horizontal scroll.

**2026-09-13 (B&I layout alignment)** — Business & Industrial uses the Auto
Parts sidebar/drawer shell proportions and catalog presentation patterns while
retaining CatalogWorkspace, B&I catalog configuration, and existing domain
rules. Overview Create listing now opens the technical editor. Shared catalog
changes (mobile filter drawer, empty vs no-match, mixed selection, publish
phases, pending bulk/export feedback) are inherited by Fashion. Frontend `tsc -b`
and `vite build` passed. Mocked `scripts/test-business-industrial-catalog-ui.mjs`
passed against `http://127.0.0.1:3923` (catalog labels, 360px filter drawer,
quick view, publish submitted→published, close-does-not-cancel copy). That
script intercepts `/api/**` and is not live backend evidence. Authenticated
shell/editor/import/review/stores/users flows were not exercised because the
local API proxy had no backend (`ECONNREFUSED`). Public B&I login showed
pending “Signing in…” then a preserved-form error (`Login failed (500)`).
Fashion login still rendered. Root `npm run lint` remains the pre-existing
missing `eslint.config` failure.

**2026-09-13 (deployed to `app.omnicoreholding.com`)** — The B&I
catalog follows the Auto Parts table-first catalog interface and reads its
filters from fields actually populated in production. Facets include brand,
eBay category, condition (label when ID is null), review/validation status,
stock, and populated B&I attributes while omitting automotive and empty legacy
facets. Category/condition facet `OR` predicates are fully parenthesized so they
cannot escape organization/vertical scope. Results show manufacturer/brand,
model, category family, condition, image count, created date, assignment,
validation, and publishing state. Quick view hydrates the canonical product,
shows every stored image with thumbnail/lightbox navigation, and supports image
ordering/upload. Single publish loads the selected dedicated store's policies
and inventory location, passes those overrides through validation and the
publish worker, and shows blockers/warnings; bulk publish uses each selected
store's defaults. Production verification on 2026-09-13 confirmed healthy
backend/database checks, HTTP 200 catalog route, scoped facets (77 B&I rows),
and a logged-in catalog UI with populated filters plus a 12-image quick view.

**2026-09-13** — Empty B&I catalog for multi-org users such as
`bniadmin@realtrack.local` was caused by auth preferring Super Admin
(`role === 'admin'`) over the owned `business-industrial-*` workspace. Login
now stores `mk_preferred_vertical`, org selection prefers the matching vertical
workspace, and `BusinessIndustrialShell` auto-selects the owned B&I organization
so catalog search scopes to the B&I product set.

**2026-09-13** — B&I publish validation failed with "No targets passed
validation" because the dedicated native-OAuth store had no merchant inventory
location and most catalog products have null/zero price. Production provisioned
`AE_Dubai` for the B&I store; native policy sync/validate now ensure a location;
the publish modal shows API `errors`/`failures`. Five priced SKUs validate
cleanly; the remaining 72 need prices before publish.

**2026-09-13** — Shared catalog filters now use loading-safe, searchable checkbox
facets with collapsed secondary groups; category facet selections match the
server's ID filter, imported-to dates include the chosen day, and partial eBay
publish jobs stop polling while exposing target errors. The shared quick view
now has the Auto Parts drag/keyboard image ordering pattern with an explicit
primary image and deduplicated upload batches. These changes are inherited by
all verticals using CatalogWorkspace.

**2026-09-12** — Shared Fashion and Business & Industrial catalog workspaces
now carry the active organization through search, facets, suggestions, edits,
and exports. Catalog publish controls require approval before enqueueing the
existing durable eBay publish job; production B&I rows remain review-gated.
The Auto Parts sidebar Catalog link also resolves to the canonical
`/auto-parts/catalog` route.

> **Source**: Moved from `docs/handover/current-state.md` (2026-05-29).
> This file is a snapshot; for live state use `git log` and run the app.

**2026-08-30** — Pipeline Image Drive matching now runs for every bulk pipeline listing with a manufacturer or OEM part number. It treats only HTTP(S) values as images, replaces warehouse/bin placeholders, prepends matched Image Drive CDN URLs, preserves valid source URLs, updates both `listing_records.itemPhotoUrl` and `catalog_products.image_urls`, and records match/link counts in job `stageDetails.imageDrive`. Image Drive folder/file thumbnails now return browser-safe CDN URLs and raw thumbnail displays use the backend image proxy.

## Overall Status

**Active Development** — Omni Core is a substantial, actively developed full-stack platform (NestJS + React + PostgreSQL + Redis/BullMQ) focused on **eBay** automotive-parts listing, catalog import, AI enrichment, fitment, inventory, orders, and multi-store management. The architecture is mature (23 backend modules, 82 entities, 27 migrations, 14 BullMQ queues, RBAC with 8 roles / 73 permissions). Maturity of *individual features* varies — see [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md).

## What Exists Now

- Full auth + RBAC system with JWT, global guards, permission registry
- 23 backend NestJS modules covering all core domains
- React frontend with route-based permission gating
- Docker Compose full-stack deployment with healthchecks
- eBay multi-account OAuth and multi-store integration
- Catalog CSV import with BullMQ processing
- AI enrichment pipeline (OpenAI vision + text)
- Motors Intelligence attribute extraction and review
- Inventory ledger with allocation tracking
- Order import and management
- Notifications via WebSocket (Socket.IO)
- Audit trail logging

## What Works

- **Auth + RBAC** (login, register, permissions, roles, registry-driven)
- **Dashboard** with KPI aggregation
- **Listing editor** with AI assistance, revision history. Catalog inventory price/qty edits now sync to `catalog_products` and US/AU/DE sibling `listing_records` (not only the opened row). SKU renames from inventory/catalog detail modals update `customLabelSku`, linked `catalog_products.sku`, and siblings (collision-checked). Published-listing price revise resolves Inventory `offerId` when Trading sync left it null.
- **Catalog import** (CSV/bulk, BullMQ processing, motors filters)
- **eBay multi-store** (OAuth, sync, publish, multi-account). Inventory location defaults are **Dubai / `AE_Dubai`** (not Houston/`US_77001`); policy sync prefers AE warehouse keys. Before an offer is created, publish now verifies the configured merchant location against live eBay locations, ignores disabled and non-UAE keys, selects or provisions an enabled UAE location, and caches the verification briefly for bulk jobs. Repaired marketplace defaults are persisted; the source location fix and UAE-only hardening were deployed and verified in production on 2026-09-03. Publish fails closed when eBay cannot verify or provision a UAE location. Publish sanitizes item-specific values to eBay's 65-char aspect limit (fixes Type-too-long rejects on long OEM descriptions). eBay Motors publishing now rejects no unverified parent category: it resolves a cached/live leaf and persists the known leaf fallback `9886` when taxonomy is unavailable. Legacy rows with deterministic part keywords are corrected at the final publish boundary; coolant hoses resolve to live car leaf `33601` rather than motorcycle leaf `177983`. Pipeline MVL fitment is **donor-year scoped** (±5/±8) and refuses full make/model dumps when year is missing. Publish sends only **MVL-valid** compatibility rows (`needs_review`/`rejected` omitted; empty fitment still allowed). Title/make-model parsing skips junk tokens and maps Mercedes series codes (`C350`→`C-Class`) so optimizers cannot lock in corrupted models like `170`. Pipeline / enterprise US-AU titles use Gemini 3.1 Flash Lite **only** for Position + Part Name slots; the rest of the house title structure stays deterministic.
- **Inventory management** (ledger, allocations, events)
- **Order import** from eBay
- **Notifications** (in-app + WebSocket)
- **Audit trail**
- **White-label** branding (super_admin only)
- **Templates, settings, pricing rules**

## What Is Planned But Not Built

- Shopify/Amazon/Walmart full marketplace integration (scaffolding only)
- JWT token revocation and refresh rotation
- Frontend tests
- Comprehensive backend test coverage
- Formal acceptance criteria

## What Is Partially Working

- **AI listing generation** — quality unverified
- **Motors Intelligence pipeline** — active but needs verification
- **Ingestion pipeline** — core works, edge cases unverified
- **Forgot password flow** — UI exists, backend reset unverified
- **Feature flags** — backend exists, double-prefix route issue
- **Export rules** — backend exists, double-prefix route issue
- **Channels beyond eBay** — scaffolding only
- **Tenant/org isolation** — inconsistent row-level enforcement
- **eBay token refresh** — works but fragile against live API

## What Is Broken

- **Double `/api` prefix** on two controllers (feature-flags, export-rules) — routes resolve at `/api/api/...`
- **Sparse automated tests** — 24 backend specs (unit only), 0 e2e, 0 frontend tests
- **DB typing issues** — TEXT-typed price/quantity columns partially fixed by migration
- **Missing foreign keys** on some entity relationships
- **Branding** — Omni Core is now consistent across the user-facing shell and login; `listingpro` remains the internal database identifier.

## Latest Session Summary

**2026-08-10** — Published-listings sync prune timeout fixed (Blackline):
- Every Blackline Auto Parts sync since 2026-08-07 **failed at the very end** with `canceling statement due to statement timeout` — the post-upsert prune (`markUnseenActiveAsEnded`) `find()` used only `idx_epl_account` → a lossy bitmap heap scan over the 1.5GB / 78k-block heap (150k active rows) took ~58s, exceeding the 30s pool `statement_timeout`. The 124k-row upsert loop finished first, so the mirror partially refreshed but the sync log showed `failed` and the watermark never advanced.
- **Fix:** (1) new partial index `idx_epl_active_acct_mp_item (ebay_account_id, marketplace_id, ebay_item_id) WHERE listing_status = 'active'` (migration `1790000000000`); (2) prune rewritten to index-only-scan active `ebay_item_id`s + batch-UPDATE unseen rows by `ebay_item_id` via `uq_epl_account_item`, in a txn with `SET LOCAL statement_timeout = 300s` + `work_mem = 64MB`; (3) one-off prod `VACUUM (ANALYZE, PARALLEL 0)` reclaimed 86,917 dead tuples. Files: `backend/src/published-listings/services/published-listings-sync.service.ts`, `backend/src/migrations/1790000000000-PublishedListingsActiveAcctMpItemIndex.ts`. See [docs/decisions.md](../decisions.md) → 2026-08-10.
- **Before re-trigger:** Blackline mirror = 150,349 active / 7,249 ended / 9,614 out_of_stock; 123,842 active rows refreshed within 1 day (the Aug 9 partial run). Last successful full sync watermark = 2026-08-07 07:40 UTC.

**2026-07-23** — PartsBazar360 English list backfill running on prod:
- Script `scripts/backfill-published-listings-english.cjs` (Browse US) converting EU-host `listing_url` rows to English title + `ebay.com` URL.
- Order: SalvageA (~11k) then Blackline (~40k); ~300ms/row. Log: container `/tmp/english-backfill.log`. Resume-safe.
- Detail on-demand enrich already rewrites locale; this backfill makes **list** English without per-item waits.

**2026-07-23** — PartsBazar360 published-listings ops + watermark root cause:
- Production Blackline/SalvageA mirrors were **not empty** (83,986 / 24,899 active rows) but reader API returned `total: 0` because `lastSuccessfulSyncAt` was stamped ahead of every listing by **policy sync** (shared watermark field).
- Rolled watermarks back → reader totals restored: Blackline **83,986**, SalvageA **24,899**, default **108,885**.
- Code: stop non-Trading writers from touching `lastSuccessfulSyncAt`; hard-gate self-heals on watermark drift; optional `PUBLISHED_LISTINGS_SYNC_DISABLED`.
- Ops: Trading API usage limit exceeded — published-listings cron reduced to weekly (`0 3 * * 0`) until limits recover. New reader endpoints / enrichment payload still need image rebuild+deploy.
- Enrichment fill still thin on prod (description/specifics ~0%; multi-image ~500/150) until GetItem enrich runs after deploy + rate-limit recovery.
- **Follow-up:** bounded public `listingUrl` scrape enrich (`PUBLISHED_LISTINGS_SCRAPE_ENRICH`) + on-demand detail enrich (`PUBLISHED_LISTINGS_ON_DEMAND_ENRICH`) + skip Trading enrich flag — Browse/scrape fill thin payloads without burning GetItem quota.

**2026-07-23** — PartsBazar360 published-listings API contract:
- Reader discovery: `GET /api/published-listings/stores` + `GET /api/published-listings/sync-status` (works with `published_listings.view` only).
- Detail enrichment fields: `descriptionHtml`/`descriptionText`, large ordered `imageUrls`/`images[]`, `brand`/`mpn`/`oeNumbers`, `salvageDetails`.
- Trading GetItem now persists description + item specifics; enrich budget default 500/sync; health flags `missing_description` + `sync_stale`.
- Ops still: confirm Blackline + SalvageA full Trading sync + tokens after deploy (empty mirrors show as `empty_active_mirror` on sync-status).

**2026-07-22** — Published-listings reader feed restored on production:
- Default `GET /api/published-listings` had dropped to total `0` because `lastSuccessfulSyncAt` was ahead of almost every row’s `lastSyncedAt` (hard-gate).
- Rolled watermarks back to `MIN(active last_synced_at)` per active eBay account; default Blackline+Salvage feed returned ~108,885 again.
- Code: targeted `listingIds` syncs no longer advance the live sync watermark.

**2026-07-22** — Soft-delete + donor re-import contract locked in:
- Soft-delete hides that listing instance; it stays deleted.
- Same donor re-upload with no active SKU creates a **new** listing row; pipeline never recovers soft-deleted rows.
- Routing helper + regression tests: `pipeline-listing-routing.util.ts`.

**2026-07-22** — Manual title edits no longer revert after save:
- Root cause: `CatalogProductService.syncToListingRecord` always copied `catalog_products.title` onto every matching listing on *any* catalog PATCH (brand, images, country, etc.). Editors saved corrected titles only to `listing_records`, so the next shared-field save resurrected the stale catalog title (and could also fail the listing PUT on a bumped `@VersionColumn`).
- Fix: sync only DTO-present fields via `listingRepo.update` (no version bump); inventory/catalog detail editors also write title to the catalog product when the title changes.

**2026-07-15** — eBay listing fidelity hardening:
- Root-caused title and business-policy mismatches on pipelines `1c3a0f2a`, `5d5c2413`, and `6e30444a`: publish-time title recomposition replaced every reviewed title, durable targets lost the exact source listing identity, row policy names were ignored in favor of target-account defaults, and concurrent publishes wrote their resolved row policies back as new defaults.
- Publish now preserves the exact listing row and stored title, resolves each named shipping/payment/return profile independently for every target account, refreshes stale policy caches, blocks absent/incompatible named policies, and leaves marketplace defaults unchanged.
- Production remediation created the two exact missing Primemotive fulfillment policies, deployed the fix, and republished all 1,960 affected BLACKLINEAUTOPARTS/Primemotive channels. Transient eBay revise/availability failures now retry, and an audit-discovered zero-stock coercion bug was fixed so quantity `0` remains zero.
- Complete eBay Inventory API readback found every affected inventory item and offer. Titles, categories, prices, quantities, and fulfillment/payment/return policy IDs now match Omni Core; named-profile coverage is complete, marketplace defaults were not mutated, and the final mismatch count is zero.
- Pipeline `52292964-b8c5-4443-a076-088ed292a5a1` exposed a separate part-identity issue: generic types such as `Part`, `Not Specified`, `Miscellaneous`, and `Automotive` were allowed to keep AI/taxonomy categories like Fuel Injectors, ECUs, Hood Panels, and Liftgates. Added script and backend guards so generic identities fall back to verified leaf `9886` unless a trusted keyword confirms the part family; repaired the production batch across `listing_records` and `catalog_products`, with uncertain rows marked for manual review.

**2026-07-12** — High-volume catalog publishing:
- Catalog search/page size supports 500 rows.
- Bulk eBay publish submits one durable BullMQ job for up to 500 listings and 10 stores, with per-target persistence, concurrency 5, transient retries, and progress polling.
- Organization quota is 5,000 listing/store publish targets per UTC day; normal application throttles remain unchanged while job-progress polling has scoped higher limits.

**2026-07-11** — Pipeline `1c3a0f2a` two-store publish hardening:
- Repaired all 903 listing and catalog rows from non-Motors/non-leaf categories to verified eBay Motors leaf `9886` (`Other Car & Truck Parts & Accessories`) and published the complete pipeline to BLACKLINEAUTOPARTS and Primemotive.
- Catalog bulk publishing now submits five listings per authenticated backend request, retries only transiently failed store/listing pairs, and uses throttle-aware exponential backoff.
- Publish progress is keyed by job ID so targeted retries start with clean state and report accurate per-store results.

**2026-07-10** — eBay error 25005 fix (invalid category IDs):
- Root cause: `ebay_category_mappings` table empty (seed migration `1709769600000-MotorsIntelligenceSystem` never run on prod) + `isMotorsCategory()` returned `true` for unmapped categories → AI taxonomy suggestions returned non-Motors categories (31373 "Lincoln Memorial", 2518 "Other Educational Toys", 11774 "Other Welding Equipment", 34 others) → stored in `listing_records.categoryId` → eBay rejected with errorId 25005.
- Fix: (1) `isMotorsCategory()` in `enterprise-listing-intelligence.service.ts` now returns `false` for unmapped categories (was `true`), forcing taxonomy re-resolution. (2) Seeded `ebay_category_mappings` with 15 known Motors categories. (3) The emergency fallback was initially `6000`, but production follow-up on 2026-07-11 proved that eBay rejects this root as non-leaf; the emergency fallback is now leaf `9886` (`Other Car & Truck Parts & Accessories`). (4) Affected records must be repaired in both `listing_records` and `catalog_products` before retrying publish.
- See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) R16.

**2026-07-20** — Pipeline now skips Excel-hidden rows on GridX/XLSX upload and enrichment (`sheetToVisibleAoa` + `ebay-enrichment-pipeline.mjs`). Soft-deleted / Hide Rows content is no longer imported. Bulk `propagateSourceImages` is per-SKU only. Job `1d561867` (VW Jetta) cleaned: 323 hidden Bentley listings soft-deleted; Bentley catalog restored from prior Bentley-branded listings.

**2026-07-01 (continued)** — Inventory pipeline hardening:
- Auto-enrich now triggers on **2+ images only** (vision lookup runs inside the job; no longer requires part#/brand upfront).
- `PUT /inventory/:id/editor` persists marketplace version edits to sibling listing records + `catalog_products.optimization_payload`.
- Publish flow wires UI policy selections → `listing_store_overrides` → `ListingBuilderService` at publish time.
- Inventory list + detail show per-store eBay listing status (store name, offer ID, live price/qty) from `ebay_listing_channels`.

**2026-07-01** — Phase 1 of Inventory Auto-Enrich pipeline: created `InventoryAutoTriggerService` which detects when a listing reaches 2+ images with part number + brand and automatically enqueues a BullMQ `auto-enrich` job. The job runs vision lookup + pipeline enrichment + US/AU/DE optimization end-to-end. Added `enrichmentStatus` (idle/ready/enriching/completed/failed) to the inventory workbench list + detail endpoints, an enrichment status polling endpoint, and a frontend badge column with animated pulse for in-progress states.

Phase 2: Created the unified multi-marketplace editor at `/inventory/:id/edit` with 3 marketplace tabs (US/AU/DE), editable fields (title, description, price, quantity, condition), store selector scoped to user-accessible eBay stores, and cascading payment/return/fulfillment policy dropdowns. The editor is served by `InventoryEditorService` (aggregates listing siblings + catalog product + accessible stores with policies). Frontend components: `InventoryListingEditor` (main page), `MarketplaceVersionEditor` (tab editor), `StorePolicySelector` (store+policy dropdowns).

Phase 3: Added direct publish from the editor. New `InventoryPublishService` auto-creates a CatalogProduct from the listing (if none exists) and calls the existing multi-store publish flow (`EbayMultiStoreListingService.createPublishJob()`). New `POST /inventory/:id/publish` endpoint with `ebay.publish` permission gate. Frontend `PublishActionBar` shows target marketplaces with per-target progress tracking.

Phase 4: Catalog dedup and polish — the catalog grid now groups listing records by SKU (one card per part) with colored marketplace badges (US/AU/DE) in grid and list views. The existing `/catalog/products/:id` detail page already shows multi-marketplace tabs. Backend + frontend compile clean.

All 4 phases of the Inventory Auto-Enrich → Multi-Marketplace Editor → Publish pipeline are complete.

## Current Assumptions
- eBay remains the primary (only fully-developed) marketplace integration
- PostgreSQL 16 + Redis 7 remain the infrastructure stack
- Docker Compose remains the primary deployment method
- The `@Controller('api/...')` double-prefix issue has not been resolved (verify)
- Uncommitted working tree from 2026-05-29 snapshot needs triage (verify with `git status`)

## Shared catalog parity implementation (2026-09-12)

Implemented shared Fashion and Business & Industrial catalog workspaces and
canonical routes. The server now provides paginated search, suggestions,
facets, safe publication summaries, detail projection, inline edits, bulk
team/policy/delete actions, and server-side CSV export from catalog_products.
Frontend state is URL/session-persistent and uses debounced suggestions,
responsive facets, consistent tables, quick view image management, and durable
publish progress. Fashion bulk publish now uses the shared multi-store job path.
Focused catalog authorization tests pass. The frontend production build passes;
the backend build remains blocked by pre-existing TypeScript errors in
`backend/src/scripts/backfill-brand-images.ts` *(outdated 2026-10-07: syntax
error fixed; `tsconfig.build.json` compiles clean)*; the repository
root lint command still fails because ESLint 9 finds no root eslint.config file,
and the backend repository-wide lint baseline contains unrelated existing errors.
No migration was added because the implementation uses existing catalog and audit
columns; shared soft-delete is the existing vertical_validation_status=deleted
lifecycle value.

## Immediate Next Step

See [NEXT_STEPS.md](NEXT_STEPS.md) for prioritized work items. Top priority: verify and fix the double `/api` prefix controllers, then raise test coverage on auth/RBAC and eBay paths.

---

*Snapshot date: 2026-06-11. Reorganized: 2026-06-06.*
