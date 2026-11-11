# Fashion Story winter listings re-import — 2026-11-11

## Why

The operator imported `fashionstory_winter_listings_part1_detailed.csv` (406 rows)
and `fashionstory_winter_listings_part2_remaining.csv` (501 rows) into the Fashion
vertical on production (`ec2-34-196-184-100`). Imports `e9c9a227` and `ab949120`
auto-mapped only 9 columns (`id`, `sku`, `title`, `price`, `quantity`, `currency`,
`location`, `upc`, `mpn`). The image columns (`all_image_urls`, `image_url`,
`image_1..12`), `specific: *`, `category_*`, `detail_condition` and
`description_html` were not mapped.

Every row matched a product created on 2026-11-10 by
`winter_fashionstory_artisticserver_import.csv` (`faf20c47`), so all 906 rows were
**updates**. The update wrote empty values over images, brand, category, condition,
description and `vertical_attributes` (left as `{"categoryFamily":"clothing"}`).
The catalog showed 906 Fashion drafts with no images.

## Scope chosen with the operator

- Only the 557 rows whose details were fetched (`detail_fetched = yes`: 406 from
  part 1, 151 from part 2). The 350 part-2 rows that carry one thumbnail and no
  condition, specifics or description were skipped at the operator's request and
  remain image-less drafts.
- Fashion vertical, organization `ac9d11b5-59be-4619-bb32-c20b704a39f7` only.

## What the import file contains

`fashionstory_winter_557_import.csv` uses the Artistic Server export columns so the
existing production code (no deploy) auto-maps it and re-copies photos on
**update** (only `_sourceFormat = 'artisticserver-fashion-export'` products are
mirrored on update):

| Column | Source |
|---|---|
| SKU, Title, Price, Currency, Quantity | same columns |
| Id, Listing URL, Status | `item_id`, `url`, `listing_status` |
| Channel Id / Account / Marketplace Id / Marketplace / Site Id | `ebay` / `fashionstory` / `EBAY_US` / `eBay US` / `site_id` |
| Category Id, Category | `category_id`, `category_name` |
| Category Family | from the eBay category (Hats → accessories, else clothing). Title inference made two "Tie Dye" garments accessories |
| Images | `all_image_urls` (3–12 per item, de-duplicated, https only) |
| Item Specifics | every `specific: *` column as a JSON name/value array (Seller Notes moved to the description) |
| Condition / ConditionID | `detail_condition` / `1000` for New and New with tags; `3000` for every pre-owned grade |
| Description | compact HTML (1.8–3.1 KB): details block, item specifics, the listing's About/Condition/Sizing/Returns/Questions/Shipping text. No links, images, fonts or scripts. Store-wide marketing and "every item is authenticated" claims were left out |
| Measurements | empty (the export has none), so no unit review is required |

Condition: RealTrack has no support for apparel IDs 2990/3010, and a bare 2990
falls through to `NEW`. All pre-owned grades use 3000 ("Pre-owned - Good" in
apparel), which never overstates condition. The description still states the
seller's grade (for example "Pre-owned (Excellent)").

### Data corrections and flags

| SKU | Change / flag |
|---|---|
| AV2-1188 (M, item 206648163857) | Shares SKU with the size S item 206688880387; imported as `AV2-1188-M` |
| AV2-1185 | Material `Leather` → `Faux Leather` (title and outer shell say faux). Brand corrected to *4th & Reckless* from the garment label (the specific said *Young & Reckless*) |
| AV2-1205 | Material `Leather` → `Faux Leather` (title says faux leather) |
| FA10-1224 | No brand in the source data; the neck label is NBA, so Brand set to NBA |
| FA8-798-SU | Counterfeit: waistband label reads "SITONG…LAND". Held, not approved |
| FA19 -3221, FA20 -3428 | Same titles as FA19-3221 / FA20-3428 but each carries its own eBay item ID on a second account — cross-listed twins, kept (see "Not done / open") |

Required eBay aspects were fetched read-only from the Taxonomy API for all 38
categories (Brand, Color, Size, Department, Style, Type, Size Type, Outer Shell
Material). Every item has every required aspect. 39 Department values were not on
eBay's selection-only list for the item's category; 36 were corrected (synonyms
such as `Unisex Adult` → `Unisex Adults`, `Men's` → `Men`, or the department the
title states, for example FA22-4126 and FA15-2042 were `Women` on men's items).
The eBay category was never changed. Three items conflict with their category and
need the operator: AVP-MFC-3149-L (men's sweater in Women's Sweaters 63866),
AVP-WSC-3314-L (women's sweater in Boys' Sweaters 51946), FA27-6247 (boys'
sweatshirt in Men's T-Shirts 15687).

The counterfeit-wording screen (replica, fake, inspired by, dupe, 1:1, …) found
nothing in titles, specifics or descriptions. "Authentic" appears only as a
product-line name (Champion "Authentic Athletic Apparel", Wrangler "Authentic
Western").

## Execution log

- Before-images (`0600`, dir `0700`):
  `/home/ubuntu/backups/fashionstory-557-import-2026-11-11/catalog_products_before.jsonl.gz`
  (558 rows) and `fashion_reviews_before.jsonl.gz` (558 rows).
- Import `8824131a` (42 MB file with the 74 KB store template as description)
  exhausted the backend heap (`FATAL ERROR: Reached heap limit`) at 00:42 UTC and
  the container restarted once (~1 minute). It was cancelled and its BullMQ job 23
  moved to failed before any batch committed (0 products, 0 import rows changed).
  The processor reads the whole CSV into memory and holds 250-row batches; large
  per-row HTML multiplies across product, listing, row log and query parameters.
- Import `2d2db734` was created by an accidental second start and cancelled
  before any job was queued.
- Import `9159bff4` (197 KB file, compact descriptions) queued as job 24:
  completed, 556 updated + 1 inserted (`AV2-1188-M`), 0 flagged/skipped/invalid,
  all 557 `_imageMirrorStatus = complete`. Backend peaked at ~520 MB, no restart.
- Import `f3c02aba` (36 rows): Department values corrected to eBay's list.
- Photo review (see [the review record](FASHIONSTORY_WINTER_PHOTO_REVIEW_2026-11-11.md)),
  then import `284a4042` (71 rows): label-evidenced brand fixes, three category
  moves, title/specific facts, damage disclosures, and removal of stock, retailer
  and promotional photos. The store "Verification Process" banner
  (`…/nOYAAeSw9gVqQT8V/$_57.PNG`) was removed from the 15 catalog products that
  had it; no non-deleted Fashion product holds it now.
- Authenticity sign-off for 537 items in one guarded transaction (exactly 537
  qualifying drafts or rollback): `fashion_reviews` approved with
  `authenticity_confirmed = true`, `reviewed_by_user_id` = the operator who gave the
  instruction, note stating it was a remote AI photo review; products set to
  `approved`; 537 `fashion.review.approved` rows in `listing_action_logs`.

## Result

| Set | Count | State |
|---|---|---|
| Approved, publish-ready | 537 | `approved`, review approved + authenticity confirmed, all photos in storage, brand/category/condition/description set |
| Held | 20 | `draft`, review `pending` — reasons in the review record |
| Skipped at operator request | 350 | `draft`, no images (part-2 rows without fetched details) |

Held: FA8-798-SU (counterfeit — "SITONG…LAND" label), AV19-4894 (photos identical
to AV19-4882), AV2-1188-M (photos are the size S item), AV22-5984, FA6-545-SU,
FA6-667-SU, FA6-673-SU (stock images), FA4-264-SA, FA4-293-SU, FA6-674-SU (no label
visible), AVP-WSC-1262-M, AVP-WTH-4097-L, FA2-178-SA (photos/title describe a
different item), FA9-847-SU, FA9-848-SU (club-crest scarves, no licence label),
FA15-2148, AV2-1275, FA22-4075 (brand not on label), FA22-4126, AVP-WSC-3366-L
(label department conflicts with category).

## Primewardrobeusa publish (operator choice), 2026-11-11

- Primewardrobeusa (`718461ce…`, store `969d3f5c…`, native OAuth, Fashion-only) has two
  enabled eBay inventory locations: `AE_Dubai` ("Prime Wardrobe De - Dubai", the app's
  EBAY_US default) and `US_Dallas_75234` ("Prime Wardrobe - Dallas 75234"). Its only
  US fulfillment policy is "US Shipping - DOMESTIC POLICY FOR FD ITEMS" (free USPS
  Priority, 2-day handling); return policy "US Returns - Only US Stock" (30 days,
  buyer pays). The garments are in Dallas TX 75234 (the Fashion Story source location).
- Import `be2f798d` (535 rows) changed the description shipping text to "Ships from
  Dallas, Texas 75234, USA by USPS Priority Mail … Handling Time: Ships within 2
  business days" (the old text said 1 business day and carried a stray "payments"
  word). The 535 were re-signed in a guarded transaction. FA15-2045 and FA1-042 were
  excluded because they are already active on Primewardrobeusa.
- Pilot job `74bb8f1d` published 5 items via the Trading API: FA26-5770
  (840116189998), FA14-2000 (840116189994), AVP-MFC-3149-L (840116190005), FA6-429-SU
  (840116189999), FA16-2349 (840116189993). Title, category, brand, condition
  3000, photos and free USPS Priority shipping are correct on eBay.
- **Blocker:** each target carried `merchantLocationKey = US_Dallas_75234`, but
  `EbayInventoryApiService.ensureMerchantLocation` enforces the production UAE-only
  location rule (CHANGELOG "inventory-location country guard") and reconciled every
  publish to `AE_Dubai`. eBay shows the 5 pilot items located in "Prime Wardrobe De -
  Dubai, AE" while their descriptions say Dallas. The remaining 530 were not queued.
- Operator decision: allow the Dallas location. The workspace already contains the
  Fashion rule (uncommitted, CHANGELOG 2026-11-07 "Fashion eBay publishing now
  verifies the exact configured merchant location"): for a dedicated Fashion store,
  `ensureMerchantLocation` uses the requested key if it exists and is ENABLED on eBay,
  and fails closed otherwise; non-Fashion stores keep the UAE-only rule. All four
  Fashion stores default to `AE_Dubai`, so only explicit per-listing overrides change.
- Staged release (not yet switched — production deploy needs the operator):
  `/home/ubuntu/realtrackapp-fashion-location-20261111/` = `FROM
  realtrackapp-backend:fashion-fix2-20261109-20a29206` + two compiled files built from
  the workspace (`channels/ebay/ebay-inventory-api.service.js` sha256 `fd93ab02f802cb45…`,
  `verticals/vertical.config.js` `5d800316013c928d…`). A diff against the live
  compiled files showed only the Fashion branch and `isDedicatedFashionStore`. Image
  `realtrackapp-backend:fashion-location-20261111`; rollback tag
  `realtrackapp-backend:rollback-fashion-location-20261111` (= current live image).
  Switch: `docker compose -p realtrackapp` with the live container's
  `com.docker.compose.project.config_files` list plus
  `/home/ubuntu/realtrackapp-fashion-location-20261111/compose-backend-location.yml`,
  `up -d --no-deps --no-build backend`. Rollback: the same command without that
  override file.
- The 5 pilot listings were revised in place (Trading `ReviseFixedPriceItem`,
  Location/PostalCode/Country only; Ack `Warning` = eBay's standard funds-hold notice).
  The Browse API now shows "Dallas, Texas 752**, US" for all five.
- Switched at the operator's instruction: production backend now runs
  `realtrackapp-backend:fashion-location-20261111` (healthy; rollback tag
  `rollback-fashion-location-20261111`).
- Batch 1 (job `9d5b75aa`, 50 items): 48 published. AV2-1186 and AV2-1169 (New with
  tags) failed at build with the eBay June 2025 Parts & Accessories return rule.
  Batch 2 (job `71f66998`, 403 pre-owned items): 403 published. No location
  reconciliations logged. A random sample of 20 on eBay: seller primewardrobeusa,
  "Dallas, Texas 752**, US", free USPS Priority, Dallas description text, no banner.
- **Live on Primewardrobeusa: 456** (5 pilot + 48 + 403).
- **P&A rule misfires on Fashion.** `marketplaceRequiresPartsAccessoriesReturnPolicy`
  treats every EBAY_US category ID ≥ 33000 as Parts & Accessories, which includes
  apparel (57916, 155183, 63866…). New / New-with-tags Fashion items are blocked in
  the builder unless the store has a free-returns policy, and the publish service
  would call `paReturnPolicy.ensureCompliantReturnPolicy`, which can create or switch
  the seller to a free-returns policy. No return policy was changed: the two failures
  stopped at build, and pre-owned items never trigger the rule.
- Fix (workspace TS + live JS): skip the P&A rule when the listing vertical is
  `fashion` — `listing-builder.service` (1 site) and `ebay-publish.service` (2 sites).
  Builder and publish specs pass (74). Staged as overlay
  `/home/ubuntu/realtrackapp-fashion-pa-return-20261111/` → image
  `realtrackapp-backend:fashion-pa-return-20261111` (FROM the location image; patched
  the live compiled files, which differ from the workspace build by a `readOnly`
  branch already in production). Switched with operator approval; production backend
  now runs `realtrackapp-backend:fashion-pa-return-20261111` (healthy). Rollback:
  `realtrackapp-backend:fashion-location-20261111` (then
  `rollback-fashion-location-20261111` for the pre-change image).
- Batch 3 (job `fc7dcea3`, 79 New / New-with-tags items incl. AV2-1186 and AV2-1169):
  78 published. AV2-1188 (size S) failed "Trading API listing requires an available
  quantity": its source quantity is 0 (out of stock on The Fashion Story), so it is
  correctly not listed. The EBAY_US default return policy stayed `266337538013`;
  no return-policy creation or switch was logged. A sample of 15 on eBay: "New with
  tags", "Dallas, Texas, US", free USPS Priority, returns accepted 30 days buyer-paid.

### Final Primewardrobeusa result

| Job | Published | Not published |
|---|---|---|
| pilot `74bb8f1d` | 5 | 0 |
| batch 1 `9d5b75aa` | 48 | 2 (re-published in batch 3) |
| batch 2 `71f66998` (pre-owned) | 403 | 0 |
| batch 3 `fc7dcea3` (new) | 78 | 1 (AV2-1188, quantity 0) |
| **Live** | **534** | |

Of the 537 approved items: 534 live, AV2-1188 out of stock, FA15-2045 and FA1-042
already live on Primewardrobeusa before this work.

## Not done / open

1. **FA8-798-SU is live on eBay** (The Fashion Story, item 206…): its label is a
   counterfeit Stone Island. End that eBay listing.
2. **Target store.** These items are live on *The Fashion Story* account
   (`b9c799d7`, `reconnect_required`); 50 already have published-listing mirrors.
   Publishing to that account again creates duplicate eBay listings; publishing to
   another store cross-lists the same garment.
3. **Cross-listed twins kept.** `FA19 -3221` and `FA20 -3428` (stray space) are not
   stray drafts: they carry eBay item IDs 377193776900 / 377193681174 on a second
   account. The catalog treats them as published, so they are not in the ready
   list. Deleting them needs the eBay listings withdrawn first.
4. **The banner on eBay itself** is still on 229 active and 541 out-of-stock
   published-listing mirror rows (live eBay listings). Removing it there means
   revising live listings; not done.
5. **Pre-owned grade.** Every pre-owned item publishes as condition 3000
   ("Pre-owned - Good"), including "Excellent" ones, until 2990 support exists.
6. Code fixes (image-column mapping, no blank overwrites on Fashion re-import) are
   in the workspace and not deployed.
