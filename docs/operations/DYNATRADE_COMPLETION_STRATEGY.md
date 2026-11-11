# DynaTrade completion strategy

Updated: 2026-10-10. Source workbook: `DynaTrade_US_Not_Live_SKUs (1).xlsx`.

## 1. Objective and current instructions

Enrich every one of the 6,046 source rows with an accurate product description,
actual product image URLs, and evidence-backed vehicle compatibility. Apply the
agreed Superior pricing and policies. Prepare and review the CSV data first;
import into production only on the user's subsequent request. The email request
was canceled. Preparing a CSV, importing a draft, passing application readiness,
and publishing a marketplace listing are separate states.

The complete workbook remains the objective. A verified subset is progress, not
completion. Unresolved records remain visible and are not silently dropped,
marked complete, or filled with guessed compatibility.

## 2. Preserve the supplier inventory

- Keep all source rows and their order. Preserve the original eight supplier
  columns, including original part numbers, MPNs, stock and AED cost.
- Read the actual XLSX during the audit, rather than trusting an older enriched
  export. Hash the source workbook, baseline and final exports.
- Record the source Excel row and a normalized brand/MPN research key. Normalize
  punctuation and spacing; retain leading zeros and meaningful suffixes.
- Research duplicate identities once, then map evidence back to their source
  rows. Hold duplicate stock/cost records for reconciliation; do not sum inventory
  or select a price arbitrarily.
- Preserve previous evidence when rejecting or replacing a value. The v69 audit
  restored one supplier description that an older master had overwritten, while
  retaining the old wording separately.

## 3. Prioritize and process in parallel

Maintain separate identity, photo, description, compatibility and pricing/policy
states for each part. A part moves into a verified batch only when every required
state passes. Record specific hold reasons so the next pass addresses the
remaining issue instead of repeating completed work.

Priority order:

1. Parts with detailed fitment and a usable image that only need manufacturer
   identity/reference checks.
2. Parts with verified identity/fitment that need a replacement photograph.
3. Parts with official catalog evidence but incomplete eBay/MVL reconciliation.
4. Parts requiring broader research, including commercial vehicle applications,
   disputed identities and incomplete catalogs.

Use bounded parallel processing: up to eight image checks/downloads and three
official catalog requests at once. Web searches use batches of up to four queries
with independent batches run in parallel. Production database reads and external
API traffic remain bounded. This is parallel tool/worker processing, not delegated
agents.

Save per-product successes and failures, source URLs, dates, image dimensions and
review decisions. Reuse valid checkpoints. Permit a bounded retry when there is a
new source or a plausible transient failure; do not repeatedly submit unchanged
invalid ePIDs. Staging research never automatically changes review approvals.

## 4. Establish exact product identity

Use official Bosch, Hengst, bilstein group/FEBI and ZF/Lemforder sources where
available. TOP DRIVE needs reliable manufacturer or exact supplier evidence;
another brand's product cannot be substituted because its OE reference looks
similar.

Cross-check brand, exact MPN, supplier OE reference, official article/type and
GTIN/EAN when available. Preserve original and manufacturer reference values.
Only documented aliases are accepted, such as Mercedes OE references with/without
the `A` prefix and Chrysler-family references with/without `K`. Generic suffix
stripping and fuzzy part-number matches do not establish identity.

Use eBay Browse results as candidate evidence. Require an exact brand/MPN title
relationship and inspect the actual listing/gallery information. An ePID alone is
insufficient: detect ePIDs shared across different source identities and hold the
conflict. A generic error page returning HTTP 200 is not an official product page.

## 5. Verify actual product images

Prefer a mapped, full-size official article gallery. Otherwise use a genuine
photograph from an exact-MPN source. Record the URL, source identity, HTTP result,
decoded dimensions and review date.

Inspect the physical product. Reject logos, technical drawings, opaque boxes,
advertising graphics, a visibly different MPN, unclear bundles and unsuitable
watermarks. Check included quantities/components against the identified product.
An HTTP success or a matching filename does not prove that the image is correct.

Use the real high-resolution source. Do not enlarge thumbnails or generate AI
product photos to fill missing evidence. The reviewed-batch audit requires both
image dimensions to be at least 500 pixels; prefer larger clear images.

Review contact sheets for speed and open individual images when a label or part
detail is unclear. Tie approvals to brand, MPN, URL and the saved image's content
hash. A changed image must be reviewed again. The FEBI batch uses official
1500-by-1500 photos; the Hengst batch uses reviewed exact-MPN eBay gallery photos
with official OE identity checks.

Before export, re-fetch each official photo URL and compare its current content
hash to the visual approval. A live image response with changed bytes remains held
until the current image is reviewed.

## 6. Verify vehicle compatibility

The supplier `Vehicle` field is a research clue, not verified fitment.

Use exact official applications where available and eBay product compatibility
data from the supported metadata API. Intersect U.S. applications with the active
production MVL release (`US_MVL_2026_05` for the current evidence). Preserve year,
make, model, trim, engine, submodel, variant, body, platform, vehicle ePID and
original eBay constraints. Keep one detailed compatibility CSV joined by stable
product key and source row.

When an official manufacturer lookup identifies additional applications, those
make/model/year rows may be joined only to exact active production MVL records.
Save the MVL rows as a hash-pinned evidence snapshot, retain their exact trim,
engine, vehicle ePID and release, and label their manufacturer-plus-MVL source
separately from eBay compatibility results.

Check product identity before accepting its compatibility data. Cross-check
manufacturer OE/application evidence against the recorded makes and obvious
vehicle-family conflicts. Official application samples and observed OE rows can
be incomplete; label them as observed evidence, not a complete global list.
Conservative holds may require a fuller official application record.

Do not broaden an engine-specific application to every trim, infer missing years,
or accept a vehicle merely because it appears in MVL. Reconcile the master count
with detailed rows and preserve every restriction when exporting. Cases whose
original restrictions cannot be represented faithfully remain held.

For commercial or international applications, retain actual manufacturer evidence
with its region and limitations. Do not relabel it as U.S. MVL verification. A
missing U.S. match does not justify inventing a U.S. application or declaring the
whole source row complete.

Confirmed incorrect links are cleared from active compatibility fields and kept
only as previous evidence. This includes Hengst E1006L and E1033L: official Scania
records contradict their saved Land Rover and Hyundai/Kia links respectively.

## 7. Write factual descriptions

Describe the verified part type and exact MPN, with confirmed comparison
references and relevant technical facts. Use manufacturer dimensions and fitting
position only when evidence is unambiguous. Avoid unsupported claims about
warranty, approvals, included components, material, condition or universal fit.

Keep supplier text separately from the listing description. Preserve exact MPNs
in titles and keep marketplace titles within the applicable 80-character limit.
Refer to the exact compatibility detail file rather than copying a broad model
range into prose and losing trim/engine restrictions.

## 8. Apply Superior pricing and policies

Use the campaign rate of **3.6725 AED per USD**. Keep the original AED precision,
calculate using decimal arithmetic, select the band from the exact converted cost,
and round only the final selling price to cents. The displayed rounded USD cost
is not the input to the doubled-price rule.

| Exact converted cost | Selling price USD |
| --- | --- |
| 0 through 15 | 38.00 |
| Greater than 15 through 21 | 45.99 |
| Greater than 21 through 25 | 49.99 |
| Greater than 25 | Exact converted cost multiplied by 2, then rounded |

Attach Superior and these policies:

- Shipping: **38.99 USD**, `SUPERIOR AUTO Weight 1-1.99kg on APRIL 2026 Copy (4)`.
- Returns: `30 Days Return Accepted`.
- Payment: `Superior car Payment Policy 1`.

Current application policy IDs and tenant ownership are resolved during an
authorized import; policy names in a research CSV do not prove attachment in
production.

## 9. Export and independently audit CSVs

Produce a versioned full master, a distinct verified-product batch and its exact
compatibility detail CSV. Retain pending/held rows in the master. Use UTF-8 BOM,
proper CSV quoting and stable join keys. Keep research outputs separate from the
application's supported import template.

Use the bundled spreadsheet artifact tool for authoring. Then read back the
actual exported files independently and check:

- All 6,046 rows and original source columns against the XLSX.
- Unique headers, row shapes, distinct batch SKUs and no overlap with prior batches.
- Exact agreement with the prepared export plan and its source hashes.
- Descriptions, title length, MPN preservation, stock and reviewed image evidence.
- AED precision, decimal conversion, every pricing band and all Superior policies.
- Fitment joins/counts and field-for-field preservation of the original detailed
  constraints, including engine, trim and platform.
- Rejected compatibility links absent from active claims.

Render a CSV preview and inspect it. Save audit results, counts and output hashes.
Do not use an audit pass to claim checks beyond what that audit actually covers.

## 10. Import and verify production on demand

After an explicit import request, use SSH as authorized to inspect the supported
application workflow and access server-configured API credentials without exposing
them in chat, logs, CSVs or committed files.

Reconcile existing SKUs within Superior's actual organization/store. Reuse the
correct existing record where appropriate and avoid duplicate or cross-store
inventory. Create the supported import template, upload it, start the import as a
separate step, and track the actual job to completion. Use supported application
operations rather than direct catalog/listing database inserts.

Read back each resulting record and confirm description, product images, exact
fitment, USD price, stock, store and policy IDs. Run the application's current
readiness checks and resolve failures from their actual cause. A local verified
CSV is not proof of production readiness. A production-ready draft is not a live
marketplace listing.

If an application fix/deployment is needed, inspect code and logs, prepare the
concrete fix, follow existing authorization and repository approval rules, update
documentation, and verify the deployed behavior.

For the final system check, inspect all application containers and dependencies,
frontend HTTP behavior, backend/database health, relevant worker/import jobs and
the user-reported Add Part processing flow. Exercise the affected UI/API path;
running containers and one health endpoint do not establish that every flow works.

## 11. Completion standard and current limits

Completion requires evidence for every source row, reconciled output totals, all
required fields verified, and no unresolved issue hidden behind a complete label.
Production readiness is verified separately when import is requested. Keep a
clear list of remaining issues and continue researching them; do not redefine
success around the easiest subset.

**Current state — v94, 2026-10-10:** the full 6,046-row master contains 735 rows
from previous production batches, two legacy published rows, 237 newly verified
CSV rows (175 FEBI, 52 HENGST, and 10 BOSCH), 196 held rows, two research-hold
rows, and 4,874 research-pending rows. The verified rows contain 49,637 detailed
compatibility records. Batch 28 adds BOSCH-3397005046 with an actual 900-by-900
product photo and 12 exact active-MVL applications across Mercedes-Benz S320,
S420, S500, and S600 for model years 1998–1999. Bosch's U.S. application catalog
was checked; year-2000 rows remain excluded because the MVL does not capture the
build-date transition. The independent batch audit passed source preservation,
image content/hash, fitments, pricing, and Superior policies. No production
listing was imported or written; the full workbook remains unfinished.

**Historical v91 snapshot:** the audited state then was 735 rows from previous
production batches, two legacy published rows, 234 newly verified CSV rows (175
FEBI, 52 HENGST, and 7 Bosch), 196 held rows, and 4,879 rows requiring further
research. The verified rows contained 49,414 detailed compatibility records.
Batch 25 adds FEBI 181242 with
18 Tesla Model S fitments for 2015–2019 and Hengst E1776L with 38 BMW M340i xDrive
and Toyota GR Supra fitments. FEBI's official PartsFinder page confirms the ABS
sensor and Tesla OE comparison reference; 18 of 38 raw eBay compatibility rows
match complete active U.S. MVL vehicles. Hengst's official sources confirm the
article, dimensions, EAN, OE references, and manufacturer applications; its 21
eBay fitments plus 17 official application rows match the live production MVL
snapshot. Both actual product photos were visually reviewed and passed fresh live
hash checks. The independent audit passed all 6,046 source rows, fitments, prices,
and Superior policies. Batches 24, 23, 22, and 21 also passed the prior audits. No
production write occurred. The batch 25 Tesla 2018 75D row preserves its exact
year/trim/engine while leaving vehicle ePID blank because active MVL contains two
identical records for those available fields.
Batch 19 adds five FEBI
products with 117 fitments: 108213 and 108214 brake discs for Porsche, 170680 ABS
sensor for Mercedes-Benz, 24771 glow plug for Kia, and 29800 stabilizer link for
Porsche. Each live official PartsFinder page confirms the exact article, product
type, and supplier OE comparison reference. Each current 1500-by-1500 official
gallery photo shows the actual part and passed visual review and a fresh SHA-256
check. The fitment rows match the supported makes and active `US_MVL_2026_05`;
the independent audit passed all 6,046 supplier rows, identity, fitments, prices,
and Superior policies. No production write occurred.
Batch 18 adds FEBI 10266, a
thermostat with sealing ring and official Mercedes-Benz comparison OE 616 200 04
15. Its re-fetched 1500-by-1500 official PartsFinder image shows the thermostat
and seal; the updated bytes passed visual review and an unchanged live SHA-256
audit. Twenty-one exact Mercedes-Benz fitments match active `US_MVL_2026_05`.
The converted cost is $6.47 and the sale price is $38.00 with the agreed $38.99
Superior shipping policy. The independent audit passed all 6,046 source rows,
identity, fitments, image, price, and policies. No production write occurred.
Batch 17 adds BOSCH 0280218002
with 70 fitments: 60 Volkswagen rows from saved eBay compatibility results and
10 Seat Toledo 2001–2004 rows from Bosch's official application lookup matched to
exact active MVL records. The official Bosch page verifies OE 06A906461A, a
five-blade-terminal flange-mounted MAF sensor, and one included sensor. Its
official gallery image shows the actual 1400-by-1400 sensor; the live response's
generic MIME header was validated against the JPEG byte signature and saved
content hash. The independent audit passed exact identity, all fitments, price,
Superior policies, and all 6,046 source rows. No production write occurred.
Batch 16 adds BOSCH 0280218175
with 90 detailed Audi and Volkswagen fitments. Bosch's official U.S. product page
confirms OE number 03H906461 and specifies the sensor type and connector/housing
details; its reverse application lookup agrees with every included make/model/year
row. The live 1500-by-1500 selected photo shows the actual Bosch part with its MPN
stamped on the sensor body and passed a fresh hash check. The independent audit
verified exact ePID, fitments, pricing, policies, and source preservation.
Batch 15 adds BOSCH 0281002956
with 69 detailed Audi and Volkswagen fitments. Bosch's official U.S. application
lookup agrees with each included make/model/year row; exact eBay compatibility
details also match active `US_MVL_2026_05`. The live 1000-by-946 selected photo
shows the actual Bosch-marked MAF sensor and passed a fresh hash check. The
independent audit verified the official OE number 03L906461A, exact ePID, fitments,
pricing, policies, and source preservation.
Batch 14 adds BOSCH 0392020073
with 341 detailed Audi, Porsche, and Volkswagen fitments. Bosch's official U.S.
application lookup agrees with every included make/model/year row; exact eBay
compatibility details also match active `US_MVL_2026_05`. The selected 1500-by-1500
live product photo shows the actual pump and passed a fresh hash check. The
independent audit verified the official Bosch OE references 3D0965561D and
95510656101, exact ePID, fitments, pricing, policies, and source preservation.
Batch 12 adds 37 FEBI parts
with 6,807 exact U.S. fitment rows. Its 37 official 1500-by-1500 photo responses
were visually reviewed from current raw bytes and independently re-fetched with
unchanged hashes. Batch 13 adds HENGST E1000L with 156 Volvo fitment rows. Its
exact-MPN retailer product photo was visually checked at 1500 by 1500 pixels and
the live SHA-256 matched the approval at audit time; official HENGST catalog
evidence independently establishes the product type, dimensions, EAN, and OE
references. The selected eBay gallery image was only 640 by 480 and was replaced
through an explicit evidence-linked photo review. HENGST E1722L remains held
because its actual-part gallery image is only 480 by 480 and the higher-resolution
alternatives did not pass identity/visual review. Batch 14's audit verified all
6,046 source rows, pricing and policies, saved eBay identity and compatibility
source, 341 exact active-MVL details, current photo bytes, and no overlap with
earlier batches. The next-batch preparer rebuilds make/model/year summaries from
selected detail rows and does not bridge missing years. Batches 3–20 remain local
CSVs and have not been imported or checked by production preflight. The whole
workbook remains unfinished. The eBay Browse API request returned HTTP 429, so
the saved eBay Sell Metadata API compatibility evidence was reused; no production
writes or email occurred.

Batch 10 adds FEBI 11816
with its official drag-link image, matching BMW OE reference, exact eBay catalog
identity, and 24 detailed BMW fitments. It also adds FEBI 22251 with its official
water-pump-and-seal image, matching Land Rover OE reference, and 986 supported
Ford, Jaguar, Land Rover, and Mazda fitments. The other 53 eBay compatibility
rows for Lincoln and Mercury were excluded because they were not supported by the
official reference evidence. Both products have factual official descriptions,
live image URL/hash checks, Superior price/policy fields, and passed the
independent batch audit. The batch contains 1,010 detailed fitments. Batch 5 adds
FEBI 27086 with
the official steering boot kit description, matching BMW OE reference, a visually
reviewed 1500-by-1500 official photo, and 90 preserved BMW compatibility rows from
the active U.S. MVL. Batch 6 adds ten FEBI products with live-checked and visually
reviewed official full-size photos, product-specific catalog descriptions, and
7,750 detailed fitment rows. Batch 7 adds BOSCH 0261210364 with the exact official
Porsche OE reference and 71 fitments. Batch 8 adds BOSCH 0261210199 and
0261210147 with 545 fitment rows; for 0261210147, 148 Volkswagen rows pass the
official make check and 66 Audi rows remain excluded pending an official
application source. The Volkswagen (VW) catalog label is normalized to the
eBay/MVL make without broadening vehicle rows. Batch 4 has 33 products and 7,645
exact compatibility rows; official identity evidence was collected for 100
Hengst products. Batch 9 adds FEBI 47894 with its re-reviewed official 1500-by-1500
gallery image and 154 detailed BMW rows. Four Lexus rows returned for its ePID are
excluded because the official FEBI article lists BMW references only. The image
content hash changed since its previous review; the superseded hash is retained in
the review history. Audits for batches 3–11 passed. These batches remain local
CSV outputs and have not been imported or checked by production preflight. The
full workbook remains unfinished, and no new production import or email is part of
this CSV preparation session.

The 2026-10-10 read-only production comparison found all 600 batch-one SKUs and
matching listing core fields. Production's actual fitment selector uses normalized
`fitment_rows` when valid, otherwise it uses valid `fitment_data`. Its selected
compatibility payload exactly matches the canonical MVL rows for 598/600 products
(85,094 rows). E989LC01-2 has 10 extra Mercedes rows in the selected normalized
source; E5KFR2 D12 has four Aston Martin rows instead of the four reviewed Mercedes
rows. Their raw catalog `fitment_data` matches the CSV, but the selected publish
source does not. This batch remains uncertified until those sources and attached
store policies are reconciled through the supported application workflow. No
production writes occurred during the audit. The public app and `/api/health`
returned HTTP 200 with database and memory checks up; all five production
containers were running, with backend, PostgreSQL, Redis and PgBouncer healthy.
The Auto Parts workspace redirects to login, so the signed-in Add Part flow was not
exercised.

The live official-photo recheck returned 117 HTTP 200 JPEGs, but only 13 current
image hashes matched saved approvals. The other 104 remain held for re-download
and visual review. The next-batch planner now checks live image hashes against the
visual approval before accepting an image.

Implementation and rebuild commands are documented in
`docs/operations/DYNATRADE_CSV_ENRICHMENT.md`.
