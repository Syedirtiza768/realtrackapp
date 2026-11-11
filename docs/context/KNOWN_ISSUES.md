# Known Issues

**2026-11-05 API integration authentication:** The historical Published Listings
Reader credential failed with 401. A user-approved password reset resolved
reader login and listing/feed API checks (HTTP 200). The replacement credential
is in protected production environment storage. Consumer configurations must
be updated before their own authentication/ingestion is verified; the first
server's previously configured integration login failed before rotation.
See the [operational record](../operations/PRIMEMOTIVE_US_RECONCILIATION_2026-11-05.md).

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **Source**: Moved from `docs/KNOWN_GAPS_AND_RISKS.md` (2026-05-29).
> This is the master file for known issues, risks, and technical debt.
> For prioritized action items, see [NEXT_STEPS.md](NEXT_STEPS.md).

---

## Critical Issues (Fix Immediately)

### MotoArk sale receipt does not synchronize orders or stock

**Reviewed:** 2026-11-02

**Severity:** High before enabling external stock effects

**Status:** Local implementation candidate; production rollout and stock initialization outstanding

The Primemotive sale webhook accepts only `listing.sold` and records a log.
It does not implement MotoArk cancellations, returns, refunds, or quantity
effects. Standard Compose omits the inbound secret, and the log's lookup/insert
deduplication is not atomic under concurrent retries. Listing push also needs
per-listing ordering and organization-scoped subscriptions before wider reuse.
The internal stock ledger supplies reusable reservation/release/channel-sync
primitives, but the durable external adapter and linked return workflow are
missing. See the [evidence, remediation order, and acceptance checks](../integrations/motoark-order-lifecycle-gap-analysis.md).
Subsequent SSH inspection confirmed the legacy sales secret configured, push
disabled, and 0 stock mappings in a 200-row sample. The active image lacks the
Primemotive routes/sender despite retaining the October migration. The
[candidate](../architecture/MOTOARK_ORDER_LIFECYCLE.md) addresses the source
gaps and restores those routes; production configuration/data remain unchanged.

### Exact-MPN title evidence can be widened by generic platform expansion

**Type**: Bug
**Severity**: Medium
**Status**: Needs code fix

**Description**: On the 2026-10-06 UPL-235 retry, exact OEM catalog rows were
stored as title-only review evidence, but generic MVL platform/sibling
expansion produced wider title ranges for Toyota Corolla, Audi A4, and Audi Q7.
The affected production titles and generated compatibility rows were corrected
or removed. Future forced optimization of these SKUs could repeat the widening
until title selection gives exact part-number evidence priority.

**Affected Areas**: `backend/src/listing-optimization/fitment-discovery.service.ts`,
`backend/src/ingestion/enterprise-listing-intelligence.service.ts`
**Mitigation**: The five researched UPL-235 titles are source-corrected and kept
in manual review; do not force-retry them until title selection is fixed.

**2026-10-13 recovery evidence:** `BU1-16336`, `BU1-16349`, and `BU1-16394` inherited Volkswagen Golf context during inline recovery despite lacking exact part-to-vehicle evidence. Their unsupported active fitment/title claims and cached optimization payload were withdrawn after full backups, and unpublished records were returned to manual review. Do not force optimization of these SKUs until supported fitment is supplied. See [Add Part recovery](../operations/ADD_PART_RECOVERY_2026-10-13.md).

### R1: Double `/api` Prefix Routing

**Type**: Bug  
**Severity**: Medium
**Status**: Needs verification

**Description**: Two controllers declare paths with `api/` prefix that combines with global prefix:
- `feature-flag.controller.ts`: `@Controller('api/feature-flags')` → `/api/api/feature-flags`
- `export-rule.controller.ts`: `@Controller('api/export-rules')` → `/api/api/export-rules`

**Affected Areas**: API routing, frontend API clients  
**Suggested Fix**: Verify frontend clients, fix controllers to remove `api/` prefix, update clients if needed.  
**Files**: `backend/src/common/feature-flags/feature-flag.controller.ts`, `backend/src/listings/export-rule.controller.ts`

### R3: Production Secrets as Defaults

**Type**: Security Concern  
**Severity**: High  
**Status**: Ongoing risk

**Description**: `.env.example` contains default credentials (`DB_PASSWORD=postgres`, `JWT_SECRET=CHANGE_ME`). Risk of production deployments using weak credentials.

**Affected Areas**: Security  
**Suggested Fix**: Add validation script, enforce pre-deploy checklist.

### R3b: DEBUG JWT Logging

**Type**: Security Concern  
**Severity**: High  
**Status**: Resolved (2026-06-17)

**Description**: `auth.service.ts` and `jwt.strategy.ts` logged JWT secret prefixes and full tokens to console with `[DEBUG]` markers.

**Resolution**: Debug logging removed from auth service, JWT strategy, and auth module factory.

### R3c: Open Public Registration

**Type**: Security Concern  
**Severity**: High  
**Status**: Mitigated (2026-06-17)

**Description**: `POST /api/auth/register` was public and assigned Staff role.

**Resolution**: Gated by `ALLOW_PUBLIC_REGISTRATION` (default off in production/Docker); self-registered users get Viewer role; login UI hides register link when disabled. Admin invite via `POST /api/rbac/users` remains the production path.

---

## High Priority Issues

### R19: Catalog Bulk Publish Used the User's Default Workspace

**Type**: Reliability bug
**Severity**: High
**Status**: Resolved (2026-11-04)

**Description**: The Auto Parts catalog publish dialog could show an eBay store from the currently selected workspace, but the durable bulk-publish request omitted `organizationId`. For a user in multiple workspaces, the API then resolved the user's oldest workspace and rejected the valid store with `selected store(s) are not active eBay stores in this organization` before creating a job.

**Resolution**: Scope the publish dialog's store list to active eBay accounts in the selected workspace, pass its `organizationId` to durable job creation, and include the same ID when polling job targets. No backend or schema change is required.

**Files**: `src/components/catalog/CatalogManager.tsx`, `src/components/channels/PublishModal.tsx`, `src/components/catalog/PublishProgressPanel.tsx`, `src/lib/publishApi.ts`

### R18: eBay Publish Changed Reviewed Titles and Business Policies

**Type**: Data-integrity bug
**Severity**: High
**Status**: Resolved (2026-07-15)

**Description**: Durable bulk targets canonicalized listing IDs to `catalog_products`, and the worker did not retain the exact source listing row. `buildEbayListingTitle` then recomposed every non-empty title from structured fields. `ListingBuilderService` started with marketplace defaults and ignored row-level shipping/payment/return profile names. Finally, `EbayPublishService` persisted the policy IDs resolved for each listing back into `ebay_account_marketplaces.default_*`, so concurrent targets could race and change the defaults used by other listings. Production pipelines `1c3a0f2a`, `5d5c2413`, and `6e30444a` exposed the combined failure.

**Resolution**: Durable targets retain `sourceListingId`; the resolver prefers that exact row; stored titles are authoritative; named profiles resolve per target account and refresh from eBay on cache misses; missing/incompatible names block instead of falling back; and request-scoped resolved policy IDs no longer mutate account defaults. Explicit zero stock is also preserved instead of being coerced to quantity `1`, and transient eBay revise/availability propagation errors use the durable worker's retry policy. Regression coverage spans title construction, source resolution, durable target identity, listing building, final policy enrichment, transient classification, and zero-stock publishing.

**Production remediation**: Created the two exact missing Primemotive fulfillment policies (`331303545021` and `331303546021`), deployed the fix, and republished all 1,960 affected channels across BLACKLINEAUTOPARTS and Primemotive. Two temporary eBay propagation failures succeeded through a targeted retry. A complete live Inventory API readback found all 1,960 inventory items and offers; title, category, price, and all three policy IDs matched. It exposed one additional zero-stock mismatch on two channels, which was fixed and republished; the final targeted live readback reported zero mismatches. Database audit: 1,960 distinct successfully repaired channels, zero unresolved named-profile assignments, zero recomposed-title warnings, and unchanged marketplace defaults.

**Files**: `backend/src/channels/ebay/ebay-listing-text.util.ts`, `backend/src/channels/ebay/ebay-publish.service.ts`, `backend/src/integrations/ebay/services/catalog-publish-resolver.service.ts`, `backend/src/integrations/ebay/services/listing-builder.service.ts`, `backend/src/integrations/ebay/processors/ebay-listing-publish.processor.ts`

### R17: Catalog Bulk Publish Exhausted Authenticated-User Throttle

**Type**: Reliability bug  
**Severity**: High  
**Status**: Resolved (2026-07-11)

**Description**: Bulk publish issued one authenticated `publish-by-listings` request per listing at concurrency 5. Large, consecutive page batches could exhaust the global 1,000-request/hour user bucket. SellerPundit also intermittently returned `Product not found` immediately after inventory creation or Core Inventory HTTP 500 responses. Targeted retry jobs reused mounted `PublishProgressPanel` state, which could show a stale 100-row summary for a smaller retry.

**Resolution**: `PublishProgressPanel` sends chunks of five listing IDs through the existing backend batch endpoint, reducing a 100-listing page from 100 authenticated requests to 20. It recognizes SellerPundit timing/500 and application throttle errors and retries only failed store IDs with exponential backoff. `CatalogManager` keys the panel by publish-job ID so each retry receives fresh state. Successful store results are never resubmitted by the automatic retry path.

**Files**: `src/components/catalog/PublishProgressPanel.tsx`, `src/components/catalog/CatalogManager.tsx`

### R19: Stale eBay Inventory Location Keys Caused Publish Error 25002

**Type**: Integration reliability bug
**Severity**: High
**Status**: UAE-only hardening deployed and verified in production (2026-09-03)

**Description**: The publish path trusted `ebay_account_marketplaces.default_inventory_location_key` and only checked eBay for a location when the database value was empty. If eBay deleted or disabled that location independently, offer creation succeeded but `publishOffer` failed for every listing with error 25002: `Location information not found`. A persisted `USA`/legacy US key could also be accepted merely because the eBay location was enabled, even though the seller's registered and dispatch country is UAE.

**Resolution**: The final publish boundary now verifies the configured key against eBay, filters disabled locations and non-UAE addresses, normalizes legacy `USA`/US placeholders, selects an enabled UAE location or provisions the Dubai default `AE_Dubai`, caches the account-level verification briefly during bulk jobs, and persists a repaired marketplace default. When eBay cannot verify or provision a UAE location, the request fails closed without an unverified location key. The original reconciliation fix was rebuilt and restarted in production on 2026-08-21; the UAE-only hardening was rebuilt, restarted, and verified in production on 2026-09-03. The affected Superior Auto Parts offer read back with an enabled UAE location (AE_Sharjah, UAE), which is acceptable for this account.

**Files**: `backend/src/channels/ebay/ebay-inventory-api.service.ts`, `backend/src/channels/ebay/ebay-publish.service.ts`

### R20: Account-Scoped eBay SKU Collisions Could Cross-Project Listing Data

**Type**: Data-integrity bug
**Severity**: Critical
**Status**: Fixed in code; production repair batch in progress (2026-08-24)

**Description**: eBay Inventory SKUs are scoped to the seller account, not to
an individual catalog product. A reused SKU could therefore point at an
unrelated remote item. The old compatibility fresh-SKU recovery copied that
remote item, which could publish the wrong title, images, aspects, and
description for the requested part.

**Resolution**: The publish boundary now performs a fail-closed remote SKU
ownership check before either direct Inventory API or SellerPundit writes. A
A canonical valid-SKU collision deterministically tries up to four bounded
alternate candidates (preserving the postfix-free `BLAP-<suffix>` first
candidate for legacy BLA SKUs) only after proving that eBay has no item or offer
under each candidate; if all candidates collide, the target remains a hard
failure. A successful
publish is also read back and checked for title, description, image count,
policy IDs, location, and compatibility. Fresh-SKU recovery now requires a
canonical local inventory payload and refuses to derive one from a remote item
after a collision. The read-only production audit is
  `backend/src/scripts/audit-add-part-ebay.ts`; it covers individual Add Part/New
  listings while excluding pipeline, FEBI/FEBI Bilstein, and Lemförder/Lemforder.
  Internal warehouse-bin values such as `BL2A-R3-ZC-S5-L-B8` are deliberately
  treated as inventory metadata rather than eBay merchant addresses; the audit
  validates the configured eBay location key (`AE_Dubai`) separately.

The production repair runner is serial and dry-run by default. Its apply mode
persists the effective `BLAP-` SKU and new eBay offer/listing IDs transactionally,
retries bounded eBay availability-propagation failures, and removes only
unpublished/no-listing partial recovery offers/items that were proven to be
created by that run. Published or ambiguous remote offers are never deleted.

**Files**: `backend/src/channels/ebay/ebay-publish.service.ts`,
`backend/src/channels/ebay/ebay-compatibility-reconciliation.service.ts`,
`backend/src/scripts/audit-add-part-ebay.ts`,
`backend/src/scripts/repair-add-part-ebay.ts`

### R22: eBay Blocked Overseas-Warehouse Inventory by Seller-Country Policy

**Type**: External policy / integration handling
**Severity**: High
**Status**: Action required on affected eBay accounts

**Description**: eBay rejects inventory when the merchant location country differs from the seller account registered address. The observed error carries reference 1276646 and code SRM_HIS_WH_Location_Mismatch_Inventory_Block. Its outer message includes Cannot revise listing, which previously caused durable publish retries and bulk revise jobs to hide the useful eBay detail behind a generic HTTP 400.

**Resolution**: The publish worker now classifies this exact policy block as permanent, and direct/SellerPundit publish plus published-listing bulk revise paths return actionable guidance. The operator must configure a real enabled merchant location in the seller registered country, or request eBay authorization for forward-deployed inventory through whappeals@ebay.com. The application must not rewrite a physical warehouse country merely to bypass this policy.
### R21: Legacy FEBI Publish Rows Reached eBay with Invalid Category, Fitment, UPC, or Image Data

**Type**: Integration reliability bug
**Severity**: High
**Status**: Deployed and verified in production (2026-09-03)

**Description**: The 2026-08-26 Superior Auto Parts publish batches contained
status-blind Mercedes/BMW fitment rows, blank UPC values, generic `Engine`
categories for non-engine parts, and a literal PartsFinder `{col}` image
template. eBay rejected these as invalid compatibility, missing UPC,
miscategorized listings, or an undownloadable EPS image. A separate set of
legacy projection errors returned Trading API `21919474`.

**Resolution**: Both durable and single-listing publish paths now require
explicitly validated fitment rows, supply `Does not apply` for missing UPC,
replace stale generic Engine categories with Motors leaf `9886` unless the
title clearly identifies a complete engine, and expand the known PartsFinder
template to its stable `details/01` image while rejecting other unresolved
templates. The existing SellerPundit-to-Inventory fallback handles the
`21919474` projection error without issuing an unsupported Trading revise.

When eBay returns error `25002` with `All compatibilities are invalid` after
Inventory API compatibility readback succeeds, publish retries once with the
validated core Make/Model/Year rows and refreshes the offer projection. This
handles catalog Trim/Engine values whose vocabulary is not valid for the eBay
US Motors marketplace while keeping the listing blocked if the core rows also
fail eBay validation.

A legacy Superior Auto Parts row exposed a second cause of the same error:
category `177983` is a leaf under the live Motorcycle & Scooter Parts tree,
not the Car & Truck category. The final publisher boundary now applies
deterministic listing keywords to legacy rows and maps coolant hoses to live
car leaf `33601` (`Coolant Hoses`), persisting the repair across the catalog
and SKU-linked source rows before compatibility is submitted.

**Follow-up (2026-09-15):** FEBEST catalog rows (for example `1921-G01LH`)
still failed 25002 because the retry rewrote the same European Trim/Engine
payload and also sent `Submodel`. The retry now strips to unique
Make/Model/Year, and `fitmentDataToCompatibilityPayload` omits `Submodel`.

**Files**: `backend/src/channels/ebay/ebay-listing-images.util.ts`,
`backend/src/channels/ebay/ebay-listing-aspects.util.ts`,
`backend/src/channels/ebay/ebay-publish-category.util.ts`,
`backend/src/fitment/fitment-mvl.util.ts`,
`backend/src/channels/ebay/ebay-publish.service.ts`,
`backend/src/integrations/ebay/services/listing-builder.service.ts`

### R16: Empty ebay_category_mappings Caused Invalid Category Publishes

**Type**: Bug  
**Severity**: High  
**Status**: Resolved (2026-07-10)

**Description**: The `ebay_category_mappings` table was empty on production because seed migration `1709769600000-MotorsIntelligenceSystem` was never run (not in `typeorm_migrations`). Combined with `isMotorsCategory()` returning `true` for unmapped categories by default, the AI taxonomy suggestion API (using tree `'0'` = all eBay US, not Motors-specific) returned non-automotive categories (e.g. "Lincoln Memorial" cat 31373, "Other Educational Toys" cat 2518, "Other Welding Equipment" cat 11774) that passed validation. These bad category IDs were stored in `listing_records.categoryId` and caused eBay `publishOffer` to fail with errorId 25005 ("invalid category ID").

**Resolution**: (1) `isMotorsCategory()` in `enterprise-listing-intelligence.service.ts` now returns `false` for unmapped/unknown categories, forcing taxonomy re-resolution. (2) Seeded `ebay_category_mappings` with 15 known Motors categories. (3) Production follow-up on 2026-07-11 showed that category `6000` is a non-publishable root; `getFallbackLeafCategory()` now uses verified leaf `9886` (`Other Car & Truck Parts & Accessories`) only when live subtree leaf discovery fails. (4) Repairs update both `listing_records` and `catalog_products` so stale category data cannot re-enter the publish path. (5) Follow-up on 2026-07-15 added a generic-identity guard: rows whose extracted type is only `Part`, `Not Specified`, `Miscellaneous`, `Automotive`, or similar cannot keep or request a specific taxonomy category unless a trusted deterministic keyword confirms the part family; they fall back to `9886` and can be marked for manual review.

**Files**: `backend/src/ingestion/enterprise-listing-intelligence.service.ts`, `backend/src/migrations/1709769600000-MotorsIntelligenceSystem.ts`

### R2: Low Test Coverage

**Type**: Technical Debt  
**Severity**: High  
**Status**: Confirmed

**Description**: 24 backend `.spec.ts` files (unit only), 0 e2e tests, 0 frontend tests. Regressions go undetected, especially in auth/RBAC and eBay paths.

**Suggested Fix**: Add tests for auth/RBAC, eBay OAuth flow, eBay publish/sync, catalog import pipeline, permission enforcement.

### R9: No JWT Revocation

**Type**: Security Concern  
**Severity**: Medium
**Status**: Confirmed

**Description**: Logout is client-side only — tokens remain valid until expiry. No server-side token blacklist or versioning.

**Suggested Fix**: Implement short expiry + refresh tokens, or token blacklist (Redis), or token versioning.

### R10: eBay OAuth Fragility

**Type**: Risk  
**Severity**: High  
**Status**: Needs monitoring

**Description**: eBay token refresh against live API can fail due to network issues, API downtime, token expiry edge cases. Risk of integration disruption and failed publishes.

**Suggested Fix**: Monitor `EbayApiError` logs, implement exponential backoff retry, add token refresh alerting, test refresh path regularly.

---

## Medium Priority Issues

### R29: Some already-validated fitment may be wrong

**Type**: Data quality
**Severity**: Medium-High
**Status**: Open — found by the fitment accuracy test, 2026-09-21

**Description**: Re-deriving fitment for 24 rows that already had validated fitment gave conflicts on a
few of them. SKF-BR930263K is recorded as Ford F-150 2000-2011, but 18 comparable listings name Ford Focus
and eBay's compatibility check confirms Focus 2000-2011 on two independent sellers' listings (that part
number is very likely a Focus hub). The earlier stage (exact-eBay-listing evidence + an LLM + the vehicle
list) only checked that the vehicle *exists*, not that the part fits it. Those vehicles are now in the
DB and in the SEO titles/descriptions of the 147 rows written on 2026-09-21.

**Affected Areas**: `catalog_products.fitment_data`, titles/descriptions built from it.
**Suggested Fix**: run `fitment-from-ebay-compat.mjs --include-verified --state audit.json` (about 1,300
calls) over all validated rows, list rows whose confirmed vehicles do not overlap the recorded ones, and
review those by hand before posting them. Do not auto-change fitment.

### R28: Napa "comparables" are mostly other brands' products

**Type**: Data limitation
**Severity**: High
**Status**: Mitigated 2026-09-21 (brand required in comparables); root cause remains

**Description**: For Napa house-brand part numbers, the eBay listings that share the number are
overwhelmingly other manufacturers' parts (457 of 490 listing rejections were `brand_mismatch`). Prices
and fitment derived from them describe a different product. Rows with no comparable naming the brand are
now left unpriced instead.

**Affected Areas**: ~85 Napa rows that were priced before the brand rule; all Napa pricing going forward.
**Suggested Fix**: NAPA's own price list / catalog export, or a licensed parts-pricing feed.

### R27: Production host is memory-starved and OOM-kills the backend

**Type**: Operational risk
**Severity**: High
**Status**: Open — observed 2026-09-21

**Description**: The EC2 host has 3.8 GB RAM and **no swap**; about 3.4 GB is in use and ~110 MB
is free at rest. The kernel OOM-killer has fired repeatedly: 2026-09-20 08:03 (x2), 09:02,
10:03 (x2), 10:27, 10:54 and 2026-09-21 07:07, 07:14. The two on 09-21 killed the Nest backend
(container `realtrackapp-backend-1`, restart count 61); Docker restarts it and it recovers on its
own, but in-flight requests and BullMQ jobs are interrupted. Pipeline scripts run with
`docker exec` inside that container add roughly 100-250 MB each and coincided with both 09-21
kills, so they very likely tipped a host that was already at the edge (the 09-20 kills predate
any of that work).

**Affected Areas**: production availability; every ad-hoc `docker exec node ...` job.
**Update 2026-09-21 08:2x UTC**: the backend restarted twice more (restart count 61 -> 63, latest OOM
kill 08:22:46) while nothing heavy of ours was running on the host, only `ssh`/`psql` one-liners. The host
therefore crashes the backend every 30-60 minutes on its own; the earlier ad-hoc jobs were a contributing
factor on one occasion, not the root cause. Available memory at rest was about 250 MB.

**Mitigation applied 2026-09-21 12:04 UTC (partial)**: activated a 4 GB swap on the host. `/swapfile` (4 GiB,
root:root 0600, a valid swap signature created 2026-07-06 22:17 but never activated or listed in fstab) was
enabled with `swapon`, `/swapfile none swap sw 0 0` was appended to `/etc/fstab` (backup
`/etc/fstab.bak-before-swap-20260921-120434`) and `vm.swappiness=10` was set in `/etc/sysctl.d/99-swap.conf`.
Undo: `sudo swapoff /swapfile`, remove that fstab line, delete `/etc/sysctl.d/99-swap.conf`. Swap is a safety net,
not a fix: RAM is still fully used, so the container memory limits and instance size below remain open. Check
whether the OOM kills and backend restarts stop before closing this item.

**Update 2026-09-21 ~16:00 UTC (diagnosis; code-side fix deployed 16:17 UTC)**: Since the swap went live the
last kernel OOM kill was 12:04:04 and nginx has logged no 502s after 12:10 (before that: 533 of 6,435 requests
502'd on 09-21, mostly 08:00-11:00). Backend restart count is 107 in total, and the journal shows about 450 kills in 10
days (221 the backend `node`, 84 `mariadbd` from the `compose-*` ERP stack, 11 `postgres`, 11 renovessa `next-server`). So swap
appears to have stopped the kills, but the host is still at ~1 GB available with ~1.6 GB of swap in use (slow, not
crashing). Every 502 burst in `/var/log/nginx/error.log` ("upstream prematurely closed" / "connection reset") lines up
with an OOM-kill timestamp: the backend is down while Docker restarts it.
Likely in-app memory drivers (from code, not yet profiled under load): `thumbnail.processor.ts` ran 15 parallel
sharp jobs inside the API process (now `STORAGE_THUMBNAIL_CONCURRENCY`, default 3); sharp had no
concurrency/cache cap (now `SHARP_CONCURRENCY=1`, `SHARP_CACHE_MB=32` in `image-processor.service.ts`); image upload
endpoints buffered up to 50 files in RAM with no size limit (now `IMAGE_UPLOAD_MAX_FILE_MB`, default 20, via
`storage/upload-limits.ts`); and the backend had no container memory limit with a 1536 MB heap (compose now
`mem_limit: ${BACKEND_MEM_LIMIT:-1800m}`, heap 1280). Heap trade-off: the 1536 MB heap was chosen for large catalog
CSV imports (the file is loaded into the JS heap); 1280 MB leaves less headroom for those.
**Done 2026-09-21 16:2x UTC**: Docker build cache pruned (disk 81% -> 37%), and the renovessa stack (which also leaked
~128 zombie `next-server` processes) was stopped and removed, so the host now runs two stacks (realtrack and the
`compose-*` ERP). **The ERP stack (`/opt/traders/compose`, nginx `enxi.realtrackapp.com` -> `127.0.0.1:8080`) was then
also stopped** (`docker compose -p compose stop`; containers and 5 volumes kept; restart policy `unless-stopped`, so it
stays down across reboots). Restart: `cd /opt/traders/compose && sudo docker compose -p compose up -d`. That host name's
DNS points at 208.91.197.132, not this server, and this server saw only 4 bot requests for it (2026-09-07). The host now
runs only the realtrack stack. Still open: the box is a `t3.medium` (2 vCPU/4 GB); with one stack left, a resize is optional.
**Renovessa removal details**: `docker compose down` (no `-v`), image removed, nginx `sites-enabled/renovessa.com`
symlink deleted (`sites-available/renovessa.com` and the S3 CORS origins kept). Kept for restore/deletion later: volumes
`renovessa_postgres_data` (69 MB) and `renovessa_bathroom_uploads` (1 MB), `/opt/renovessa`, and the archive
`~/renovessa-archive-20260921/` (`renovessa-db.sql.gz`, `uploads.tgz`, `opt-renovessa-src.tgz`). Restore: relink the
nginx site, `cd /opt/renovessa && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.

**Suggested Fix**: add swap (done, see above) or move to a larger instance; set container memory limits/reservations
so one container cannot take the host down; stop running batch jobs inside the production
container. Interim rule: run pipeline stages on another machine and only copy results to the
host (`scripts/pricing-retry-local.sh`). `scripts/pricing-retry-watcher.sh` is deprecated for this
reason.

### R26: Napa house-brand fitment has no automated source (updated 2026-09-21)

**Update**: the eBay compatibility route (CATALOG_PIPELINE, "Fitment from eBay's own compatibility check")
found fitment for only 3 of 114 target rows once cross-brand collisions were excluded, and for 0 of 107
Napa rows. It works for Mevotech and SKF, not for Napa.

### R26 (original entry): Napa house-brand fitment has no automated source

**Type**: Data gap
**Severity**: High
**Status**: Open — measured 2026-09-21

**Description**: Only 147 of 866 rows have validated fitment (Napa 53/765). Web search plus page
verification found none for 6/6 Napa pilot rows; captured eBay listing text produced candidates
for 2/41 rows. Without fitment a row cannot be posted, so this — not price — caps the number of
postable listings (44 today).

**Affected Areas**: ~700 Napa rows; `Fitment Status = fitment_pending`.
**Suggested Fix**: Obtain supplier ACES/PIES fitment data or a NAPA catalog export, or build the
Trading-API item-compatibility route (`GetItem` + `IncludeItemCompatibilityList` on the ~16
exact-MPN comparable listings each priced row already carries, requiring agreement across
sellers, then eBay vehicle-list validation).

### R25: OpenRouter credit balance is nearly exhausted and shared with production

**Type**: Operational risk
**Severity**: High
**Status**: Open — observed 2026-09-21

**Description**: The account behind `OPENAI_API_KEY` had about $1.19 of credit left
($537 purchased, $535.81 used); after a $10 top-up it stood at about $7.89 on 2026-09-21. The same key drives the application's AI pipelines (listing
generation, fitment, enrichment), so exhausting it stops those too, not just the pricing
research (which already halted on HTTP 402). Cost data is on the OpenRouter account
(`GET /api/v1/credits`); this repo cannot top it up.

**Affected Areas**: all OpenRouter-backed AI calls; `scripts/price-web-research.mjs`.
**Suggested Fix**: Add credit before the next AI run, and consider a separate, capped key
for batch/pricing scripts so they cannot starve production (`--max-cost` only bounds one
run, not the balance).

### R24: Catalog lists reman-prone parts as New

**Type**: Data quality / listing-policy risk
**Severity**: High
**Status**: Open — surfaced by the 2026-09-21 web-pricing pass, not yet resolved

**Description**: The source catalog sets `Condition = New` (eBay condition 1000) for every
row, including brake calipers, starters and alternators. Web research found the exact
NAPA official page describing at least one caliper (NAPA 1425XB) as remanufactured.
Publishing a remanufactured part as New is an eBay item-condition violation.

**Affected Areas**: `catalog_products.condition_id`, all reman-prone rows in the
PartsBazar360 exports. Rows are flagged `conditionConflict` in the pricing evidence and
listed in `partsbazar360-pricing-review-queue.csv`.
**Suggested Fix**: Confirm the true condition per part type with the supplier before
publishing any caliper/starter/alternator/axle row; correct `Condition` in the source
sheet; never price these as New until confirmed.

### R23: Pipeline pricing has no sold-listing comparables

**Type**: External constraint
**Severity**: Medium
**Status**: Open — mitigated and disclosed

**Description**: `scripts/price-enrich-catalog.mjs` must prefer completed/sold
comparables, but the eBay OAuth grant is `buy.browse` only
(`backend/src/channels/ebay/ebay-auth.service.ts`), which returns ACTIVE listings.
Sold comparables need the Marketplace Insights API, granted by application only.
Active-listing medians run above realised sale prices, so recommended prices skew
high.

**Mitigation in place**: the stage never emits `pricing_verified_exact_match`,
records the method on every row, and notes on each priced row that the
comparables were active listings. See
[decisions.md](../decisions.md) (2026-09-20) and
[operations/CATALOG_PIPELINE.md](../operations/CATALOG_PIPELINE.md#pricing-enrichment).

**Affected Areas**: catalog pricing, PartsBazar360 exports
**Suggested Fix**: Apply for eBay Marketplace Insights access, then swap the
comparable source in `buildAttempts`/`browseSearch`.


### R6: TEXT-Typed Price Columns

**Type**: Technical Debt  
**Severity**: Medium
**Status**: Partially fixed

**Description**: `listing_records` has TEXT columns for prices/quantities (`startPrice`, `quantity`). `Phase3PriceTypesMigration` added numeric columns (`startPriceNum`, `quantityNum`). Application should prefer `*Num` columns.

**Suggested Fix**: Confirm all code uses `*Num` columns, plan migration to drop TEXT columns.

### R7: Missing Foreign Keys

**Type**: Technical Debt  
**Severity**: Medium
**Status**: Historical issue

**Description**: Some tables lack FK constraints: `listing_revisions` → `listing_records`, `order_items` → `orders`, `sales_records`, `inventory_events` → `inventory_ledger`. Risk of orphaned rows and data integrity issues.

**Suggested Fix**: Audit all entity relationships, add missing FK constraints via migration, clean up orphaned data.

### R8: Weak Tenant Isolation

**Type**: Security Concern  
**Severity**: High  
**Status**: Confirmed

**Description**: `organizationId` columns added but row-level enforcement is inconsistent. Risk of data leakage between organizations.

**Suggested Fix**: Check all service methods filter by `organizationId`, verify repository queries include org filter, test cross-org data access.

### R11: Dual Channel Tables

**Type**: Technical Debt  
**Severity**: Medium
**Status**: In progress

**Description**: Two channel mapping tables: `channel_listings` (deprecated) and `listing_channel_instances` (new). `Phase3DeprecateChannelListings` started consolidation.

**Suggested Fix**: Verify code uses new table, complete data migration, drop old table.

### R12: Non-eBay Channels are Scaffolding

**Type**: Risk  
**Severity**: Medium
**Status**: Confirmed

**Description**: Shopify/Amazon/Walmart integrations are scaffolding only. eBay is the only fully-developed channel. Risk of user confusion and incomplete features.

**Suggested Fix**: Complete implementations or hide/disable UI.

---

## Low Priority Issues

### R4: Catalog CSV Import OOM

**Type**: Risk  
**Severity**: Medium
**Status**: Mitigated

**Description**: Large CSV imports can cause out-of-memory errors. Mitigated with `NODE_OPTIONS=--max-old-space-size=8192` in Docker and concurrency caps.

### R5: Migration Failure on Boot

**Type**: Risk  
**Severity**: High  
**Status**: Mitigated

**Description**: Auto-run migrations on boot can fail and block startup. Mitigated with `migrationsTransactionMode: 'each'` and health checks.

### R13: Uncommitted Working Tree

**Type**: Risk  
**Severity**: Medium
**Status**: Needs triage

**Description**: Large number of modified files in working tree (per `git status` snapshot 2026-05-29). Risk of lost work and merge conflicts.

**Suggested Fix**: Review, commit in coherent chunks, document what each commit contains.

### R14: Legacy Branding Inconsistency (Resolved)

**Type**: Bug  
**Severity**: Low  
**Status**: Confirmed

**Description**: The application previously showed inconsistent RealTrackApp/ListingPro names across the shell, login, and client settings.

**Resolution**: Standardized all user-facing branding on "Omni Core". The internal database identifier remains `listingpro` for compatibility.

### R15: Documentation Drift

**Type**: Risk  
**Severity**: Medium
**Status**: Ongoing

**Description**: Documentation can drift from code over time. Mitigated by Continuous Documentation Protocol in CLAUDE.md/AGENTS.md.

---

## Local environment issues found 2026-09-28

- **Local S3 key invalid.** The `AWS_ACCESS_KEY_ID` in `backend/.env` (same value in the local `realtrackapp-backend-1` container) is rejected by AWS: "The AWS Access Key Id you provided does not exist in our records"; `HeadBucket` returns 403. Local photo uploads, Fashion size-chart and banner images cannot be stored until a valid key is configured.
- **Local database missing `stores.vertical_config`.** The local Docker backend's `published-listings-sync` jobs fail with "column Store.vertical_config does not exist" — the local `listingpro` database's last applied migration is `1789200000000`, so every later migration (including `1790300000000-AddProductVerticals`) is missing.

## Risk Matrix Summary

| Risk | Likelihood | Impact | Priority |
|------|-----------|--------|----------|
| R1: Double /api prefix | Medium | Medium | Critical |
| R2: Low test coverage | High | High | Critical |
| R3: Default secrets | Medium | High | Critical |
| R3b: DEBUG JWT logging | High | High | Critical |
| R8: Weak tenant isolation | Medium | High | High |
| R9: No JWT revocation | Medium | Medium | High |
| R10: eBay OAuth fragility | Medium | High | High |
| R6: TEXT price columns | Medium | Medium | Medium |
| R7: Missing FKs | Medium | Medium | Medium |
| R13: Uncommitted work | Medium | Medium | Medium |
| R4: CSV OOM | Medium | Medium | Low (mitigated) |
| R5: Migration failure | Low | High | Low (mitigated) |
| R11: Dual channel tables | Low | Medium | Low |
| R12: Non-eBay scaffolding | Medium | Medium | Low |
| R14: Legacy branding inconsistency | High | Low | Resolved |
| R15: Doc drift | High | Medium | Ongoing |

---

*Last updated: 2026-06-11. Reorganized: 2026-06-06.*
**Production verification**: The exact failed target for SKU `FEBI-103451` was
repaired from category `177983` (Motorcycle & Scooter Parts → Radiators) to
live Car & Truck Motors category `33601` (`Coolant Hoses`) in both source
tables. The rebuilt backend corrected the existing offer and the targeted retry
succeeded with listing `206532194968`; eBay read back category `33601` and all
9 compatibility rows. The offer used the account’s enabled UAE location
(AE_Sharjah, UAE), which the account has confirmed is acceptable.

## R29: eBay vertical pilot requires migration and sandbox validation

**Type**: Operational / rollout risk
**Severity**: Medium
**Status**: Open — pilot scaffolding only

The additive vertical schema migration `1790300000000-AddProductVerticals` has
not been run by this change, and no live eBay publish was attempted. Before a
production pilot, review/apply the migration through change control, enable the
`multi_vertical_catalog` flag only for a sandbox or approved pilot store, and
read back category metadata, Inventory API offers, and item groups. Legacy
cross-vertical global SKU/UPC uniqueness can still reject a database insert;
duplicate detection is scoped by organization and vertical but does not remove
that historical constraint.

**Files**: `docs/architecture/EBAY_VERTICALS.md`, `backend/src/migrations/1790300000000-AddProductVerticals.ts`
