# Decision log

**Last reviewed:** 2026-09-29

Running log of non-obvious decisions, workarounds, and their reasons. Newest first.
Add an entry whenever a change is driven by something that isn't obvious from the
code alone (a past incident, an external constraint, a workaround for a broken
dependency).

This is a lightweight, chronological companion to the older ADR-style records in
[docs/decisions/](decisions/) (currently just `0001-documentation-as-project-memory.md`)
and the narrative log in [docs/context/DECISION_LOG.md](context/DECISION_LOG.md). Use
this file for quick day-to-day entries; promote something to a full ADR only if it
needs that level of ceremony.

## 2026-11-13 — Catalog "Newest" means date added; Fashion shows "Date updated"

- **Why:** `applySort` in `catalog-workspace.service.ts` had no `newest` branch, so the default catalog order, the "Newest" Sort option and "Date added" all fell through to `updatedAt DESC`. After the 2026-11-13 Fashion export merge touched ~5,400 rows, "Newest" showed old items that had just been updated, and there was no way to see when a row last changed.
- **Decision:** `newest` orders by `createdAt DESC`; `updated` keeps `updatedAt DESC`. This changes the default order of every vertical's catalog, which now matches its "Newest" label.
- **Decision:** Only the Fashion catalog gets a "Date updated" column (`showUpdatedColumn` in `CatalogResultsTable.tsx`); other verticals were not asked for it. The API already returned `updatedAt`, so no backend change was needed for the column.
- **Note:** neither `created_at` nor `updated_at` is indexed on `catalog_products`; the new sort costs the same as the old one.

## 2026-11-12 — eBay reconnect updates the existing connection; seller identity is proven, not assumed

- **Why:** Reconnecting Artistic Haul would have created a second "Artistic Haul" store, orphaning the old account's 43,388 listing mirrors, warehouse link and policies. Every native connection also had an `unknown_<ms>` seller ID because the Identity API was called on the wrong host, so nothing could tell whether the eBay login was the right seller.
- **Decision:** Reconnect re-authorizes the same `connected_ebay_accounts` row (and its store/connection) in place. "Connect a seller" still creates a new store.
- **Decision:** The callback refuses to attach tokens unless the login is provably the same seller: equal real seller IDs, or (placeholder ID) at least one cached business-policy ID visible to the new token. With neither available it fails closed; the operator can connect a new store instead. Policy IDs are seller-unique, which is why they are an acceptable proof.
- **Revisit when:** all connections carry real seller IDs, at which point the policy fallback can go.

## 2026-11-11 — Fashion re-imports enrich, never erase; publish-ready data stays human-approved

- **Why:** Two thin re-imports of the Fashion Story winter export (`e9c9a227`, `ab949120`) mapped only 9 columns. Every row matched an existing product by SKU, and the update wrote `null`/`[]`/`{categoryFamily}` over images, brand, category, condition, description and the source-export attributes saved a day earlier.
- **Decision:** For the Fashion vertical, import updates drop empty values and merge `vertical_attributes` over the existing object (`importUpdateWithoutBlankOverwrites`, `csv-import.processor.ts`). Clearing a field is an editor action. Other verticals keep their old behaviour until someone decides it for them.
- **Decision:** A re-import that must refresh Fashion photos uses the Artistic Server export columns (`Channel Id`, `Marketplace Id`, `Item Specifics`, `Measurements` + source ID/account). Only `_sourceFormat = 'artisticserver-fashion-export'` products get their images re-copied on *update*; generic rows are mirrored only on insert.
- **Decision:** Apparel pre-owned grades (2990 Excellent / 3010 Fair) have no support in `mapCondition`/`pickSupportedConditionId`, and a bare `2990` would fall through to `condition ?? 'NEW'`. Imports map every pre-owned grade to `3000` ("Pre-owned - Good" in apparel), which never overstates condition. Adding 2990/3010 is open.
- **Decision:** Imports never set authenticity approval (`fashion_reviews.authenticity_confirmed`); data preparation stops at "draft with no other blockers".
- **Exception, operator-directed:** For the 557 Fashion Story items the operator explicitly instructed Claude to sign off authenticity itself without human review. Claude reviewed every item's photos, approved 537 and held 20 (one confirmed counterfeit). Each approval is marked in `fashion_reviews.notes` as a remote AI photo review without physical inspection, so it can be told apart from a human review. See `docs/operations/FASHIONSTORY_WINTER_PHOTO_REVIEW_2026-11-11.md`. This does not change the default.

## 2026-11-11 — Fashion re-imports enrich, never erase; publish-ready data stays human-approved

- **Why:** Two thin re-imports of the Fashion Story winter export (`e9c9a227`, `ab949120`) mapped only 9 columns. Every row matched an existing product by SKU, and the update wrote `null`/`[]`/`{categoryFamily}` over images, brand, category, condition, description and the source-export attributes saved a day earlier.
- **Decision:** For the Fashion vertical, import updates drop empty values and merge `vertical_attributes` over the existing object (`importUpdateWithoutBlankOverwrites`, `csv-import.processor.ts`). Clearing a field is an editor action. Other verticals keep their old behaviour until someone decides it for them.
- **Decision:** A re-import that must refresh Fashion photos uses the Artistic Server export columns (`Channel Id`, `Marketplace Id`, `Item Specifics`, `Measurements` + source ID/account). Only `_sourceFormat = 'artisticserver-fashion-export'` products get their images re-copied on *update*; generic rows are mirrored only on insert.
- **Decision:** Apparel pre-owned grades (2990 Excellent / 3010 Fair) have no support in `mapCondition`/`pickSupportedConditionId`, and a bare `2990` would fall through to `condition ?? 'NEW'`. Imports map every pre-owned grade to `3000` ("Pre-owned - Good" in apparel), which never overstates condition. Adding 2990/3010 is open.
- **Decision:** Imports never set authenticity approval (`fashion_reviews.authenticity_confirmed`); data preparation stops at "draft with no other blockers".
- **Exception, operator-directed:** For the 557 Fashion Story items the operator explicitly instructed Claude to sign off authenticity itself without human review. Claude reviewed every item's photos, approved 537 and held 20 (one confirmed counterfeit). Each approval is marked in `fashion_reviews.notes` as a remote AI photo review without physical inspection, so it can be told apart from a human review. See `docs/operations/FASHIONSTORY_WINTER_PHOTO_REVIEW_2026-11-11.md`. This does not change the default.

## 2026-11-09 — READY means publish-ready: the listing builder's checks run in dry runs too

- **Decision:** a listing reaches READY only when it passes the photo and text checks and the listing builder's publish checks (condition, measurement units, store policies). The builder runs read-only, so dry runs never write to eBay.
- **Why:** the first 200-listing dry run reported 153 READY. A live attempt on 8 of them failed in the builder. All 153 lacked a condition and 152 needed a measurement-unit check. The dry run never ran those checks, so READY overstated what could publish.
- **Rejected:** treating the builder's errors as a live-only problem. Dry runs then keep reporting listings that can't publish.

## 2026-11-09 — Batch publish keeps the human authenticity gate; a reviewer confirms once per batch

- **Decision (user, 2026-11-09):** a live "Publish next N" batch must be started by a user with `fashion.review` + `fashion.authenticity.review` who ticks one confirmation. Listings in that batch that pass compliance (PASS/AUTO_FIXED) are approved in `fashion_reviews` under that reviewer's ID. NEEDS_REVIEW items need individual approval; BLOCKED items cannot be approved.
- **Rejected:** treating a compliance PASS as approval with no human (removes the documented gate in `SECURITY.md`); per-listing approval for every item (defeats the single-click batch).
- **Fix policy:** auto-fixes only make a listing more accurate: removing filler words, removing extra brand names when the real brand is in the title, filling an obvious Brand specific, and dropping watermarked or off-product photos. Phrases like "inspired by" or "dupe" are never auto-removed, because removing them would disguise a possible dupe; they go to review. Replica wording, a logo mismatch and below-floor prices on protected brands block publishing.
- **Images:** the eBay master is a JPEG for the widest compatibility; eBay also accepts WEBP, PNG and others. Masters are uploaded to EPS from S3 bytes, so the bucket stays private. Production has no CloudFront.
- **Vision model:** reuses the Jev-chosen Fashion models (2026-10-07) as defaults; `FASHION_COMPLIANCE_MODEL` overrides. Not yet benchmarked for counterfeit signals.

## 2026-11-07 — Auto Parts catalog filters by vertical on the server, not in the page

- **Why:** The Auto Parts catalog reads `/listings/search` and `/listings/summary`, which were not filtered by vertical. Fashion and Business & Industrial listing records appeared under Auto Parts, and in its totals. The earlier vertical scope existed only in uncommitted work.
- **Decision:** Listing search, facets and summary take an optional `vertical`, applied through `listingVerticalFilter()`. `automotive` also matches NULL-vertical legacy rows, the same rule as the automotive scope. Only the Auto Parts catalog sends it. Pages that omit it see unchanged results, so Business & Industrial, pipeline and stock keep working.
- **Revisit when:** Each vertical gets its own listing endpoint. Then the parameter can be removed.

## 2026-11-07 — Placeholder UPCs are not identifiers; UPC matching is global

- **Why:** Fashion import `8ea9d3f4` (eBay active-listings export, 5,465 rows) failed on its first batch with `idx_catalog_upc`. The export puts `Does not apply` in `P:UPC`, and production `catalog_products` already held a legacy row with `upc = 'Does not apply'` (no org or vertical). The unique index is global, not scoped by organization/vertical, but the batch duplicate check only scoped SKU/MPN/title and had no UPC layer.
- **Decision:** `normalizeCatalogUpc()` (`backend/src/catalog-import/utils/catalog-identifiers.ts`) maps blank and placeholder values (`does not apply`, `n/a`, `na`, `none`, `null`, `-`) to null. Duplicate keys and `catalog_products.upc` use the normalized value. `ListingRecord.pUpc` keeps the raw value because eBay expects `Does not apply` there.
- **Decision:** UPC is checked first in `checkDuplicateBatch`, without org/vertical scope. An in-scope match updates the owning product. An out-of-scope match is skipped as `duplicate_skipped` (`upc_outside_scope`), because neither insert nor update can write a UPC the index already holds.
- **Not done:** The legacy production row `catalog_products` with `upc = 'Does not apply'` (sku `BLA-00021`) was left unchanged. Nulling it is a data change and needs approval.
## 2026-10-27 — Parts Search: a picked part opens its option list; details are a modal, not a route
**Decision:** Choosing a part in the typeahead runs the options search for that part's number (`?q=<MPN>&focus=<id>`) and highlights the part, rather than navigating to `/parts-search/parts/:id`. Clicking an option opens `PartDetailDialog` (component state, not a URL) over the list; the part page remains for deep links and ctrl/cmd-click.
**Why:** Staff sell whatever is available, not one listing. A single part page hid the exact duplicates, superseded and equivalent parts, and the stock of each. Keeping the modal out of the URL means opening and closing it never refetches the options (the query key is built from the search params without `focus`), so the list, its scroll position and expanded groups survive.
**Revisit when:** staff need to share a link to "this list with this part open"; then add a `part` param that is excluded from the query key.

## 2026-10-27 — Part image downloads go through the API, addressed by part + index
**Decision:** Portal image downloads are served by Omni Core (`/api/parts-search/parts/:id/images/:index/download`, `…/images/zip`) rather than by linking the browser to image URLs. The request names only a part and an index; the server takes the URL from part data and picks the best copy:
- **Our S3 bucket:** the original object, read with `StorageService`.
- **eBay:** the 1600 px rendition, or the stored size on 404.
- **Other hosts:** the stored URL, with the remote-fetch controls described in RBAC_AND_SECURITY.

**Why:** Our bucket is private, browsers ignore `download` on cross-origin links, and accepting arbitrary URLs would turn the endpoint into an open proxy into the server's network. `StorageService` was not modified because production's compiled copy may differ from `main` (layered images).

**Revisit when:** images move to a public CDN, or bulk exports beyond 30 images per part are needed.

## 2026-10-27 — "Every sellable option": our stock is its own entry; demand = nothing sellable
**Decision:**
1. **Omni Core stock** (automotive `inventory_items` with a catalogue product) is matched to results by normalized MPN/OEM number. It is shown as its own "In our warehouse" group, plus a badge on PartsBazar360 rows with the same number. It never changes a PartsBazar360 row's availability or visibility.
2. **Visibility:** Omni Core always asks PartsBazar360 for unavailable parts and hides them itself after the merge.
3. **Demand:** a search is logged as demand when it has no results, or no in-stock option from either source.
4. **Fallback:** without the internal key, `/parts-search/results` falls back to the buyer view rather than failing.

**Why:**
- *Separate entry:* a first version attached our single GM hinge to all 20 exact listings, making 16 ended listings from other sellers look sellable.
- *Demand definition:* "no stock" (not just "no results") is what loses a sale.
- *Fallback:* the Omni Core release can precede key setup.

**Revisit when:** Omni Core stock gains part-number links to PartsBazar360 parts (then attach precisely instead of by number), or procurement needs notifications instead of the demand page.

## 2026-10-26 — Parts Search portal: own route, Auto Parts permission, server-side proxy, separate read key
**Decision:** (1) The portal lives inside Omni Core at `/parts-search`, a sibling of the
workspaces with its own shell, instead of a separate app with SSO — same origin means the
existing `localStorage` JWT already is the single sign-on. (2) It is gated on
`dashboard.view`, not a new permission. (3) The browser never calls PartsBazar360; the
`parts-search` backend module proxies it, validates params against PartsBazar360's bounds,
caches in Redis and rate-limits per user. (4) Internal data (every offer, seller, source,
stock) comes from a new key-guarded PartsBazar360 endpoint
(`/api/integrations/realtrack/search`) with its own secret
(`PARTSBAZAR360_SEARCH_API_KEY` ↔ `REALTRACK_SEARCH_API_KEY`), not the publish key.
(5) If the internal endpoint answers 401/403/404/503 the portal falls back to public
search and says so (`meta.internalUnavailableReason`); timeouts and 5xx are a 503.
**Why:** (2) `RbacService.syncFromRegistry` never updates roles with `isCustomized = true`,
so a new permission would silently lock edited roles out while they keep Auto Parts.
(4) The read key exposes data the public search hides; keeping it separate lets it be
rotated or revoked without touching publishing. (5) The Omni Core change can ship before
the PartsBazar360 deploy without a blank portal, while a real outage still reads as one.
**Revisit when:** the portal needs to differ from Auto Parts access (then add
`parts_search.access` plus a migration granting it to every role that holds
`dashboard.view`), supplier identity must be hidden from `viewer`-type roles, or Omni
Core's own catalogue/stock is merged into the results (org scoping via
`AutomotiveAccessScopeService` then applies).

## 2026-10-07 — Fashion vision model chosen by Jev from a labelled benchmark; aspects use eBay names only

**Model.** Fashion identification now defaults to `google/gemini-3.1-flash-lite`, with
`google/gemma-4-31b-it` as an automatic fallback (`FASHION_AI_MODEL` /
`FASHION_AI_FALLBACK_MODEL`, `none` disables the fallback). Previously Fashion fell
through to the shared vision route (`OPENAI_VISION_MODEL`).

- Benchmark: 5 real garments with known ground truth (Hugo Boss knit polo L; Hugo Boss
  merino polo L; Patagonia women's 100% merino cardigan L; Lacoste sweater size "4" with
  no composition label; L.L.Bean women's 100% wool cardigan with a rotated "LG" label).
  20 OpenRouter vision models, the production prompt, 2048px WebP like the upload
  pipeline, up to 3 runs each, scored on brand/size/department/colour/type/material plus
  "did not invent" checks (composition, care, country).
- Decision made by **Jev** (`~typesafe/jev-latest` via OpenRouter `/alpha/decisions`, the
  same contract as `scripts/image-source-ebay.mjs`) from the aggregated evidence:
  primary gemini-3.1-flash-lite at probability 0.96 (no misses in 5 runs, 100% strict
  JSON, ~$1.2-1.7 per 1,000 items, 4-10 s). Fallback gemma-4-31b-it was a low-confidence
  pick (0.29): it omits fields (department once) rather than misreading labels.
- Rejected: gemini-2.5-flash (read Patagonia "L" as "S" on prompt v2, ~44 s p50 on v1);
  gpt-4.1-mini (read "LG" as "O LONG"); gpt-6-luna (read "LG" as "L/G" in 2 of 3 runs);
  gpt-6-luna-pro (read "100% WOOL" as "100% Acrylic" in 2 of 3 runs on prompt v2);
  qwen3-vl-32b and qwen3.7-flash (invented composition); gpt-5-nano and
  `typesafe/jev-router` (reasoning exhausted the 2,500-token budget, truncated JSON);
  claude-haiku-4.5 (never strict JSON, 5x cost).
- Re-run the benchmark before changing the default; models that rank higher on general
  leaderboards misread labels here.

**Pipeline gaps fixed in the same change.**
- A non-JSON or token-truncated reply used to be reported as `status: suggested` with
  every field empty. Replies are now parsed leniently (`sanitizeJson`); empty or
  `finish_reason=length` replies count as failures and trigger the fallback.
- `reviewPhotoSet` comes only from `multipleDifferentItems`. The primary model set it on
  5 of 15 single-garment sets, which showed the "more than one garment" alert.
- AI titles are capped at 80 characters on a word boundary at analysis time (models
  returned up to 106). Before, eBay publish silently cut the approved title.
- `fashionAspectsFromAttributes` publishes eBay item-specific names only. It previously
  also sent every unmapped attribute under its raw key (`itemType`, `chestMeasurement`,
  `categoryFamily`, `stains`, `conditionDetails`...), duplicating Type and pushing
  measurements and defect notes into specifics, where values over 65 characters fail the
  publish. Defects stay in the description.
- Autofill: new "Listing details" fields (country of manufacture, features, season,
  occasion, theme, vintage, garment care) and prompt rules for `sizeType`, department
  values and condition. Average autofilled fields per item rose from 16.6 to 21.0 on the
  benchmark set with no invented materials or care.

## 2026-10-07 — eBay publish safety gates relaxed earlier and found by stale tests

Realigning `ebay-publish.service.spec.ts` turned up two deliberate relaxations
that were in the code but not in the docs:

- **Motors fitment gate (`a7b1b9f0`, 2026-07-12).** A fitment-capable Motors category
  with no structured compatibility rows now publishes with description-only
  fitment and a warning ("Run optimization to add structured compatibility").
  Before this, publish was blocked. Any stale structured rows are still cleared
  through `EbayCompatibilityReconciliationService.syncInventory`.
- **Named policy profiles (`e7de0fed`, 2026-08-08).** If a requested
  shipping, payment or return profile name doesn't exist on the target store,
  publish uses that marketplace's default policy (with a warning). This lets
  cross-store publishes to another account, such as `EBAY_DE`, use that account's
  own policies. Publish is still blocked when no default policy is set.

Unchanged and still fail-closed: SKU ownership, where the conflict-safe alternate
must also pass `assertRemoteSkuOwnership`; compatibility readback; UAE-only
merchant locations; and the 25713 recovery. Since 2026-09-30, 25713 is recovered
only on the mapped-channel revise path, after eBay confirms the listing ended.
**Revisit when:** listing quality or shipping-cost complaints point at
description-only fitment or default-policy fallbacks. Both are product decisions,
not bugs.

## 2026-10-07 — Fashion vision model chosen by Jev from a labelled benchmark; aspects use eBay names only

**Model.** Fashion identification now defaults to `google/gemini-3.1-flash-lite`, with
`google/gemma-4-31b-it` as an automatic fallback (`FASHION_AI_MODEL` /
`FASHION_AI_FALLBACK_MODEL`, `none` disables the fallback). Previously Fashion fell
through to the shared `OPENAI_VISION_MODEL` (`google/gemini-2.5-flash`).

- Benchmark: 5 real garments with known ground truth (Hugo Boss knit polo L; Hugo Boss
  merino polo L; Patagonia women's 100% merino cardigan L; Lacoste sweater size "4" with
  no composition label; L.L.Bean women's 100% wool cardigan with a rotated "LG" label).
  20 OpenRouter vision models, production prompt, 2048px WebP like the upload pipeline,
  up to 3 runs each, scored on brand/size/department/colour/type/material plus
  "did not invent" checks (composition, care, country).
- Decision made by **Jev** (`~typesafe/jev-latest` via OpenRouter `/alpha/decisions`, the
  same contract as `scripts/image-source-ebay.mjs`) from the aggregated evidence:
  primary gemini-3.1-flash-lite at probability 0.96 (no misses in 5 runs, 100% strict
  JSON, ~$1.2-1.7 per 1,000 items, 4-10 s). Fallback gemma-4-31b-it was a low-confidence
  pick (0.29): it omits fields (department once) rather than misreading labels.
- Rejected: gemini-2.5-flash (read Patagonia "L" as "S" on prompt v2, ~44 s p50 on v1);
  gpt-4.1-mini (read "LG" as "O LONG"); gpt-6-luna (read "LG" as "L/G" in 2 of 3 runs);
  gpt-6-luna-pro (read "100% WOOL" as "100% Acrylic" in 2 of 3 runs on prompt v2);
  qwen3-vl-32b and qwen3.7-flash (invented composition); gpt-5-nano and
  `typesafe/jev-router` (reasoning exhausted the 2,500-token budget, truncated JSON);
  claude-haiku-4.5 (never strict JSON, 5x cost).
- Re-run the benchmark before changing the default; models that rank higher on general
  leaderboards misread labels here.

**Pipeline gaps fixed in the same change.**
- A non-JSON or token-truncated reply used to be reported as `status: suggested` with
  every field empty. Replies are now parsed leniently (`sanitizeJson`); empty or
  `finish_reason=length` replies count as failures and trigger the fallback.
- `reviewPhotoSet` comes only from `multipleDifferentItems`. The primary model set it on
  5 of 15 single-garment sets, which showed the "more than one garment" alert.
- AI titles are capped at 80 characters on a word boundary at analysis time (models
  returned up to 106). Before, eBay publish silently cut the approved title.
- `fashionAspectsFromAttributes` publishes eBay item-specific names only. It previously
  also sent every unmapped attribute under its raw key (`itemType`, `stains`,
  `conditionDetails`...), duplicating Type and pushing defect notes into specifics, where
  values over 65 characters fail the publish. Defects stay in the description.
- Autofill: new "Listing details" fields (country of manufacture, features, season,
  occasion, theme, vintage, garment care) and prompt rules for `sizeType`, department
  values and condition. Average autofilled fields per item rose from 16.6 to 21.0 on the
  benchmark set with no invented materials or care.

## 2026-10-05 — Warehouse stock: one ledger, absolute channel pushes, shadow mode, sell-before-you-own
**Decision:**
1. A new `stock` module and `/api/stock` prefix were added, rather than extending `inventory/`.
2. `stock_movements` (append-only) is the source of truth, and `stock_levels` is a projection that `StockLedgerService` alone writes, using READ COMMITTED plus ordered `FOR UPDATE`.
3. Channels are always sent the absolute computed quantity. Pushes are gated by a global flag and a per-store switch, both off by default.
4. SKUs have a `sourcing_mode`. Order shortfalls become procurement requests instead of failing. Goods received against a PO are reserved for the waiting order.
5. Vertical modules talk to stock only through events.
6. Users with no warehouse assignments see every warehouse.

**Why:**
1. `inventory/` is the 2,900-line Auto Parts enrichment workbench; mixing stock into it would collide with the naming and the permissions.
2. Its old ledger was never written by imports or orders. SERIALIZABLE retries badly under bulk receiving, and ordered row locks were proven correct by a last-unit race test.
3. Deltas drift when eBay has already decremented a sale we have not imported yet. Live quantities must not change until shadow numbers have been reviewed.
4. Many Auto Parts listings (FEBEST/NAPA catalog parts) are sold before they are bought. "Not on hand" is a normal state, not an error.
5. This avoids circular Nest module imports and keeps intake working when stock is not set up.
6. This avoids repeating the 2026-09-15 B&I `AND 1 = 0` empty-scope failure.

## 2026-09-29 — Publish to PartsBazar360 is a push channel with no adapter, and the receiver reuses the pull pipeline
**Decision:** (1) `partsbazar360` is a channel that *pushes* to PartsBazar360's authenticated
`/integrations/realtrack/listings` endpoint, authenticated by a server-side shared secret
(`PARTSBAZAR360_API_KEY`), not per-user OAuth tokens. (2) It is not registered as a
`ChannelAdapter`; `ChannelsService` routes it to `PartsBazar360Service` at the few places that
would need an adapter (test, end, inventory sync). (3) Channel demo mode does not apply to it.
(4) Bulk inventory sync is a no-op for this channel. (5) Only MVL-validated fitment is sent.
(6) `publish-multi`/`bulk-publish` accept an optional `storeId`, and the publish job now honors it.
**Why:** (1) There is one trust relationship (RealTrack → its own marketplace), and a per-user
token would just be a copy of a secret we already hold. (2) `syncConnectionInventory` sends a
placeholder quantity of 1 for every instance and `ChannelsService.publishListing` short-circuits
to a *simulated* publish while `CHANNEL_DEMO_MODE` is on (its default) — either would silently
corrupt or fake a real storefront. (4) Same reason. (5) Matches what eBay publish already refuses
to send; the receiver has its own lower-confidence title inference when we send `null`.
(6) Several PartsBazar sellers can be linked, and "latest connection wins" would publish to the
wrong one; the eBay branch of the job previously ignored any store choice, so the id is now
passed through for both.
Also: photos are resolved to RealTrack's public serve URL after an S3 existence check (exact key, else
`.webp`), and `temp/` keys are skipped — found when the first real listing had 12 photos that no longer
existed, and the rest stored `.jpg` names for objects that are `.webp`.
Later the same day: external photos are mirrored to S3 as WebP rather than hot-linked (NAPA Canada returned
403 to servers and hot-linked third-party URLs can vanish), and a listing with no obtainable photo is
taken off the storefront rather than shown imageless.
**Revisit when:** PartsBazar360 needs per-listing stock/price push on edit (currently re-publish),
or a second push destination appears — at that point extract a shared "push channel" base rather
than copying `PartsBazar360Service`.

## 2026-09-28 — Fashion quick capture: measurements stay out of item specifics; photo roles keyed by URL; warehouse is a label
**Decision:** (1) Garment measurements are published in the description and a generated
size-chart image, never as eBay item specifics; `categoryFamily` and chart metadata were also
removed from specifics. (2) `_photoRoles` stores `role:url` entries instead of a list parallel
to `imageUrls`. (3) Intake warehouses are recorded on the item only and do not change the eBay
merchant location at publish. (4) Background identification re-merges onto the latest saved
draft and treats the `Pending identification — <SKU>` placeholder as unconfirmed.
**Why:** (1) Every non-`_` attribute used to become a custom specific (`chestMeasurement: 38`),
which is noise to buyers and wastes the specifics limit. (2) The shared catalog quick view
reorders `imageUrls` without knowing about slots; a positional list would silently mislabel
photos. (3) Publish location logic in `integrations/ebay` is a risky area with live-API
consequences and a separate UAE location policy. (4) Operators may open and save a captured
draft before the job finishes; saving must not lock in the placeholder or lose AI suggestions.
**Revisit when:** A warehouse→merchant-location mapping is requested, or eBay adds structured
measurement aspects for apparel categories.

## 2026-09-24 — CSV-pipeline enrichment (fitment/images/price) requires a separate DB-persist step; price had never been wired up
**Decision:** Confirmed and documented that `pricing-retry-local.sh` and the CSV `--apply`
scripts (`napa-official-apply.mjs`, `seo-content-apply.mjs`, etc.) only ever update files under
`output/ebay-pipeline/` on the server — never the database. Getting the live app
(`catalog_products`, `listing_records`) to reflect a change requires running the matching
`persist-*-sql.mjs` script afterward. Added `scripts/persist-napa-official-sql.mjs` (fitment +
images sourced from NAPA's own site — `persist-fitment-sql.mjs` only accepts eBay-compatibility
provenance) and `scripts/persist-napa-pricing-sql.mjs` (price — no script wrote this before).
**Why:** A user report ("changes not visible on the live catalog page") traced back to this gap:
190 image/fitment rows and 7 NAPA-priced rows had been pushed to the server's CSV files and
looked complete in every pipeline report, but none of it — and, it turned out, no row's price at
all, from any source — had ever reached the database. `catalog_products.price` and
`listing_records.startPrice`/`startPriceNum` were unset for the whole catalog.
**Revisit when:** If a new enrichment field is added to the CSV pipeline (beyond fitment, title/
description, image, price), check whether it also needs a `persist-*-sql.mjs` counterpart before
assuming a CSV `--apply` run makes it live. Consider whether `pricing-retry-local.sh` should call
the relevant persist script automatically as its last step, now that this has bitten once.

## 2026-09-23 — NAPA-site CAD prices are converted with a cited live FX rate, never applied raw or silently dropped
**Decision:** `scripts/napa-price-apply.mjs` converts napacanada.com's displayed retail price
(CAD) to USD using a live rate fetched at apply time (never hard-coded), and records the exact
rate, source, and fetch time in `Pricing Notes` for every row. The result is written with
`Pricing Method: napa_official_site_cad_fx_converted`, `Pricing Confidence: low`, and
`Pricing Status: pricing_estimated_msrp` (reusing the existing status for a manufacturer-site
estimate rather than a direct market comparable) — additive only, never overwriting a row that
already has any pricing status besides `pricing_pending`.
**Why:** `price-web-research.test.mjs` already has a deliberate rule that a CAD price is not a
valid USD price (retail pricing doesn't track 1:1 with FX conversion), so writing the raw CAD
number into the USD-only `Recommended Price`/`List Price` columns would silently misprice
listings by ~30%. But NAPA's own product pages are the only source found (after Luna web search
and eBay Browse both failed, see `docs/operations/CATALOG_PIPELINE.md`) that carries a genuine
retail price for any of the 639 un-priced Napa rows — refusing to use it at all would throw away
real, if imperfect, evidence. A cited, live conversion with reduced confidence is the middle
ground: usable, but never mistaken for a native USD comparable.
**Revisit when:** If a Canadian-dollar eBay store or listing surface is ever added to this
pipeline, these rows' `Pricing Method` should be checked — they may need re-deriving without the
FX step. If `napa_pricing_evidence.json`'s schema changes, `pricingColumns()` in
`price-enrich-catalog.mjs` (reused directly by the applier, not reimplemented) is the single
place that shape is defined.

Format:
```
## YYYY-MM-DD — Short title
**Decision:** what was decided/done.
**Why:** the constraint or incident that drove it.
**Revisit when:** condition under which this should be reconsidered (optional).
```

---

## 2026-09-21 — Evidence must come from listings whose own specifics name our brand and part number
**Decision:** A comparable counts for pricing only if its title names the brand; a listing counts as
fitment evidence only if its item specifics (getItem) name our Brand AND Manufacturer Part Number.
**Why:** Part numbers collide across brands. Measured: 457 of 490 listing rejections were another brand's
product; 85 of 132 priced Napa rows had no NAPA-named comparable; with the guard, fitment accuracy against
validated data rose from 67% to 88.6% and two clearly cross-brand results (NAPA-CU2101, NAPA-37322) were
refused. The price of the guard is coverage: overall yield fell from 47 of 114 rows to 3 (Napa: 0 of 107).
**Revisit when:** a supplier catalog/ePID-level product match replaces title heuristics.

## 2026-09-21 — Use eBay's check_compatibility, not Trading GetItem, for fitment evidence
**Decision:** Fitment is verified through the Browse API `check_compatibility` with the application token.
**Why:** Trading `GetItem` (the full compatibility table) rejects application tokens and would require a
seller's stored OAuth token — a credential to extract, decrypt and move. `check_compatibility` answers the
question we actually need (does this listing fit this vehicle?) with no seller credential.
**Revisit when:** a seller-token workflow already exists for other reasons.

## 2026-09-21 — A part number is necessary but not sufficient evidence of the right product
**Decision:** A Browse comparable counts only if its title also names the brand or enough of the
part type (OE/interchange matches: the part type). Stored results are re-derived offline with
`--refilter`; nothing is re-queried.
**Why:** Substring matching on numeric part numbers priced NAPA parts from LEGO tiles, torque rods and
diecast cars, and 8 of the original 44 "postable" prices were wrong. It was found only because the
newly priced rows were read before being pushed; the earlier 223 had been reported without that check.
**Revisit when:** eBay catalog/ePID matching or Marketplace Insights is available — a structured
product match would replace title heuristics.

## 2026-09-21 — Run pipeline stages off the production host; only copy results onto it
**Decision:** Batch stages (pricing retry, exports) run on another machine against a synced copy
and upload results with `scp` + `docker cp`. The server-side watcher that ran Node inside the
backend container was stopped and deprecated.
**Why:** The host has 3.8 GB and no swap and was already OOM-killing processes on 2026-09-20; two
more kills on 2026-09-21 hit the backend container while ad-hoc `docker exec` jobs (100-250 MB
each) were running. A watcher that would have fired unattended at ~13:30 UTC was a latent
production outage.
**Revisit when:** the host has swap or more RAM and container memory limits, so batch jobs cannot
starve the backend.

## 2026-09-21 — Do not spend credits on web-search fitment/pricing for Napa house-brand parts
**Decision:** Stopped the paid web-research passes after measuring them. Pricing: 0 verified
prices in 143 rows ($3.73). Fitment pilot: 3/10 rows found page-verified applications, all
Mevotech; 0/6 Napa. Captured eBay listing text yielded candidates for 2 of 41 priced rows.
**Why:** The rows nearest to postable are almost all Napa, and NAPA's US pages carry neither
price nor reachable fitment while retailers block scripts. At ~$0.024-0.04/row it would have
spent the shared production credit balance for roughly nothing. Verification (never trusting a
model-quoted number) is what exposed this; without it the same spend would have produced
plausible-looking but unverified data.
**Revisit when:** a supplier ACES/PIES fitment feed or NAPA catalog export is available, or the
Trading-API item-compatibility route (see CATALOG_PIPELINE, "Fitment for the remaining rows") is
built.

## 2026-09-21 — SEO titles: position only when consistent; chassis codes only when real
**Decision:** The title shows a position only if every validated application agrees on it,
and appends only genuine chassis codes (2-4 capitals, or a code with a digit).
**Why:** The previous builder used the first fitment record's position, so SKF BR930071
(Rear on Honda/Acura, Front on Chrysler/Dodge) was titled "Rear". A wrong position in a title is
a fitment claim.

## 2026-09-21 — Web-search pricing treats the model as a page finder and re-verifies every source
**Decision:** `scripts/price-web-research.mjs` asks GPT-5.6 Luna (web search on) to find
priced pages, then re-fetches each cited page and only counts a source whose page shows
the brand + MPN (or UPC) and the price; when the quoted price is absent but the page's
JSON-LD declares one unambiguous USD price, the page's price is used. Statistics and
statuses are computed in code. Unverifiable sources (bot-protected retailers) go to
`manual_pricing_review` with a price hint and are never postable. Rows whose only exact
page is remanufactured become condition conflicts instead of New prices.
**Why:** The provider returns no citations for this model, and the model's quoted prices
were measurably unreliable (SKF GRW25: $97.43 in one run, $94.88 in the next; the page
says $97.43). "Never invent a price without evidence" therefore rules out trusting the
quoted number. Bot protection (403 / Cloudflare challenge) blocks a large share of
retailer pages; bypassing that was rejected, so coverage is bounded by what a script can
legitimately read and the rest is routed to a human with the URLs to click.
**Revisit when:** Marketplace Insights access is granted, or a licensed parts-pricing
feed replaces page scraping — either supplies structured data and makes most of this
verification unnecessary.

## 2026-09-20 — Pipeline pricing uses ACTIVE eBay comparables, and says so
**Decision:** `scripts/price-enrich-catalog.mjs` prices listings from eBay Browse
*active* fixed-price new listings (shipping-inclusive, outlier-trimmed median less
3%), records the method on every row, and never emits
`pricing_verified_exact_match`. Rows without a defensible price stay in the audit
export as `pricing_pending`/`manual_pricing_review` and are blocked from
`partsbazar360-postable-listings.csv`.
**Why:** The pricing methodology asks for sold/completed comparables first, but the
eBay OAuth grant is `buy.browse` only (`ebay-auth.service.ts`); sold comparables
need the Marketplace Insights API, which eBay grants by application and this
account does not hold. Scraping completed-listing pages was rejected — it breaks
eBay's terms with the same credentials the pipeline publishes through. Labelling
active-listing medians as sold-verified would have been the quiet failure mode, so
the status vocabulary makes the gap explicit instead.
**Revisit when:** Marketplace Insights access is granted — then sold comparables
replace the active ones in `buildAttempts`/`browseSearch` and
`pricing_verified_exact_match` becomes emittable without reworking the stage.

## 2026-08-17 — Make eBay publish retries duplicate-aware and source-fallback-safe
**Decision:** Treat an explicit existing-eBay-listing response as a skipped duplicate
when the matching published channel is already recorded, and fall back from a removed
historical source listing to the canonical catalog product when building a job.
**Why:** Durable publish jobs can outlive source-row cleanup, and retrying a listing
that eBay already accepted can create misleading failures or duplicate work.
**Revisit when:** The publish job model gains a first-class idempotency key shared with eBay.

## 2026-08-10 — Published-listings prune uses index-only scan + per-txn timeout (not a global timeout bump)
**Decision:** The `markUnseenActiveAsEnded` prune step runs in its own
transaction with `SET LOCAL statement_timeout = 300s` + `SET LOCAL work_mem = 64MB`,
selects only index-covered columns (`ebay_item_id`) from the new partial index
`idx_epl_active_acct_mp_item (ebay_account_id, marketplace_id, ebay_item_id)
WHERE listing_status = 'active'`, and batch-UPDATEs unseen rows by `ebay_item_id`
via the `uq_epl_account_item` unique index. The global pool `statement_timeout`
stays at 30s (`app.module.ts` `extra.statement_timeout`).
**Why:** On large bloated mirrors (Blackline: 150k active rows across a 1.5GB /
78k-block heap with only the single-column `idx_epl_account`), the old prune
`find()` degenerated into a lossy bitmap heap scan reading 88k blocks (~690MB,
~58s) — exceeding the 30s timeout and aborting the whole sync *after* the 124k-row
upsert loop had finished (every Blackline sync since 2026-08-07 failed at the very
end). Bumping the global timeout was rejected (it would hide slow API queries);
the partial index + index-only scan + transaction-scoped timeout fixes the prune
without weakening the global guard. Production also got a one-off
`VACUUM (ANALYZE, PARALLEL 0)` (reclaimed 86,917 dead tuples; `PARALLEL 0` because
the postgres container has only 64MB shm).
**Revisit when:** If the mirror grows past ~500k active rows and the index-only
scan fallback (visibility-map-stale → ~24s heap fetches) approaches the 300s txn
timeout, either schedule a periodic `VACUUM` of `ebay_published_listings` or
consider `pg_repack` to compact the heap (VACUUM FULL needs an exclusive lock).

## 2026-08-04 — `EbayMvlService` injection made optional in `EbayPublishService`
**Decision:** `backend/src/channels/ebay/ebay-publish.service.ts` injects
`EbayMvlService` as an optional dependency instead of a hard constructor dependency.
**Why:** The two modules (`channels`/eBay and `fitment`/MVL) had a circular
dependency; making the injection optional was the fix (commit `39683f3`).
**Revisit when:** If the `channels` ↔ `fitment` module boundary is ever restructured,
re-check whether this workaround is still needed or can be replaced with a proper
module restructure (e.g. extracting a shared interface).

## 2026-07-23 — Non-Trading writers must never touch `lastSuccessfulSyncAt`
**Decision:** Only the Trading-API sync path may update the published-listings
`lastSuccessfulSyncAt` watermark. Other writers (e.g. policy sync) are hard-gated
from touching it, and self-heal logic checks for watermark drift.
**Why:** Policy sync was stamping `lastSuccessfulSyncAt` ahead of every listing.
Since the reader API filters on that watermark, PartsBazar360's reader endpoints
returned `total: 0` even though the Blackline/SalvageA mirrors held 83,986 / 24,899
real rows — the data was fine, the watermark was lying. See
[docs/context/CURRENT_STATE.md](context/CURRENT_STATE.md) for the full incident
writeup.
**Revisit when:** If another writer needs to legitimately bump this watermark, give
it its own field rather than reusing the Trading-sync one.

---

*(These two entries were backfilled from recent commit history and
`docs/context/CURRENT_STATE.md` when this log was created on 2026-08-06. Keep adding
to it going forward — don't let it go stale.)*
