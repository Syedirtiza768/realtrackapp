# FEBEST existing-listing baseline audit

Inspected 2026-09-14 using user-approved, read-only production queries. No production records, queues, exports, or live eBay listings were modified. This audit supports `FEBEST_ENRICHMENT_IMPLEMENTATION_PROMPT.md`.

## Evidence scope

SSH recovered on retry. Queries ran inside `BEGIN READ ONLY` transactions with a statement timeout. The current database returned no FEBEST matches in `catalog_products` (brand/title/SKU) or `listing_records` (brand/title/SKU). The sample was found in **`ebay_published_listings`**, the application's synced eBay listing cache. A broad substring filter on title, SKU, or item specifics returned 147,163 candidate rows. That is not a count of distinct FEBEST parts, active listings, or brand-verified inventory.

The approved sample contains exactly 12 listing IDs and 11 distinct SKUs: the 12 longest stored descriptions among those candidate rows. Every selected row has item-specific Brand FEBEST. This is a deliberate long-description sample, not a statistically representative sample and not proof these are the highest-quality listings. It contains 4 active, 6 ended, and 2 out-of-stock records, all marked `EBAY_MOTORS_US`. Snapshot synchronization dates span 2026-08-16 through 2026-09-13. They are stored production snapshots, not fresh GetItem responses. Manufacturer facts and every old application have not been independently revalidated.

Sources: `FEBEST_BASELINE_SAMPLE.json` (the approved records), `FEBEST_BASELINE_METRICS.json` (derived measurements and snapshot hash), `FEBEST_BASELINE_IMAGE_CHECKS.json` (three direct image retrievals). The earlier local output-workbook search produced no actual FEBEST product rows; its brand-option matches are excluded from this baseline.

## Actual nomenclature

The predominant pattern is **FEBEST + year range + vehicle make/model + part name/position + exact MPN**. Nine of the twelve sampled titles start with FEBEST/Febest; three start with an Italian part name. MPN appears at the end. Trimmed title lengths are 49–73 characters. Some copied source titles contain formatting characters, so normalize whitespace and validate the final string separately.

Three English examples, verbatim from the approved sample:

- `FEBEST 91-06 Toyota Corolla Front Axle Sealing Ring 88430-182422X` — record `be28b391-2d39-434d-885f-e88f8a03cd23`.
- `Febest 1999-2014 Cadillac Escalade Ball Joint Front Lower Arm 3220-001` — record `b7f8a406-5e27-478b-8abd-f1cd649029cb`.
- `FEBEST 1999-2013 Cadillac Escalade Pitman Arm 3226-ESC` — record `13f9a8a7-2847-4e5a-a5be-9ac90bbf3723`.

All 12 seller SKUs equal the manufacturer part number in the record. Retain that convention when no collision exists; a new `FEBEST-` prefix would be a departure from this sample. Two records share SKU `88430-182422X` with different languages/status, demonstrating why identity, marketplace, account/store, and status matter when checking for existing listings.

For new copy use `FEBEST [verified YYYY-YYYY] [verified Make Model] [accurate Position/Part Type] [exact MPN]`, with the year/vehicle segment omitted if unsupported. Prefer four-digit years, US-English terminology, meaningful side/size/kit qualifiers, and brand/MPN preservation within 80 characters. Do not reproduce a broad min-to-max year span across unsupported gaps. Choose the title's vehicle deliberately from supported US applications, not simply the oldest first table row. Keep all supported applications in the compatibility data even when only one vehicle appears in the title. This naming convention is an editorial reference, not evidence of fitment.

## Measured content baseline and defects

- Each description has one Product Information introduction, one Make/Model/Year compatibility table, and five commercial-policy sections implemented with styled radio-button tabs.
- HTML size is 6,477–8,664 characters; total visible text is 326–445 whitespace-delimited words. **Actual part-specific introductions contain only 31–44 words.** Large HTML or table size is not an elaborate technical description.
- Each HTML compatibility table contains 52–96 data rows. These are presented application claims, not verified manufacturer-supported/eBay-valid fitments.
- Four stored compatibility objects contain `compatibleProducts: []`; eight are null. Thus none of these 12 snapshots provides nonempty structured compatibility despite the HTML tables. This does not prove the live eBay listings lack compatibility: incomplete/stale sync is possible. Do not convert HTML row count into an eBay-fitment completeness score.
- All 12 stored category IDs/names and catalog-product links are null. The published cache cannot supply a reliable import category or canonical-catalog linkage for these examples.
- Image counts are 1 on nine records and 2 on three records. Three primary image URLs were fetched successfully and decoded: `3226-ESC` 400x391, `3220-001` 400x298, and `88430-182422X` 400x400. These are the actual responses from the stored `$_1.JPG` URLs, regardless of larger-looking URL path metadata. Original uploads may be larger; do not claim these observations measure the original assets or prove current eBay noncompliance. Do not reuse thumbnail endpoints for the enriched output; resolve genuine high-resolution manufacturer assets.
- All 12 have Brand FEBEST and an MPN in item specifics, but keys and values mix English/French/Italian. Ten include Manufacturer/Fabricant/Produttore = `Markenlos`, conflicting with the manufacturer identity. A raw count of 5–11 specific keys overstates completeness where aliases repeat the same fact.
- Several US records have non-English or mixed-language titles, descriptions, and condition labels (`Nuovo`, `Neuf`); two condition fields are null. These are evidence of inconsistent stored locale, not permission to assume new stock for every incoming part.
- Generic claims include OE/OES quality, direct fit, engineered durability, origins, and sometimes a one-year warranty without supporting source evidence in this sample. Reverify before using them. Features such as Greaseable, detailed dimensions, and package weight are useful only when confirmed against the exact manufacturer part.
- Policy boilerplate says no returns, worldwide couriers, and three working days. The currently inspected generic pipeline instead hardcodes 14-day returns. Neither text should override the selected seller's actual policies.

## Required improvement over this baseline

Keep the brand-leading/MPN-trailing title convention, original MPN-based SKU mapping when safe, clear product introduction, labeled OE cross-references, and buyer-readable application information. Improve factual detail rather than reproducing the bulk of HTML, policy tabs, broad year unions, or unsupported marketing.

New records must have consistent US English; verified aftermarket identity and condition; current appropriate US leaf categories; non-conflicting normalized specifics; original-resolution exact-part images; source-backed applications with restrictions; and accepted structured compatibility that survives serialization. Description and compatibility data must agree. Required kit/position/size distinctions must survive title shortening.

Use meaningful specification and package-content sections, supported application summaries and limitations, and evidence-backed copy. The proposed 90/100 score is a new acceptance rubric, not a measured score of these existing listings. Factual accuracy cannot be numerically benchmarked from these cached records alone. Compare observed editorial structure/identifier preservation now, and score fact/fitment dimensions only after manufacturer evidence is checked. A baseline defect is never a quality requirement to reproduce.

## Sample measurements

| SKU | Record ID prefix | Status | Title chars | Intro words | HTML application rows | Images |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 88430-182422X | 0b8166be | ended | 73 | 40 | 96 | 1 |
| 3226-ESC | 13f9a8a7 | active | 54 | 40 | 59 | 2 |
| ADSHB-A4IIIR-KIT | 5a8cd126 | out_of_stock | 68 | 39 | 62 | 1 |
| 88570-165 | 89ea8c2f | ended | 49 | 32 | 70 | 1 |
| 88570-164 | a4a42e0f | ended | 60 | 31 | 61 | 1 |
| 3220-001 | b7f8a406 | active | 70 | 32 | 76 | 2 |
| 88430-182422X | be28b391 | active | 65 | 36 | 96 | 1 |
| 88570-105 | c7eaea3d | ended | 54 | 44 | 64 | 1 |
| 95GAY-33430707C | d5a89475 | ended | 73 | 36 | 78 | 1 |
| 2385B-001 | ed5a95f2 | active | 56 | 36 | 63 | 1 |
| 2074-FLAVF-KIT | eee9755c | ended | 64 | 44 | 52 | 2 |
| 01640-008 | f8322e79 | out_of_stock | 57 | 38 | 61 | 1 |

## Confirmed image sourcing instruction

The user explicitly requires all new enrichment images to be fetched from the FEBEST website and the official image CDN linked by exact-product pages. Existing eBay image checks in this audit are baseline diagnostics only. They do not authorize those images as enrichment sources. Missing or insufficient official imagery must be reported as unresolved rather than replaced by reseller/eBay/AI images.
