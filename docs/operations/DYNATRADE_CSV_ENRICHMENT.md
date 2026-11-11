# DynaTrade CSV enrichment

Updated 2026-10-11. This is a local data preparation workflow for the original
6,046-row DynaTrade workbook. CSV preparation remains separate from production
import and publishing. Production quantity/condition reconciliation and the
reviewed Batch 33 application were completed after the user's explicit requests.
Neither operation published or updated eBay offers. Email notification was
canceled. The CSV preparation scripts themselves do not connect to production.

## Production quantity and condition reconciliation

On 2026-10-10, production `listing_records` and `catalog_products` were reconciled
against the workbook using normalized exact brand and manufacturer-part-number
keys. All 921 exact-match listing records now show `conditionId=1000` and
`condition_label=New`; the 919 records with an unambiguous workbook stock quantity
match it. The related 925 catalog products also show New and match every
unambiguous workbook quantity. The operation changed 829 listing records and 223
catalog products; listing revisions were written in the same transaction.

The workbook has 13 brand/MPN keys with multiple, conflicting stock quantities.
Production had two manual listings for FEBI 101942, whose workbook rows list
quantities 5 and 26. Both existing listings now show New, while their quantities
were left unchanged because the source rows do not identify which listing maps to
which stock line. The other 12 conflicting keys had no production match. One
existing DynaTrade row stores the source OE as its MPN; its source row and quantity
6 were verified, and its application MPN was preserved. Twenty-nine records whose
application status was `published` had their internal quantity corrected; this
database reconciliation did not send quantity revisions to eBay.

All five production containers were running, the frontend returned HTTP 200,
and `/api/health` reported database and memory health as `ok`. Batch 33 was then
applied separately: FEBI 43556 was updated in place to avoid a duplicate, and
FEBI 33602 was created. Both records are ready in RealTrack and remain
unpublished to eBay.

## Current output

- Current full master: `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-11_v106.csv` (6,046 source rows; adds Batch 38 FEBI-41038 with an official visually reviewed product photo and 98 active U.S. MVL fitments; preserves all other v105 fields).
- Cleaned next import: `deliverables/DynaTrade_US_Not_Live_SKUs_net_new_210_catalog_import_2026-10-11_v2.csv` (210 unique product parents; 38,789 unique compatibility continuations; duplicate exact fitment lines removed; no production import performed).
- Bosch follow-up evidence: `deliverables/DynaTrade_US_Not_Live_next15_evidence_2026-10-11_part2.csv` and `.json` (15 distinct products, 0 ready, 15 held; product-photo visual confirmation or exact part-specific fitment is missing).
- Batch 34 product CSV: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_34_verified_2026-10-10.csv`; detailed fitments: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_34_verified_fitments_2026-10-10.csv`.
- Batch 34 evidence, export plan, preview, and independent audit: `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_34_work/`.
- Batch 35 product CSV: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_35_verified_2026-10-10.csv`; detailed fitments: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_35_verified_fitments_2026-10-10.csv`.
- Batch 35 evidence, export plan, preview, and independent audit: `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_35_work/`.
- Batch 36 product CSV: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_36_verified_2026-10-11.csv`; detailed fitments: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_36_verified_fitments_2026-10-11.csv`.
- Batch 36 evidence, export plan, preview, and independent audit: `deliverables/DynaTrade_csv_pipeline_cache_2026-10-11/batch_36_work/`.
- Batch 33 production result: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_33_production_applied_2026-10-10.csv` and `deliverables/DynaTrade_batch33_production_apply_2026-10-10.json`.
- Batch 33 pre-application audited master: `deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-10_v99.csv`.
- Batch 3: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_3_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_3_verified_fitments_2026-10-10.csv`.
- Batch 4: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_4_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_4_verified_fitments_2026-10-10.csv`.
- Batch 5: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_5_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_5_verified_fitments_2026-10-10.csv`.
- Batch 6: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_6_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_6_verified_fitments_2026-10-10.csv`.
- Batch 7: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_7_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_7_verified_fitments_2026-10-10.csv`.
- Batch 8: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_8_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_8_verified_fitments_2026-10-10.csv`.
- Batch 9: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_9_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_9_verified_fitments_2026-10-10.csv`.
- Batch 10: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_10_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_10_verified_fitments_2026-10-10.csv`.
- Batch 11: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_11_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_11_verified_fitments_2026-10-10.csv`.
- Batch 12: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_12_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_12_verified_fitments_2026-10-10.csv`.
- Batch 13: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_13_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_13_verified_fitments_2026-10-10.csv`.
- Batch 14: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_14_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_14_verified_fitments_2026-10-10.csv`.
- Batch 15: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_15_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_15_verified_fitments_2026-10-10.csv`.
- Batch 16: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_16_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_16_verified_fitments_2026-10-10.csv`.
- Batch 17: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_17_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_17_verified_fitments_2026-10-10.csv`.
- Batch 18: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_18_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_18_verified_fitments_2026-10-10.csv`.
- Batch 19: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_19_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_19_verified_fitments_2026-10-10.csv`.
- Batch 20: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_20_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_20_verified_fitments_2026-10-10.csv`.
- Batch 21: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_21_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_21_verified_fitments_2026-10-10.csv`.
- Batch 22: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_22_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_22_verified_fitments_2026-10-10.csv`.
- Batch 23: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_23_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_23_verified_fitments_2026-10-10.csv`.
- Batch 24: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_24_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_24_verified_fitments_2026-10-10.csv`.
- Batch 25: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_25_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_25_verified_fitments_2026-10-10.csv`.
- Batch 26: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_26_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_26_verified_fitments_2026-10-10.csv`.
- Batch 27: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_27_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_27_verified_fitments_2026-10-10.csv`.
- Batch 28: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_28_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_28_verified_fitments_2026-10-10.csv`.
- Batch 29: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_29_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_29_verified_fitments_2026-10-10.csv`.
- Batch 30: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_30_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_30_verified_fitments_2026-10-10.csv`.
- Batch 31: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_31_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_31_verified_fitments_2026-10-10.csv`.
- Batch 32: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_32_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_32_verified_fitments_2026-10-10.csv`.
- Batch 33: `deliverables/DynaTrade_US_Not_Live_SKUs_batch_33_verified_2026-10-10.csv` and `deliverables/DynaTrade_US_Not_Live_SKUs_batch_33_verified_fitments_2026-10-10.csv`.
- Checkpoints: `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/`.

Batches 3–36 contain 247 distinct newly verified products (183 FEBI, 54 HENGST,
and 10 BOSCH) and 51,595 detailed compatibility rows. Batch 31 adds FEBI-22806
from source row 2115. The exact official FEBI article and Mercedes OE reference
match the supplier's `0019892103` value, and its official 1500-by-1500 PartsFinder
image visibly shows the labeled 1 L FEBI 22806 ATF bottle; the live image hash
passed the independent audit. The saved eBay compatibility source has 1,522 rows
for this MPN/ePID; only 93 Mercedes-Benz rows were retained, covering 18 models
and 1986–2000, with exact active `US_MVL_2026_05` vehicle-record matches. The
other 1,429 makes were excluded. These YMM rows are eBay compatibility data, not
FEBI-published YMM applications; FEBI lists MB fluid recommendations but not these
individual vehicle rows. Verify the fluid approval by VIN and vehicle documentation
before use. The converted cost is $7.89, the sale price is $38.00, and the requested
Superior shipping cost is $38.99. The independent audit passed all source rows,
fitments, official image bytes/hash, price, and policy checks. No production import
or listing write occurred.

Batch 32 adds FEBI-06161 and FEBI-32600 from source rows 835 and 874. Both
full-size official FEBI bottle photos were visually inspected and returned live as
1500-by-1500 JPEGs with unchanged approved hashes. FEBI's BMW comparison
references exactly match the supplier OEs: 81 22 9 407 758 for 06161 and
83 22 9 407 858 for 32600. Batch 32 retains 107 BMW fitments for 06161 and nine
BMW 323i/328i fitments for 32600; all match active U.S. MVL vehicle records. The
32600 fitments were narrowed to models named in the matched eBay item title.
Other raw eBay compatibility entries were excluded, with counts and reasons
recorded in the evidence file. These rows are eBay compatibility data, not
FEBI-published YMM applications. Verify the exact required fluid approval by VIN
and vehicle documentation. The source quantities are retained. Both products
use the $38.00 sale price and $38.99 Superior shipping cost. The independent
source, image, fitment, pricing and policy audit passed; no production write
occurred.

Batch 33 adds FEBI-33602 and FEBI-43556 from source rows 603 and 2068. The current
official 1500-by-1500 FEBI PartsFinder images were visually reviewed and then
re-fetched with unchanged JPEG hashes; they show the pulley with four bolts and
the front-right stabilizer link with two nuts. FEBI's article records confirm the
respective product types and BMW/Mercedes-Benz references. The supplier OEs match
the official reference numeric bases; FEBI displays the S1 suffixes. Batch 33
contains three BMW 335d eBay compatibility rows for 2009–2011 and 32
Mercedes-Benz rows for E300, E350, E400, E63 AMG, and E63 AMG S; all match active
`US_MVL_2026_05` records. These detailed YMM rows are from the eBay Sell Metadata
API, not manufacturer-published vehicle applications. Source quantities are
retained (2 and 22). `Condition=New` is explicit for all 6,046 rows in the v99
and v100 masters and in both batch rows, following the user's condition instruction. The
converted costs are $141.09 and $13.17, with sale prices
of $282.18 and $38.00. Both use the requested Superior shipping policy at $38.99.
The independent audit passed all 6,046 workbook rows, 35 fitments, live image
bytes/hashes, identity, pricing, and policy checks. The pre-application v99
master has 244 verified products, 189 held rows, two research holds, and 4,874
pending rows. After that audit, FEBI-33602 was created and the existing
FEBI-43556 record was updated in RealTrack with their audited photos, fitments,
prices, quantities, New condition, and Superior shipping policy. The applied
batch records both listing IDs and `ready` status. Neither listing was published
to eBay.

Batch 34 adds HENGST-H14W30 from source row 5471 with source stock 61. The official
Hengst catalog confirms the spin-on oil filter type, the 06J 115 403 C VAG OE
cross-reference, and the listed dimensions. The visually inspected 1600-by-1600
eBay gallery photo shows the actual filter beside its H14W30-labeled package; the
independent audit re-fetched the same JPEG bytes and verified their hash. The CSV
contains 760 eBay compatibility rows matched to active `US_MVL_2026_05` Audi and
Volkswagen vehicle records; these are eBay/MVL fitments, not a complete
Hengst-published YMM application list. AED 30.192 converts to $8.22 and the
requested rule sets the sale price to $38.00. Condition is New and Superior
shipping is $38.99. The independent audit passed all workbook rows, identity,
photo, fitment, price, and policy checks. The output is staged for later import;
it made no production write and did not publish an eBay offer.

Batch 35 adds HENGST-E1722L from source row 4381 with stock 10. Hengst's official
catalog confirms the E1722L air-filter insert, OE 991.110.130.00, Porsche 911
(991) application range, EAN, and dimensions. The visually reviewed 1200-by-1200
eBay WEBP shows the actual filter with Hengst/E1722L marking; its live bytes and
hash passed the independent audit. The batch retains 94 saved eBay Sell Metadata
API compatibility rows for Porsche 911, all matched to active `US_MVL_2026_05`.
Seller item pages display different compatibility totals; only those 94 saved
product-ePID API/MVL rows are included, with no seller-page extras inferred.
AED 83.538 converts to $22.75, and the requested price band sets $49.99. The
row has New condition and the requested Superior $38.99 shipping. The workbook,
identity, image, fitment, pricing, and policy audit passed. Batch 35 is staged
for later import; it made no production write or eBay publish.

The reviewed-batch preparation and independent audit require the exact MPN as a
separate token in the eBay title, preventing a longer number such as `ADU172211`
from proving MPN `172211`. Image replacement evidence can cite URLs from either
the current or prior source gallery. FEBI-172211 remains held: its prior eBay
title refers to a different air-filter part and its official catalog identity
does not support that saved listing. No correction to that held row is claimed in
v99.

Batch 28 adds
BOSCH-3397005046 with 12 exact active-MVL configurations for 1998–1999 Mercedes-Benz
S320, S420, S500 and S600 variants. Its 900-by-900 D-Stimmer product photo visibly
shows the exact Bosch 3397005046/046S package and the physical blades; Bosch's
U.S. catalog supports the included model years. Year-2000 applications remain
excluded because the active MVL rows do not preserve production dates. The
independent batch audit passed the source workbook, image bytes/hash, fitments,
price, and Superior policy checks. Bosch does not publish a direct OE
cross-reference for the supplier's 2208201845 reference; the CSV states that
limitation and retains the source value. No production write occurred. These
CSV batches have not been imported or evaluated by the current production
publishing preflight.
`Verified CSV` means the documented data checks passed. It does not mean an
application listing is ready or an eBay listing is published.

The full master preserves all eight original supplier columns and source row
order, checked directly against the XLSX. Source row 104 had a description replaced
in the old v68 master; v71 restores the workbook's `OIL FILTER-LR/FORD/GMC` and
retains the prior wording in `Previous Master Part Description`. The v99 status
counts are 735 rows from previous production batches, two legacy published rows,
244 new verified CSV rows, 189 rows held in this review, two research-hold rows,
and 4,874 rows awaiting further research. The full workbook is not complete.

## Processing and evidence

1. Deduplicate research by normalized brand plus MPN while retaining every source
   Excel row. Do not combine duplicate stock/cost records automatically.
2. Reuse completed eBay and MVL research. The current metadata detail source is
   `DynaTrade_US_Not_Live_SKUs_eBay_Metadata_MVL_fitments_2026-10-09_v1.csv` and its
   MVL release is `US_MVL_2026_05`.
3. Fetch images with at most eight workers and official articles with at most
   three workers. Cache results by part number and save progress. An unsuccessful
   HTTP response or a generic error page is not product evidence. Do not repeatedly
   retry unchanged invalid ePIDs. The current eBay/MVL lookup results were reused;
   no credentials are stored in the output or checkpoint files.
4. Visually inspect physical product images. Reject logos, drawings, opaque
   packaging, wrong MPNs, misleading bundles, and unsuitable primary-photo
   overlays. Record review decisions in `visual_decisions.json`. Official approvals
   are bound to brand, MPN, URL and the cached image's SHA-256 hash. Preparation
   and the final audit reject changed or missing reviewed images.
5. Prefer exact official gallery images. PartsFinder's public gallery uses
   `/pf-article-details/` for 320-pixel thumbnails and `/pf-article-zoomed/` for the
   full-size images. The 106 selected FEBI images decoded successfully at 1500 by
   1500 pixels. Do not enlarge thumbnails to manufacture image quality. The
   FEBI 27086 image is the exact official 1500-pixel gallery photo and was visually
   reviewed. The 33 Hengst batch images were exact-MPN eBay gallery photos reviewed
   against official OE identity evidence.
6. Verify identity using exact official brand/MPN, supplier OE comparison
   references, and the exact eBay title/MPN/ePID relationship. Normalize punctuation
   only for part/reference values. Normalize the documented official catalog make
   label `Volkswagen (VW)` to the eBay/MVL make `Volkswagen`, leaving unrelated
   makes distinct. Mercedes OE references may be compared with/without their `A` prefix,
   and Chrysler-family references with/without their `K` prefix. Preserve both
   reference values in the CSV. Other aliases require evidence.
7. Require detailed fitment count reconciliation and retain trim, engine,
   variant, body, platform, vehicle ePID and original eBay restrictions. A vehicle
   appearing in MVL does not prove that the part fits it. Hold conflicts with
   manufacturer make references rather than silently deleting or broadening
   applications. Make-reference checks are conservative and may hold a genuine
   shared application until more precise catalog evidence is obtained.

The batches exclude unresolved product-to-vehicle links, shared ePIDs across
different source parts, duplicate inventory identities, incomplete detailed
fitment files, fluids needing specification/approval review, and images awaiting
review. Examples caught this pass include a Scania E1006L air filter incorrectly
paired with Land Rover applications and a Bosch 0280218335 photo whose box label
reads 0280218088. The E1006L and E1033L active compatibility claims were cleared
in the current master after official Scania evidence contradicted their saved
Land Rover and Hyundai/Kia links; previous data remains in explicitly labeled
previous-evidence columns.

Batch 10 adds FEBI 11816 and FEBI 22251. The 11816 image is the official
full-size drag-link photograph and its 24 BMW fitments match the product
identity. For 22251, the official article supports Ford, Jaguar, Land Rover, and
Mazda; 986 of 1,039 detailed eBay compatibility rows pass the make/reference
review. The 51 Mercury and two Lincoln rows remain excluded. Both current
official image URLs returned the reviewed image bytes and passed the visual and
independent CSV audits. The v76 master has 6,046 rows, 144 newly verified
products, 267 held rows, 4,881 pending rows, 735 previous-production rows, and
two legacy published rows. No production import or listing write was made.

Batch 11 adds 17 HENGST products with 4,210 detailed U.S. fitment rows. Each
photo was live-refreshed, visually reviewed, and hash-checked; exact manufacturer
identity/reference, eBay catalog identity, pricing/policy fields, and detailed
fitments passed the independent audit. Three Volkswagen compatibility rows for
H326WK remain excluded because the reviewed official application evidence
supports Audi only. The audit rebuilds vehicle summaries from exact detailed
years, compresses only contiguous years, and preserves gaps. The v77 master has
6,046 rows, 161 newly verified products, 267 held rows, and 4,881 pending rows.
No production import or listing write occurred.

Batch 12 adds 37 FEBI products with 6,807 detailed U.S. fitment rows. The official
PartsFinder article, supplier OE reference, exact eBay title/MPN/ePID, make-level
application evidence, and active MVL detail rows passed the data gates. All 37
official full-size image URLs returned live JPEGs at 1500 by 1500 pixels; the raw
response bytes were visually reviewed and their SHA-256 hashes were tied to the
photo approvals. The independent batch audit re-fetched all 37 images, matched
their hashes, checked every fitment field, verified the 6,046 source rows and
Superior price/policy rules, and confirmed no overlap with earlier batches.
Batch 12 and the v78 master remain local CSVs; no production import or listing
write occurred. The planner now rebuilds the compact vehicle summary from exact
fitment years and keeps gaps such as 2006–2008 and 2011 separate.

The production eBay Browse request returned HTTP 429. This batch therefore reuses
the saved eBay Sell Metadata API identity and compatibility evidence; it does not
claim a successful Browse API refresh. No credentials were copied to outputs.

## Pricing and policies

Use the campaign's fixed rate of 3.6725 AED per USD. Convert with decimal
arithmetic. Select bands and calculate doubled prices from the exact converted
cost, rounding the final sale price to cents. Preserve sub-cent AED input precision
in `Cost Price AED`. The displayed USD cost is rounded
separately and is not the input to the doubled-price calculation.

| Exact USD cost | Selling price |
| --- | --- |
| 0 through 15 | 38.00 |
| Greater than 15 through 21 | 45.99 |
| Greater than 21 through 25 | 49.99 |
| Greater than 25 | Twice the exact cost, rounded to cents |

Every new row uses Superior, shipping cost 38.99 USD and shipping policy
`SUPERIOR AUTO Weight 1-1.99kg on APRIL 2026 Copy (4)`, return policy
`30 Days Return Accepted`, and payment policy `Superior car Payment Policy 1`.
Current policy IDs and tenant ownership must be reconciled through the supported
application workflow when import is requested.

## Rebuild from reviewed checkpoints

`scripts/dynatrade-csv-research.py` resumes FEBI official article/photo research
with one to three workers, per-product checkpoints, response size limits and
22-second request timeouts. It writes `official_research_staging.json`, separately
from the reviewed evidence. Existing successful and failed checkpoints are reused;
`--retry-unresolved` permits one new attempt, with no retry loop. New products and
changed photos require visual review and identity/fitment checks before evidence
is promoted into `official_febi_details_images.json` and approval snapshots.
The current worker covers FEBI; other brands still require their official sources
and the eBay/MVL evidence workflow described above.

`scripts/dynatrade-csv-prepare.py` uses the source workbook, pinned v68 master,
existing batch 1 and batch 2 exports, the metadata fitment CSV, and four reviewed
checkpoint JSON files. It emits a plan and explicit hold reasons. These files record actual
review; changing a review flag is not a substitute for inspecting an image.

```powershell
& '<bundled-python>' scripts/dynatrade-csv-research.py `
  --manifest 'F:/apps/realtrackapp/deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/next_visual_manifest.json' `
  --cache-dir 'F:/apps/realtrackapp/deliverables/DynaTrade_csv_pipeline_cache_2026-10-10' --workers 3

& '<bundled-python>' scripts/dynatrade-csv-prepare.py `
  --data-dir 'F:/apps/realtrackapp/deliverables' `
  --cache-dir 'F:/apps/realtrackapp/deliverables/DynaTrade_csv_pipeline_cache_2026-10-10' `
  --workbook 'C:/Users/Irtaza Hassan/Downloads/DynaTrade_US_Not_Live_SKUs (1).xlsx' `
  --plan 'F:/apps/realtrackapp/deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/csv_export_plan.json'

& '<bundled-node>' scripts/dynatrade-csv-export.mjs `
  'F:/apps/realtrackapp/deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/csv_export_plan.json' `
  'F:/apps/realtrackapp/deliverables' '<bundled-runtime-node-modules>'

& '<bundled-python>' scripts/dynatrade-csv-audit.py `
  --data-dir 'F:/apps/realtrackapp/deliverables' `
  --cache-dir 'F:/apps/realtrackapp/deliverables/DynaTrade_csv_pipeline_cache_2026-10-10' `
  --workbook 'C:/Users/Irtaza Hassan/Downloads/DynaTrade_US_Not_Live_SKUs (1).xlsx' `
  --report 'F:/apps/realtrackapp/deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/csv_pipeline_audit_report.json'
```

Resolve runtime paths with `load_workspace_dependencies`. The exporter uses the
bundled `@oai/artifact-tool`, rejects duplicate headers, validates pricing and ready
row prerequisites, renders a review preview, and writes counts and SHA-256 hashes
to `csv_pipeline_export_report.json`. Follow the spreadsheet skill's authoring
marker requirement before a new create/edit operation. Outputs use UTF-8 BOM,
RFC CSV quoting and CRLF line endings. MPNs and OE references remain text.

The FEBI/Hengst independent audit reads the exported CSVs, compares all source
columns directly with the workbook, checks decimal pricing and policies, verifies
photo approvals and content hashes, and compares every fitment field with the
original metadata detail file. Batch 3 expects 94/15,057 products/fitments, batch
4 expects 33/7,645, batch 5 expects 1/90, and batch 6 expects 10/7,750. The
cross-brand audit validates each reviewed item and its current image hash; batch 7
expects 1/71, batch 8 expects 2/545, and batch 9 expects 1/154. Changing a batch
requires reviewing its evidence and expected counts rather than bypassing the
audit. All seven batch audits
passed on 2026-10-10.

`scripts/dynatrade-csv-prepare-next.py` selects the next FEBI candidates whose
official product/OE evidence, exact eBay identity, reviewed official image and
complete MVL detail rows all pass. It starts from the named baseline and builds a
versioned master plus a new batch plan; its default safety boundary is local CSV
preparation only. Batch 5 was built from v70 and batch 6 from v71. The official
FEBI evidence, live image response, current image hash and visual approval are
checkpointed separately before preparation. Batch 6 uses each product's exact
official catalog description and leaves technical attributes blank when the
catalog has no verified attribute data.

For manually reviewed evidence from additional brands,
`scripts/dynatrade-csv-prepare-reviewed.py` accepts an explicit evidence JSON in
the cache and prepares the next master, verified batch, and detailed fitments
without production writes. The current allowlist maps Bosch, FEBI, Hengst, and
Lemforder to their official brand hosts. It checks the source workbook row, exact
eBay title, MPN and ePID identity, live image metadata and review hash, official
brand/MPN/OE evidence, prior-batch exclusion, make-specific fitment rows, pricing,
and policies. Image-source labels are evidence-driven, so official gallery images
are not mislabeled as eBay photos. When official evidence supports only part of an
eBay make set, the evidence records included and excluded makes and counts; the
audit reconciles both against the full source compatibility set. OE comparison
normalizes punctuation while retaining the supplier and manufacturer references.
Use `scripts/dynatrade-csv-audit-reviewed.py --batch-number N` to read the exported
files back and verify them against the workbook and original fitment source. If
official evidence supports only part of an eBay make set, export only the
supported makes and preserve the excluded applications and hold reason in the
evidence JSON.

When a manufacturer lookup confirms additional make/model/year applications, a
reviewed evidence record may name a separate supplemental fitment CSV and a
hash-pinned snapshot of exact active production MVL rows. The preparer and
independent audit verify every supplemental trim, engine, vehicle ePID, and MVL
release against that snapshot; supplemental rows do not inflate the eBay API
retrieval count. Each row must also fall within the manufacturer's recorded
make/model/year application. Generic `application/octet-stream` photo responses
are accepted only for `.jpg`/`.jpeg` URLs whose current bytes have a JPEG
signature and unchanged reviewed hash. Both image dimensions must be at least
500 pixels.

Keep raw eBay compatibility counts distinct from retained detailed fitment rows.
The `eBay Compatibility Records Available/Retrieved` fields preserve the API
totals; the fitment CSV includes only rows that pass active-MVL and manufacturer
application checks. If raw API records are excluded, evidence must explain the
reconciliation and the independent audit reports raw and retained counts.

Batch 7 verified BOSCH 0261210364, its Bosch-confirmed 7PP905381B OE reference,
and 71 Porsche compatibility rows. Batch 8 verified BOSCH 0261210199 with 397
Audi/Volkswagen rows and BOSCH 0261210147 with 148 Volkswagen rows. Its additional
66 Audi rows remain outside the active fitment export until official application
evidence confirms them. The selected batch 7 and 8 image URLs returned HTTP 200
with JPEG content and unchanged review hashes at audit time.

Batch 9 verifies FEBI 47894. The official PartsFinder article identifies an Oil
Drain Plug with sealing ring and lists BMW reference 11 13 7 605 018, matching the
supplier's `11137605018` after punctuation-only normalization. The live official
gallery image returned HTTP 200 as a 1500-by-1500 JPEG and was re-reviewed after
its bytes changed; the previous image approval hash remains in review history.
Of 158 eBay compatibility records with ePID 20073075154, 154 BMW rows match active
`US_MVL_2026_05` and retain all detailed constraints. Four Lexus rows are excluded
because the official product article provides no Lexus application evidence. The
batch 9 audit verifies the 154 exported rows and all four exclusions.

The master and new-product CSV are research outputs, not automatically mapped
application import templates. On an explicit import request, reconcile existing
Superior SKUs, create the supported application import format with the detailed
fitment rows, attach current store/policy IDs, and run the application readiness
checks. Uploading and starting an import are distinct authorized actions. Never
insert catalog/listing database rows directly for this workflow.

## Review evidence

The FEBI pass inspected 426 original candidate images. The current checkpoint
contains 117 full-size official photos, 116 approved; one official image showed the
product too small on a large blank canvas and remains held. FEBI 27086's official
record confirmed the supplier BMW OE reference, its image was visually reviewed,
and its 90 detailed fitments all resolve to BMW in the active U.S. MVL. Batch 6's
ten current official photos were HTTP-checked and visually confirmed as the
corresponding physical FEBI products; their 7,750 fitment rows reconcile to the
eBay/MVL details and official make references. The Hengst
pass obtained official identity evidence for 100 products and reviewed the 33 batch
photos that passed identity and fitment gates. The export review checks source-column preservation,
unique headers and SKUs, exact fitment joins/counts, full-precision pricing, title
length, and consistent policies.

Production was checked read-only on 2026-10-10: backend, PostgreSQL, Redis and
PgBouncer reported healthy, frontend was running, public frontend returned HTTP
200 and `/api/health` returned HTTP 200 with database and memory status up. This
does not exercise every interactive application flow. No production rows were
changed by this CSV preparation pass.

**Batch 16 CSV audit, 2026-10-10:** the v82 full master retains all 6,046 source
rows with 202 newly verified products, 226 held rows, and 4,881 pending rows.
BOSCH 0280218175 adds 90 detailed Audi and Volkswagen fitments. The official Bosch
U.S. product page confirms OE number 03H906461 and sensor specifications; its live
reverse application lookup agrees with every included make/model/year row, and
the detailed eBay compatibility data match active `US_MVL_2026_05`. The selected
1500-by-1500 eBay photo was visually checked as the actual Bosch MAF sensor with
0280218175 stamped on its body and re-fetched with the same SHA-256 during the
independent audit. The audit passed source preservation, exact ePID/MPN, image,
price/policy, and fitment checks. The master contains 43,995 detailed fitments.
Batch products, fitments, and audit report are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_16_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_16_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_16_independent_audit_report.json`.
No production write occurred.

**Batch 15 CSV audit, 2026-10-10:** the v81 full master retains all 6,046 source
rows with 201 newly verified products, 227 held rows, and 4,881 pending rows.
BOSCH 0281002956 adds 69 detailed Audi and Volkswagen fitments. The official Bosch
U.S. product page confirms the MAF sensor and OE number 03L906461A; its live
reverse application lookup agrees with every included make/model/year row. These
saved eBay compatibility details also match active `US_MVL_2026_05`. The selected
1000-by-946 live eBay image was visually checked as the actual Bosch-marked MAF
sensor and re-fetched with the same SHA-256 by the independent audit. The audit
passed source preservation, exact ePID/MPN, image, price/policy, and fitment checks.
The master now contains 43,905 detailed fitments. Batch products, fitments, and
audit report are `deliverables/DynaTrade_US_Not_Live_SKUs_batch_15_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_15_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_15_independent_audit_report.json`.
No production write occurred.

**Batch 14 CSV audit, 2026-10-10:** the v80 full master retains all 6,046 source
rows with 200 newly verified products, 228 held rows, and 4,881 pending rows.
BOSCH 0392020073 adds 341 detailed Audi, Porsche, and Volkswagen fitments. The
official Bosch U.S. application lookup agrees with every included make/model/year
application; the detailed eBay compatibility records match active
`US_MVL_2026_05`. Bosch's official catalog identifies an auxiliary electric water
pump and lists OE references 3D0965561D and 95510656101. The selected exact-MPN
eBay image was visually checked as the actual pump at 1500 by 1500 pixels, then
re-fetched with the same SHA-256 by the independent audit. The audit passed
source preservation, exact ePID/MPN, image, price/policy, and fitment checks. The
master now contains 43,836 detailed fitments. Batch products, fitments, and audit
report are `deliverables/DynaTrade_US_Not_Live_SKUs_batch_14_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_14_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_14_independent_audit_report.json`.
No production write occurred.

**Batch 13 CSV audit, 2026-10-10:** the v79 full master retains all 6,046 source
rows with 199 newly verified products, 229 held rows, and 4,881 pending rows.
HENGST E1000L adds 156 detailed Volvo fitments. Its official identity and OE
references are from the HENGST catalog; its selected image is a visually reviewed
1500-by-1500 exact-MPN retailer photo showing the actual filter beside packaging
marked E1000L. The originally selected eBay gallery image was below the reviewed
batch's minimum dimensions, so the new URL is approved only with explicit
previous-URL evidence and a current content hash. The independent audit passed
source preservation, exact ePID/MPN, image, price/policy, and fitment checks.
HENGST E1722L remains held because its actual-part photo is too small. The verified
master now contains 43,495 fitment details. Current batch outputs and the audit
report are `deliverables/DynaTrade_US_Not_Live_SKUs_batch_13_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_13_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_13_independent_audit_report.json`.
The eBay Browse call returned HTTP 429, so saved Sell Metadata API data was reused;
no production writes occurred.

**Live photo recheck, 2026-10-10:** all 117 previously verified official image URLs
returned HTTP 200 with `image/jpeg`; 13 still served the previously approved
bytes, while the other 104 were refreshed, visually reviewed, and re-approved
against their current bytes. Batch 12 adds 37 more live, visually reviewed official
photos. The photo checkpoint now has 154 exact-hash approvals. The next-batch
preparer and independent audit reject a changed or missing approved image. Raw
batch 12 response checks and the passing audit are recorded in
`deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch12_live_raw_image_checks.json`
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch12_independent_audit_report.json`.

**Production read-only audit, 2026-10-10:** all 600 batch-one SKUs exist in the
production catalog. The actual publisher selects verified `fitment_rows` for 531
products and verified `fitment_data` for 69. Comparing that selected source against
the canonical U.S. MVL compatibility rows finds exact Make/Model/Year/Trim/Engine
agreement for 598 products (85,094 rows). Two products are held: E989LC01-2 has
10 extra Mercedes compatibility rows in `fitment_rows`; E5KFR2 D12 has four
Aston Martin rows there while its reviewed source supports four Mercedes rows.
Both products' raw `fitment_data` arrays match the reviewed source. Production
records were not changed during this audit. The 600-row batch is not fully
publish-ready until the supported application workflow repairs and verifies those
two selected-source mismatches and confirms the store policies.

**Batch 17 CSV audit, 2026-10-10:** the v83 master retains all 6,046 source rows
with 203 newly verified products, 225 held rows, and 4,881 pending rows.
BOSCH 0280218002 adds 70 detailed fitments: 60 Volkswagen rows from saved eBay
Sell Metadata compatibility evidence and 10 Seat Toledo rows from Bosch's
official U.S. 2001–2004 application lookup joined to exact active
`US_MVL_2026_05` trim, engine, and vehicle-ePID records. Bosch confirms exact
MPN 0280218002, OE 06A906461A, product type, five blade terminals, and one
included sensor. Its official product gallery shows the actual 1400-by-1400
sensor image; although the CDN declares `application/octet-stream`, the live
bytes have a JPEG signature and match the visually reviewed SHA-256. The
independent audit passed workbook preservation, identity, image, all 70 exact
fitments, AED/USD pricing, and Superior policy checks. The exact converted cost
is $49.05; the greater-than-$25 rule sets the sale price to $98.10 with the
agreed $38.99 Superior shipping policy. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_17_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_17_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_17_export_20261010/independent_audit.json`.
All outputs remain local; no production write or email occurred.

**Batch 18 CSV audit, 2026-10-10:** the v84 master retains all 6,046 source rows
with 204 newly verified products, 224 held rows, and 4,881 pending rows.
FEBI 10266 adds 21 detailed Mercedes-Benz fitments from saved eBay Sell Metadata
compatibility rows matched to active `US_MVL_2026_05`. The live official
PartsFinder article confirms the exact thermostat-with-sealing-ring article and
Mercedes OE 616 200 04 15. Its current 1500-by-1500 gallery image shows the
physical thermostat and sealing ring; the photo changed since an older review,
was re-fetched and visually reviewed, and its current SHA-256 passed the
independent live audit. Exact converted cost is $6.47, so the sale price is
$38.00; Superior shipping is $38.99 with the agreed return and payment policies.
The audit passed workbook preservation, identity, fitments, image, pricing, and
policy checks. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_18_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_18_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_18_work/independent_audit.json`.
All outputs remain local; no production write occurred.

**Batch 19 CSV audit, 2026-10-10:** the v85 master retains all 6,046 source rows
with 209 newly verified products, 219 held rows, and 4,881 pending rows. Five FEBI
articles add 117 fitments: 108213 and 108214 brake discs for Porsche; 170680 ABS
sensor for Mercedes-Benz; 24771 glow plug for Kia; and 29800 stabilizer link for
Porsche. Each official PartsFinder product page returned HTTP 200 with the exact
article, product type, and supplier OE comparison reference. Each current
1500-by-1500 full-size official photo was visually reviewed as the actual
product, then re-fetched with an unchanged SHA-256 during the audit. All detailed
fitments match the source eBay compatibility and active `US_MVL_2026_05` records.
The independent audit passed source preservation, identity, fitments, live image
hashes, AED/USD pricing, and Superior policies. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_19_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_19_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_19_work/independent_audit.json`.
No production write occurred.

**Batch 20 CSV audit, 2026-10-10:** the v86 master retains all 6,046 source rows
with 214 newly verified products, 214 held rows, and 4,881 pending rows. Five
FEBI articles add 123 fitments: 34384 axial joint for Land Rover; 39737 tie rod
end for Land Rover; 24493 propshaft center-support repair kit for Dodge and
Mercedes-Benz; 31822 brake-lining wear indicator for Land Rover; and 185706
air-suspension compressor for Land Rover. Each live official PartsFinder article
confirms exact FEBI article, type, and OE reference. All five current 1500-by-1500
official gallery images show the physical part and were re-fetched, visually
reviewed, and hash-checked. Detailed eBay fitments preserve vehicle constraints
and match active `US_MVL_2026_05`. The independent audit passed source workbook,
identity, exact fitments, live image hashes, AED/USD pricing, and Superior policy
checks. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_20_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_20_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_20_work/independent_audit.json`.
No production write occurred.

**Batch 21 CSV audit, 2026-10-10:** the v87 master retains all 6,046 source rows
with 219 newly verified products, 209 held rows, and 4,881 pending rows. Five FEBI
articles add 185 detailed fitments: 34293 steering boot kit (29 Land Rover, 4
Volvo), 177109 brake disc (35 Land Rover), 47368 brake-lining wear indicator (36
Porsche), 108577 brake disc (23 Jaguar, 14 Land Rover), and 107274 stabilizer bush
(44 Land Rover). Each live official PartsFinder article confirms the exact FEBI
article, type, and matching supplier OE reference. The five current 1500-by-1500
full-size official photos were visually reviewed as the actual parts. The first
audit caught thumbnail URLs paired with full-size-photo approvals; those URLs were
corrected to the official zoomed gallery, and the audit then re-fetched all five
photos with matching hashes. All detailed fitments match active `US_MVL_2026_05`.
The independent audit passed source preservation, exact identity and fitments,
live image hashes, AED/USD pricing, and Superior policies. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_21_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_21_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_21_work/independent_audit.json`.
No production write occurred.

**Batch 22 CSV audit, 2026-10-10:** the v88 master retains all 6,046 source rows
with 224 newly verified products, 204 held rows, and 4,881 pending rows. Five FEBI
articles add 252 detailed fitments: 174477 engine mounting (14 Porsche), 34854
stabilizer link (49 Land Rover), 172394 brake hose (50 Land Rover), 192796 water
pump with gasket (58 Jaguar, 6 Land Rover), and 108638 brake disc (42 Jaguar, 33
Land Rover). Each live official PartsFinder article confirms the exact FEBI
article, type, and matching supplier OE reference. The five current full-size
1500-by-1500 official photos were visually reviewed as the actual parts and
re-fetched with unchanged hashes by the independent audit. All detailed eBay
fitments match active `US_MVL_2026_05`. The independent audit passed source
preservation, exact identity and fitments, live image hashes, AED/USD pricing, and
Superior policies. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_22_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_22_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_22_work/independent_audit.json`.
No production write occurred.

**Batch 23 CSV audit, 2026-10-10:** the v89 master retains all 6,046 source rows
with 229 newly verified products, 199 held rows, and 4,881 pending rows. Five FEBI
articles add 918 detailed fitments: 104873 tie rod end (188 Jaguar and Land Rover),
174408 valve-cover gasket set (107 Land Rover), 16343 brake-pad set (134 BMW),
173581 automatic-transmission oil drain plug (264 Audi), and 46653 wheel bolt (225
Peugeot). Fresh official PartsFinder pages returned HTTP 200 and confirmed each
article, type, and exact supplier OE reference. The five visually reviewed current
1500-by-1500 official photos show the physical products and passed fresh live hash
checks. All fitments preserve their eBay vehicle details and match active
`US_MVL_2026_05`; official comparison makes cover every included make. The
independent audit passed source preservation, exact identity and fitments, live
image hashes, AED/USD pricing, and Superior policies. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_23_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_23_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_23_work/independent_audit.json`.
No production write occurred.

**Batch 24 CSV audit, 2026-10-10:** the v90 master retains all 6,046 source rows
with 232 newly verified products, 196 held rows, and 4,881 pending rows. Three FEBI
articles add 3,677 detailed fitments: 172879 valve-cover gasket (275 Jaguar and
Land Rover), 179289 valve-cover gasket (334 Jaguar and Land Rover), and 178884
additional water pump (3,068 Cadillac, Chevrolet, and Land Rover). Fresh official
PartsFinder pages confirm exact articles, types, and matching supplier OE
references. The three current full-size 1500-by-1500 official photos were visually
reviewed as the actual parts and re-fetched with unchanged hashes. All fitments
match active `US_MVL_2026_05` and preserve the source vehicle details. The
independent audit passed source preservation, identity, fitments, live image hashes,
AED/USD pricing, and Superior policies. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_24_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_24_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_24_work/independent_audit.json`.
No production write occurred.

**Batch 25 CSV audit, 2026-10-10:** the v91 master retains all 6,046 source rows
with 234 newly verified products, 196 held rows, and 4,879 pending rows. FEBI
181242 adds 18 Tesla Model S fitments for 2015–2019; the raw eBay response had 38
records, of which 18 complete year/trim rows matched active `US_MVL_2026_05` and
20 could not be reconciled as complete active U.S. vehicle rows. Its official
1500-by-1500 PartsFinder image shows the actual ABS sensor and its official page
confirms the Tesla comparison reference. Hengst E1776L adds 38 BMW M340i xDrive
and Toyota GR Supra fitments: 21 eBay rows plus 17 official Hengst application
rows matched to the active production MVL snapshot. Its visually reviewed
1600-by-1200 eBay gallery image shows the filter element with its part marking;
official Hengst sources verify the exact article, dimensions, EAN, OE references,
and applications. The independent audit passed all 6,046 supplier rows, 56 fitment
rows, current image hashes, identity, AED/USD pricing, and Superior policies. One
2018 Tesla 75D fitment has a blank vehicle ePID because two active MVL records are
identical on the available fitment fields; its year, trim, and engine restrictions
are preserved without selecting one arbitrarily. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_25_verified_2026-10-10.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_25_verified_fitments_2026-10-10.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-10/batch_25_work/independent_audit.json`.
No production write occurred.

**Batches 26–28 CSV audit, 2026-10-10:** v94 retains all 6,046 supplier rows.
Batches 26–28 add three BOSCH products with 223 detailed fitments (160, 51,
and 12). Batch 26 passed its saved independent audit; batches 27 and 28 remain
distinct verified CSV outputs. Batch 28 adds row 1510, BOSCH-3397005046: Bosch's
2025 U.S. wiper catalog lists its 1998–1999 S320/S420/S500/S600 applications;
12 matching active `US_MVL_2026_05` variants retain exact trim, engine, and ePID.
Year-2000 variants remain excluded pending build-date confirmation. The current
900-by-900 product photo was visually checked and its live JPEG bytes and SHA-256
matched the review evidence. The converted cost is $37.15 and the agreed
above-$25 rule sets the sale price to $74.30; Superior shipping remains $38.99.
The batch 28 independent audit passed all 6,046 workbook rows, the fitment file,
photo, price and policies. No production listing was imported or written.


**Batch 36 CSV audit, 2026-10-11:** FEBI-34608 from source row 620 adds stock
1,224, New condition, $38.00 sale price, and the requested Superior $38.99
shipping policy. FEBI's official PartsFinder page confirms the exact 1 L ATF
product and BMW reference 83 22 0 144 137, matching supplier OE 83220144137;
the catalog lists yellow fluid, HC-synthetic base oil, and recommended uses.
The live official 1500-by-1500 image visibly shows the FEBI 34608 bottle and
passed the HTTP, JPEG, byte-count, and SHA-256 audit. The saved product-ePID
file contains 1,186 rows matched to active `US_MVL_2026_05`; 822 rows for BMW,
Hyundai, Jaguar, Land Rover, Audi, and Volkswagen are included and 364 Kia rows
are excluded for lack of official make/reference support. The raw API response and
endpoint-completeness counters were not saved; the eBay seller page separately
shows seller-specific Ford/Lincoln/Mercury fitment, which is not merged. FEBI
does not supply these individual YMM records, so the product description instructs
VIN/specification verification. The audit passed all 6,046 source rows, fitment
rows, exact identity/reference, live image hash, New condition, pricing, and policy
checks. v103 now has 247 CSV-verified products, 51,595 detailed compatibility
rows, 4,874 research-pending rows, 186 held rows, and 2 research holds. No
production write or eBay publish occurred. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_36_verified_2026-10-11.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_36_verified_fitments_2026-10-11.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-11/batch_36_work/independent_audit.json`.

**Batch 37 CSV audit, 2026-10-11:** v104 retains all 6,046 supplier rows and
records 248 CSV-verified products, 735 prior production-batch rows, 2 legacy
published rows, 4,874 research-pending rows, 185 held rows, and 2 research holds.
FEBI-26383 (source row 3175) adds 46 compatibility rows: 24 Mercedes-Benz
Sprinter 2500/3500 rows for 2015 and 22 Volkswagen Crafter/Crafter Van rows for
2008–2016. The raw eBay API response returned all 46 records; it matches the
saved product-ePID/MVL detail source on all six vehicle identity fields with
zero raw-only or saved-only rows, and all 46 saved records identify active
`US_MVL_2026_05`. FEBI's official PartsFinder page confirms transmission-mount
identity, OE references 639 242 00 13 and 2E0 199 379, and dimensions 130 × 74 ×
65 mm. Its live “Used In Vehicles” tables list Mercedes Sprinter (906)
applications for 2006–2020 and VW Crafter I chassis 2E/2F applications for
2006–2016, covering the included years. eBay's source notes remain in the buyer
description: Sprinter engine code 651.955 and drivetrain variants; Crafter RWD
without PTO. The actual full-size official 1500 × 1500 image passed HTTP/JPEG,
hash, and visual product checks. The row carries quantity 51, New condition,
$38.00 under the exact-cost-under-$15 rule, and Superior's $38.99 shipping
policy. The independent CSV audit passed the 6,046-row workbook, image, identity,
fitment, pricing, and policy checks. The v104 master and separate 46-row
fitment CSV are ready for the supported RealTrack import workflow; no production
write or eBay publish occurred. Outputs are
`deliverables/DynaTrade_US_Not_Live_SKUs_enriched_2026-10-11_v104.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_37_verified_2026-10-11.csv`,
`deliverables/DynaTrade_US_Not_Live_SKUs_batch_37_verified_fitments_2026-10-11.csv`,
and `deliverables/DynaTrade_csv_pipeline_cache_2026-10-11/batch_37_work/independent_audit.json`.

The reviewed CSV preparer and auditor also support explicit official-to-U.S.
catalog model aliases and discover prior verified batches independent of date
ordering, preventing translated chassis names or a later-dated prior batch from
blocking exact matching.

**Current production reconciliation (2026-10-11):** v106 contains all 6,046
source rows and 6,032 distinct SKUs. Descriptions are present on all 6,046
rows, image URLs on 4,098, and vehicle compatibility summaries on 1,170. A
total of 249 rows have verified image, description, fitment, pricing, quantity,
New condition, and Superior shipping data; 4,873 remain research-pending, 185
are held, and two are research holds. Of the 249 verified rows, 247 still need
a production action, while Batch 33 already created one listing and updated
one existing listing. Production currently accounts for
922 exact DynaTrade SKUs (921 pre-existing records plus the Batch 33 create;
the update is included in the existing 921). Within the first 600, RealTrack
shows 471 `ready` and 129 `published` statuses. These are application statuses,
not confirmation of 129 new eBay offers.

Of the 247 verified rows awaiting production action, 37 already match catalog
products (36 have listing records and one is catalog-only), leaving 210 safe
new product parents. The existing matches still need in-place reconciliation:
only 18 of 36 listing prices match the target and none has the exact requested
shipping-profile name; fitment review is incomplete. The v2 importer file has
210 parents and 38,789 unique active-MVL compatibility continuation rows. It
removes 4,026 exact duplicate continuation lines (from 66 parent SKUs) from the
prior 209-SKU file while retaining every distinct vehicle combination. Batch 38
adds FEBI-41038: its official bilstein group photo was visually checked; the
eBay Browse API returned part-numbered listing title matches, but seller photos
and seller fitments were not used as evidence; official Wrangler III (JK)
application evidence was cross-checked against the active `US_MVL_2026_05`
release; 98 distinct U.S. gasoline fitments are included. The record has the
converted $14.04 cost, rule-based $38.00 price, source quantity 2, New
condition, and the requested Superior $38.99 shipping profile. The
importer file is
`deliverables/DynaTrade_US_Not_Live_SKUs_net_new_210_catalog_import_2026-10-11_v2.csv`.
Every parent passed a price, quantity, condition, and shipping-profile audit;
no production write or eBay publish occurred. Importing through the supported
app endpoint requires an authenticated user with `catalog.import`.

The 512 MB health threshold was exceeded by a responsive backend at 657.85 MB
heap. A backend-only derived image raised this cutoff to 1 GB. On 2026-10-11,
read-only checks confirmed all five containers running (backend, PostgreSQL,
Redis, and PgBouncer healthy; frontend up), the public frontend root returning
HTTP 200, and `/api/health` reporting both database and memory `up`.

The user's reauthenticated Super Admin session opened the production Catalog
Import page. Its dashboard shows 13 imports, 1,445 catalog products, 921
products inserted across import history, and 147 duplicates caught. The four
completed `superior_600_batch1_part{1..4}` jobs report 15, 16, 19, and 17 new
products respectively (67 total); the separate `superior_batch2_new16` job
reports 16. The combined 86,078-row `superior_600_batch1` job is cancelled
with zero inserts. These import-history counts describe newly inserted rows and
do not replace the prior listing-status reconciliation of 471 `ready` and 129
`published` among the first 600.

The 210-parent v2 file still has no production import job and no rows from it
have been written or published. The supported upload control is visible, but
the current browser automation cannot assign a local file to its file chooser;
the file must be selected through that control before the mapping can be checked
and the authenticated import started. No eBay offers were published.
