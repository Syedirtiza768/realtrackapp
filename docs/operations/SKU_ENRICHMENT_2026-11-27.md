# SKU enrichment and live listing update, 2026-11-27

**Status:** database and live eBay listings updated; checked on the public listing. Scripts recorded here, not deployed. Bulk data (review table, eBay pre-state, model output) stays in the operator output folder on the workstation and on the server, not in git.

## What was done

1. **Scope.** The 3,972 SKUs in the two operator spreadsheets (`eBay_Active_Listings_Sorted_by_SKU.xlsx`, `UK FD FINAL.xlsx`). 3,726 have a catalogue row; 246 have none and none of them is live.
2. **Enhancement set.** 2,008 SKUs are missing one of brand, department, item type, size or colour, and have no proper description (under 300 characters).
3. **Enhancement.** Claude `claude-haiku-5-5` at `medium` effort with one basic web search per item (`web_search_20250305`; the `_20260209` variant is not listed for Haiku 5.5). Output is validated as JSON. 1,645 are high confidence and were applied; 363 (348 medium, 15 low) are held for review.
4. **Database.** `apply_enh.cjs` applied the 1,645 rows in one transaction. The before-values are in `sku_enrich_backup_20261127`. Only empty specifics were filled; the description was set only where it was under 300 characters; the stored condition label is appended by code, never by the model.
5. **eBay (Inventory API only, no Trading).** `publish_inv.cjs` wrote 1,036 Primewardrobeusa and 1,035 The Fashion Story listings. For each: missing aspects were added with values checked against Taxonomy for the offer's live category, the inventory item description was written, and the offer `listingDescription` was written (see the finding below).
6. **Propagation check (read-only, 2026-11-27 15:30 UTC).** Public Browse API, all 2,071 updated listings: all returned 200; 1,773 of 1,773 descriptions that were changed show the new text; 1,764 of 1,764 listings show every added item specific. The Fashion Story listings show no promotion; Primewardrobeusa listings show a MARKDOWN marketing price on the public page (see below).

## Findings that change how this must be done

- **The live text is `offer.listingDescription`.** An inventory-item PUT with a new `product.description` is accepted (204) and aspects reach the live listing within minutes, but the description shown on eBay does not change. Both must be written.
- **Taxonomy must use the offer's `categoryId`.** The database `category_id` differed from the live category on several rows (for example a dress-pants row sat under the men's T-shirt category 15687).
- **Price fields on sale listings.** An offer PUT on a listing in a sale returned 25019 ("price cannot be updated since it is a part of a sale"). Sending the same offer again without `pricingSummary` succeeded, but it cleared the offer's stored price on 142 Primewardrobeusa offers. **The live listings are not affected:** for all 142, the base price on Browse equals the price in the pre-write audit, and the public page shows a 10% markdown. The offer price is blank until restored. Restore list: `Restore_Offer_Price_PWUSA_2026-11-27.csv` (SKU, offer ID, price before). Restore with a PUT of `pricingSummary` once the markdown ends.
- **SKUs containing a space** (41 on Primewardrobeusa, 42 on The Fashion Story) return 400 from the Inventory API with either `%20` or no space, so they cannot be updated without Trading.
- **Not reachable through Inventory:** 3 live The Fashion Story SKUs have no published offer on an active listing.

## Not done

- **201 live listings per store** are held for review (medium or low confidence). They keep their old description and missing specifics.
- **Production deploy: not performed.** The change needs no backend code. A deploy of `main` would replace the live backend image (`realtrackapp-backend:token-keepalive-20261127`), which carries the `ebay-token-keepalive` scheduler (commit `2f862686`, branch `token-keepalive`). That commit is not on `main`, so deploying `main` would stop the 20-minute eBay token refresh and tokens would expire. Merge that commit into `main` and rebuild from it before any backend deploy.
- **246 SKUs with no catalogue row:** need a source record before enrichment.

## Rollback

- Database: `scripts/ops/sku-enrichment-2026-11-27/rollback_2026_11_27.sql` restores description, brand and vertical attributes from the backup table (1,645 rows).
- eBay: the pre-write state for each write (offer `listingDescription`, inventory description, aspects, brand) is in the operator output folder (`ebay_prestate_*`). 93 Primewardrobeusa and 34 The Fashion Story writes happened before pre-state capture started; for those the old text can only be approximated.

## Scripts (one-off, recorded for audit; not part of the backend build)

Directory `scripts/ops/sku-enrichment-2026-11-27/`:

- `run-job.sh`: runs one script in a one-off backend container built from the live compose file set. The running service is not touched.
- `enhance.cjs`: Haiku enhancement (read-only on the database; reads `ANTHROPIC_API_KEY` from `/app/.env`).
- `apply_enh.cjs`: validates proposals and applies them (dry run unless `APPLY=1`).
- `audit_inv.cjs`: read-only audit of offers per store (linked to an active listing or not).
- `publish_inv.cjs`: **writes live listings.** Its header carries a warning. Do not re-run without reviewing the sale-price handling.
- `verify_browse.cjs`, `verify_all.cjs`: read-only public checks.
- `offer_full.cjs`: read-only offer probe.
- `rollback_2026_11_27.sql`: database rollback.
