# Automotive catalog staging pipeline

The source-sheet intake for eBay automotive parts is additive and separate from enrichment. `scripts/catalog-staging-pipeline.mjs` reads the source CSV, writes an auditable staging package, and can insert the source rows into `catalog_products` and `listing_records` without clearing either table.

Run it inside the backend runtime, which provides the PostgreSQL driver and the application environment:

```bash
node scripts/catalog-staging-pipeline.mjs \
  --csv /app/output/ebay-pipeline/napa_ebay_shopify_listings.csv \
  --mode stage-and-import \
  --output-dir /app/output/ebay-pipeline
```

The run creates `*.catalog-staged.csv`, `*.enrichment-queue.csv`, `*.ebay-listings-staged.csv`, and a manifest. The catalog import creates one `catalog_imports` record and one `catalog_import_rows` outcome per source row. Existing SKUs or UPCs are recorded as duplicate skips; the script never wipes catalog tables and never invokes an eBay publish operation.

The intake stores source titles and identifiers with `optimization_status=pending` and `fitment_status=pending`. Manufacturer URLs are source references for the later image and fitment pass; they are not treated as verified image URLs. The enrichment stage must populate and validate SEO/title, images, and fitment before a listing is considered publishable.



## SEO and image enrichment

The SEO stage uses `scripts/seo-enrich-catalog.mjs` to create eBay-safe titles, neutral descriptions with identifiers, and review statuses. It checks eBay Browse API identifier matches first. For NAPA rows, `scripts/napa-official-image-resolver.py` resolves only exact official NAPA Canada product pages and direct media assets; `scripts/merge-official-napa-images.py` merges those matches into the export. `scripts/apply-seo-enrichment.mjs` applies the final CSV to `catalog_products` and `listing_records` in one transaction, leaving vehicle fitment pending and avoiding live eBay publishing.

The September 20, 2026 run used model setting `gpt-5.6-luna` for 866 source rows and 838 catalog products. Source brands were Napa (765), SKF (72), Mevotech (28), and Delphi (1). SEO titles and descriptions were completed for all rows. Validated images were available for 460 rows (414 eBay Browse API assets and 46 exact official NAPA Canada assets); 406 rows remain flagged for image review, and all rows remain fitment-pending.

### FEBEST source image resolution

Trusted pre-enriched FEBEST imports can contain official `catalog.febest.eu` image URLs under `/product_photos/200/`. `PipelineOutputImageService.mirrorApprovedImageUrls` checks the matching `/product_photos/1600/` photo or diagram URL before mirroring it. A verified full-size image is stored and used; missing or unreachable full-size variants retain the supplied source URL. This promotion is restricted to the exact official FEBEST host and supported photo/diagram paths, so unrelated image providers are unchanged.


## Fitment and vehicle-aware title enrichment

The runtime listing optimizer has an exact-part fallback when no bounded
year range is already present. It searches eBay Browse using the product brand
and MPN, keeps hints only when the returned listing's Brand and MPN match
exactly after separator/case normalization, and validates each Year/Make/Model
against the target marketplace MVL. Only complete, MVL-valid, contiguous
ranges within the configured fitment span may guide a draft title. eBay seller
listing aspects are leads, not an OEM application catalog: the candidates are
stored in `fitment_rows` as `needs_review`, and are excluded from
`fitment_data`, generated descriptions, AI fitment input, and publish
compatibility. Confirm the part-specific application against an authoritative
catalog/VIN before approving compatibility. If lookup or MVL evidence is
missing, the system keeps the item in review instead of inventing a range.

A source filename formatted as YYYY MAKE MODEL plus a 17-character VIN can
supply the donor vehicle when the product's donor fields are blank. The parser
canonicalizes the known source spelling Infinity to Infiniti. A donor-only
year supplies vehicle context only and cannot establish part compatibility.
Title ranges, including a one-year range, must come from part-number-matched
fitment years that are contiguous and pass target-market MVL checks. Exact-MPN
lookup uses the canonical donor make when the catalog brand also includes a
model. The underlying lookup rows remain review-only; when no supported range
is available, optimization is blocked instead of using the donor year or a
whole-platform span. The optimizer verifies that the title begins with the
same evidence-backed range and blocks optimization when the range is missing
or differs.

### Donor-year fallback correction — Golf GTI pipeline (2026-10-08)

Pipeline `7239edb3-770b-4b18-a60f-288b5bdeba8c` contains 145 catalog products
from `2013 VOLKSWAGEN Golf GTI WVWDH2AUXEW052991.xlsx`. The earlier title
builder incorrectly used the donor year as an anchor for platform-generation
alignment, so titles could start with `2013` even though the product had no
part-specific fitment. The filename's year also conflicts with the VIN's
model-year code (`E` denotes 2014); neither value establishes a part's
application.

Optimization version 8 removes that donor/platform fallback and excludes
platform-generation, sibling-part, and unvalidated review rows. A title year
(or single-year title range) requires exact MPN lookup or OEM catalog
Year/Make/Model evidence that passes the target marketplace MVL. Multiple
years must be contiguous and within the configured fitment span. Review-only
exact-part candidates may guide draft titles but do not become `fitment_data`
or publishable compatibility. Products without supported evidence receive
`TITLE_YEAR_RANGE_MISSING` and stay blocked for review until an authoritative
part application is available.

The fix is deployed as `realtrackapp-backend:title-fitment-20261008-v3`; backend
and public health checks passed. Deployment did not mutate the job. All 145
stored products remain on optimization version 5, with no `fitment_data` and
no year-range-prefixed titles. The seven screenshot MPN rows still contain
only rejected donor-vehicle rows. Run **Optimize All** on this job to invoke
the version-8 exact-MPN lookup. The **Optimize All** operation forces a full
refresh even when the job was already `needs_review`; per-product fitment and
title guards still block unsupported ranges. No eBay listing or compatibility
publishing occurs during optimization.

### Cited OEM catalog fallback and model/trim validation — optimization v10

When an Auto Parts title has no complete, target-MVL-checked exact-part range,
`OemFitmentLookupService` asks OpenRouter `openai/gpt-6-luna` to search OEM
parts catalogs. It accepts a result only when the exact MPN, vehicle make,
requested model variant, year endpoints, and URL all appear in returned cited
page evidence; marketplace listings, forums, and generic year/platform hints
are not enough. Model and trim are kept separate (for example, `Golf` +
`GTI`) for target-MVL validation and title-range grouping. A catalog may show
those as separate model and trim entries; both target tokens must appear in the
cited exact-part application, even when they are not adjacent in the page text.
The exact part catalog range must be contiguous and within
`MAX_FITMENT_YEAR_SPAN`.

Accepted OEM rows are stored in `fitment_rows` as `needs_review` and must pass
the target marketplace MVL before they can guide a draft title. They remain
excluded from `fitment_data`, descriptions, AI compatibility input, and
publishable eBay compatibility. Donor years and platform generations never
fill a missing part range. If exact cited evidence or the target variant is
not available, optimization stays blocked with `TITLE_YEAR_RANGE_MISSING`.
Concurrent catalog searches are bounded to four per backend process. The
optimization version is 10 so stale products are eligible for re-enrichment.

GPT-6 Luna and OpenRouter's web-search server tool are the runtime model and
citation sources for this fallback. Search explicitly pins Exa, limits each
lookup to two queries and ten total results, and estimates Exa at $0.007 per
query in AI cost reporting. GPT-6 Luna is $0.10/M input and $0.50/M output
tokens. See [OpenRouter GPT-6 Luna](https://openrouter.ai/openai/gpt-6-luna)
and the [OpenRouter web-search documentation](https://openrouter.ai/docs/guides/features/server-tools/web-search)
and [web-search engine pricing](https://openrouter.ai/tool/web-search/).

### Complete-range OEM search and MVL model normalization — optimization v11

The lookup now searches multiple exact-MPN catalog queries to identify the
complete contiguous application range. A year-specific donor/dealer page is
not treated as the complete range when the source only shows one sampled
vehicle. A one-year application is retained only when exact-part catalog
evidence establishes that it is genuinely limited to that model year.

Catalog responses sometimes return a combined value such as `Golf GTI` even
though the marketplace MVL represents it as model `Golf` plus trim `GTI`.
`FitmentDiscoveryService.normalizeOemCatalogModelToMvl` maps the returned model
to an actual canonical marketplace model, preserving remaining target tokens
and cited trim descriptors in the trim field. If no canonical model can be
matched without losing the requested variant, the row stays blocked. OEM rows
remain review-only and cannot approve or publish compatibility.

### Complete title ranges across catalog trim wording — optimization v12

The title builder groups verified year rows under the requested target variant
when catalog sources use different detail levels for its trim (for example,
`GTI` and `GTI Autobahn Hatchback`). It keeps the same make and canonical MVL
model, requires every requested variant token, and accepts only a complete
contiguous year sequence within the configured span. Generic-model titles keep
their exact trim scope. These exact-MPN rows can shape a draft title while
remaining review-only and outside publishable compatibility.

### Use explicit exact-MPN OEM intervals when MVL omits year rows — optimization v13

When the target-MVL year rows have a gap, the title builder can use an
inclusive interval stated in cited OEM catalog evidence for the exact MPN. The
source line must match the target make and application variant; the evidence
must contain the product MPN; and the interval must fit the configured year
span. Conflicting or unmatched intervals do not supply title years. Synthetic
years exist only during title generation: source evidence remains in
`fitment_rows` with `needs_review`, and `fitment_data`/publish compatibility is
unchanged. A title range therefore reflects the cited OEM interval without
pretending that missing MVL rows were individually validated for publishing.

### Validate cited evidence independently of the model flag — optimization v17

The OEM lookup does not discard a response only because GPT-6 Luna marks its
own result unverified. When a cited URL and short exact excerpt are present,
the server independently checks the exact MPN, requested make/model/trim, and
both explicit year endpoints. A missing citation or any mismatch still blocks
the title. Accepted ranges remain title-only review evidence, not approved
compatibility. This lets a conservative model flag coexist with a complete,
checkable citation without weakening the evidence checks.

### Extract year ranges from exact-MPN citations — optimization v18

GPT-6 Luna's search output may contain valid OpenRouter/Exa citations while
ending before its JSON summary. `OemFitmentLookupService` now parses those
citation excerpts directly, so a truncated model summary does not discard
usable catalog evidence. Search volume and reasoning are capped for this
lookup lane.

A range must appear on a catalog product page whose title or URL identifies the
exact MPN and whose fitment text names the requested make/model/trim. A date
break caps the range only when the exact MPN row is followed by a different
part-number suffix for the same option-code row. The title builder can use an
exact, cited OEM interval when a marketplace MVL has no corresponding model;
those rows remain review-only or rejected, are excluded from `fitment_data`,
and cannot be published as compatibility. Combined `Plymouth Prowler` brand
values are split into make/model so exact-part lookups run instead of being
skipped for a missing model.

### Retry truncated exact-MPN responses — optimization v19

The production sample showed that Exa can return citation URLs while Luna uses
the entire 900-token completion allowance before producing its JSON range.
The exact-MPN lookup now makes one search with a compact prompt and an 1,800
token output cap, then retries once at 2,600 tokens only when the provider
reports a truncated response. The retry asks for compact JSON and exact source
excerpts; the server still requires the exact MPN, source URL, requested
vehicle, explicit year endpoints, and a catalog/dealer source. Search uses
remain capped at one per attempt, and no whole-pipeline retry is launched.

Optimization version 19 reprocesses only products whose saved optimization
version is stale or whose title still lacks a complete year-range prefix.
Accepted OEM intervals remain draft-title evidence only; they do not add
compatibility rows or publish listings.

### Read exact MPNs from catalog diagram bodies — optimization v20

Some genuine parts diagrams have a parent-assembly title and URL while the
diagram body lists the exact requested MPN alongside its model-year table.
`OemFitmentLookupService` now validates the exact MPN in the cited body rather
than requiring it in the page title or URL. It still requires the OEM/catalog
source marker, requested model/trim, and complete year range on that same page.
Optimization version 20 retries only products whose saved version is stale or
whose title is still missing its year-range prefix.

### Alternate search for rejected exact-MPN evidence — optimization v21

If the first exact-MPN response is truncated or the returned source/range fails
server validation, the lookup makes one alternate exact-MPN catalog search at
the larger output cap. A lookup that already returned a validated range does
not incur another search. The alternate query can find an exact part row and
vehicle application on another catalog diagram page, but it is subject to the
same exact-MPN, make/model/trim, source, and explicit-endpoint checks. It never
substitutes a donor year or whole-generation interval. Optimization version 21
applies this bounded retry only to missing-range or stale products.

### Accept exact MPNs in catalog page identity — optimization v22

Some exact OEM product pages place the MPN in the URL or page title while the
search excerpt highlights only the vehicle-application table. The exact-MPN
matcher accepts a complete identifier token in either the cited page identity
or body, then still requires an OEM/catalog source marker plus the requested
make/model/trim and explicit contiguous year endpoints from that same cited
page. This change reduces missed exact-part evidence without allowing donor-
year or whole-generation guesses. The resulting fitment rows remain
review-only title evidence and cannot authorize compatibility or publishing.

### Reject replacement-only MPN references — optimization v23

Exact part matching now preserves identifier boundaries across common MPN
punctuation and rejects a base number when the cited page shows it only as a
replaced, superseded, or interchangeable reference to a suffixed part. An
exact MPN in a catalog page title or URL remains acceptable when that same
page explicitly shows the requested vehicle and complete year endpoints.
These checks keep the saved evidence tied to the actual requested part while
retaining title-only review status.

### Improve exact-part search and VW Golf GTI catalog labels — optimization v24

The first Exa query now searches the exact quoted MPN by itself so the catalog
product page is found before donor details can narrow or misdirect results. If
that query does not return usable evidence, one separate retry searches the
same complete MPN with the requested vehicle and part name. Each attempt stays
at one query; up to five results and medium excerpts provide more of the
catalog's application table without repeating a pipeline-wide pass.

US Volkswagen catalogs sometimes identify Golf GTI as model `GTI`. The
validator accepts this precise alias only when the target is Volkswagen Golf
GTI, the cited page identifies the exact OEM MPN, and the same source excerpt
explicitly names GTI. Generic Golf applications remain insufficient. The
range continues to require explicit endpoints, exact MPN evidence, and an OEM
catalog source; it stays review-only and title-only, outside `fitment_data` and
publish compatibility.

### Search every applicable Prowler catalog year — optimization v28

The Prowler search now explicitly targets the archived Mopar factory catalog
PDFs for 1997, 1999, 2000, and 2001, and an exact-fitment source for the 2002
endpoint. The alternate search targets those year-specific factory pages when
the initial results only expose a later-model product page. This avoids
truncating a part's historical Prowler application to a current dealer page.
The exact-MPN, component-context, actual-model-year coverage, review-only, and
no-publish checks from v27 remain required. Optimization version 28 retries
only unresolved products.

### Combine exact-MPN year catalogs — optimization v27

`OemFitmentLookupService` now reads both explicit year intervals and
year-specific factory catalogs. For a single-year catalog citation, the page
identity must name the target model and model year, and the cited page body
must place the exact MPN next to the requested component. The optimizer unions
those exact-part years with any explicit exact-part intervals, then requires
support for every actual target model year between the resulting endpoints.
Missing years are never filled just because a model generation is continuous.

Prowler catalogs commonly omit the leading zero from legacy `0LP...` MPNs, so
that complete-token alias is permitted only for Prowler. The Prowler model-year
set is 1997 and 1999–2002, as recorded in the NHTSA [CarGroup2011
reference](https://static.nhtsa.gov/nhtsa/downloads/CURTAIN/CarGroup2011.pdf);
there is no 1998 model year. The 1997–2002 `0LP78LAZ` title range is therefore
supported by its exact MPN in 1997/1999/2000/2001 factory service catalogs and
the exact Mopar part page's 2001–2002 application. The 1998 gap is excluded from
the saved review rows while the title uses the complete endpoint range.

Year-specific OEM rows remain title-only and `needs_review`; no rows are added
to `fitment_data`, and compatibility publishing remains disabled. Optimization
version 27 retries only products whose saved version is stale or whose title
still lacks a supported range.

### Require part-specific intervals from cited catalog text — optimization v26

`OemFitmentLookupService` now authorizes a year interval only when its parser
extracts that explicit interval from the cited catalog title, URL, or page
excerpt. A model-generated JSON answer or evidence quote cannot stand in for
the catalog text. The interval context must include the exact MPN or the
requested part name, so a generic vehicle-generation heading cannot widen the
part's actual application. Prowler searches include year-specific Mopar
diagrams and exact-MPN Prowler listings; factory catalogs may corroborate a
named model year but a platform heading alone is insufficient.

When three targeted searches still do not expose a cited, part-specific range,
the product stays blocked with `TITLE_YEAR_RANGE_MISSING` for the next targeted
review. No donor-year or platform-range fallback is allowed. OEM rows remain
review-only, never populate `fitment_data`, and do not trigger publishing.
Optimization version 26 retries only the unresolved product entries.

### Diversify exact-MPN catalog searches for misses — optimization v25

Each first lookup uses two distinct Exa searches: the quoted complete MPN with
OEM/catalog terms, and the same MPN with the requested vehicle, part name, and
fitment/application terms. A product that still has no validated result gets
one different alternate query, including the hyphenated MPN form when helpful.
Search is capped at three requests per unresolved listing; successful lookups
do not incur a retry. The optimizer queues only products missing a supported
title year prefix, never a completed product pass.

Exact MPN and same-page vehicle/application/year requirements remain in force,
including the narrow VW `Golf GTI`/`GTI` catalog alias. Intervals are still
review-only title evidence and do not populate `fitment_data` or approve
marketplace compatibility.

### Reuse exact excerpts from URL-only Exa citations — optimization v16

OpenRouter may return an Exa source URL and title without a page-body excerpt.
GPT-6 Luna now supplies one short exact excerpt from that cited page; the
server checks the excerpt for the exact MPN, make/model/trim, and both explicit
year endpoints before accepting the interval. The cited URL must still match
the returned source and identify a catalog, dealer, OEM, application, or parts
diagram. The citation is title-range evidence only and cannot populate publish
compatibility. The Plymouth/Chrysler make transition is recognized only for
Prowler, whose model continued across the brand change. Optimization v16
retries previously blocked products using this stricter citation path.

### Read catalog evidence from cited page bodies — optimization v15

Some reputable parts-diagram pages give the exact MPN and vehicle fitment in
the diagram/table body while their page title and URL use a generic component
name. The OEM lookup therefore classifies the source from cited page content,
title, and URL. This only admits a page to further validation; the exact MPN,
make/model/trim, and both explicit year endpoints must still match the citation.
The resulting interval remains title-only review evidence and cannot populate
publish compatibility. Optimization v15 retries previously blocked products
against this corrected evidence gate.

### Reuse saved exact-MPN year evidence — optimization v14

Fitment discovery now uses the same citation matcher as title generation. If
stored rows came from the exact product MPN, passed MVL model/trim validation,
and cite one unique inclusive application interval for that vehicle, the next
optimization run reuses that interval instead of making another eBay Browse or
GPT-6 Luna OEM catalog request. Missing, ambiguous, conflicting, or mismatched
citations still trigger enrichment when possible and never supply a title
range. When a lookup is needed, GPT-6 Luna also searches manufacturer parts
diagram synonyms (such as bumper beam or side reinforcement) and briefly caches
the result for duplicate exact queries. OEM evidence is accepted only when its
leading exact-MPN statement matches the current product identifier. Reuse does
not expand `fitment_data`, change review status, or enable publishing.

### Production title-range retry — uploads 236, 235, and 234 (2026-10-06)

The isolated backend release `realtrackapp-backend:title-range-20261006` is
healthy; rollback image `realtrackapp-backend:pre-title-range-20261006` remains
available. Optimization retries completed for `UPL-2026-000235` (`30 sep.xlsx`)
and `UPL-2026-000234` (`29 sep.xlsx`). The exact Brand+MPN Browse fallback
found one usable hint for UPL-234: MPN `613507199885`, BMW 328I, year 2011. The
hint passed US MVL and supplied a draft title beginning `2011 BMW 328I`; its
fitment row remains `needs_review`, not approved compatibility. The other 72
UPL-234 rows and all 53 UPL-235 rows remain blocked with
`TITLE_YEAR_RANGE_MISSING` because no usable exact-part year evidence was
found. Final outcome: 0 pass, 1 review, 125 blocked across both uploads. Those
125 blocked records are drafts. One UPL-234 record (`BU1-15375`, eBay item
`307197235705`) is a pre-existing published listing; its local title still has
no year range and it remains blocked. The retry did not invoke eBay listing or
compatibility publishing.

UPL-2026-000236 (`1 oct.xlsx`) is unchanged and already has year-prefixed titles
on all 84 persisted listing records. The two older workbooks have no
Year/Make/Model/Fitment/Compatibility columns and date-only filenames. Keep rows
without supported exact-part evidence blocked until an authoritative fitment
source is provided; do not infer ranges from the upload date or donor alone.

### OEM catalog title follow-up — UPL-2026-000235 (2026-10-06)

An exact part-number review of the nine visible listing rows produced five
supported applications that also exist in the active US MVL (`US_MVL_2026_05`):

| SKU / MPN | Title application | Catalog evidence |
|---|---|---|
| `BU1-15777` / `284A11CA1E` | 2011 Infiniti FX35 | [Official INFINITI Parts Store](https://parts.infinitiusa.com/v-2011-infiniti-fx35--base--3-5l-v6-gas/electrical--parking-aid) |
| `BU1-15789` / `82662-02660` | 2014-2016 Toyota Corolla | [Toyota dealer OEM catalog](https://parts.longotoyota.com/oem-parts/toyota-fuse-and-relay-center-cover-8266202660); names the part as a fuse and relay center cover |
| `BU1-15794` / `8K0839016D` | 2010-2015 Audi A4 | [VAG OEM catalog mirror](https://oemwolf.com/oem-parts/8k0839016d.html) and a genuine Audi replacement catalog; range is the overlapping US application |
| `BU1-15765` / `4L0910441A` | 2007-2009 Audi Q7 | [VAG OEM catalog mirror](https://oemwolf.com/oem-parts/4l0910441a.html); PR-code 7X9 camera option applies |
| `BU1-15746` / `4H0959107AC` | 2015 Audi A8 Quattro | [VAG OEM catalog mirror](https://oemwolf.com/oem-parts/4h0959107ac.html) |

These title ranges are stored as source-noted `oem_catalog_lookup` rows with
`validationStatus=needs_review`, `mvlStatus=valid`, and `reviewOnly=true`.
`fitment_data` remains empty, so the lookup did not approve marketplace
compatibility. All five listing records remain drafts with no eBay listing ID.
The other four visible part numbers stay blocked because research did not
establish an exact, sufficiently supported US application.

During the product-level retry, generic platform/sibling expansion widened
three titles (Toyota Corolla, Audi A4, Audi Q7). The expanded rows and generated
compatibility data were removed; those titles were reset to the exact OEM
application ranges, and all five products remain in manual review. Avoid
force-retrying these records until title selection uses exact part-number
evidence in preference to platform expansion.

### Production application — Infiniti Q50 pipeline (2026-10-04)

For pipeline job `35833336-07b2-42b3-8661-083390b55e12`, 61 active eBay
Inventory listings were revised with the complete contiguous title range for
their stored MPN. Each Inventory item was read back after the update. Its
catalog product and listing record titles were synchronized, along with the
pipeline CSV `Title` cells; a timestamped copy of the original export was kept
beside it. All final titles begin with `YYYY-YYYY Infiniti Q50` and are no more
than 80 characters.

The pipeline also contained one soft-deleted transmission draft. Its internal
title and CSV cell were corrected, while `deletedAt` and draft status were
preserved; it has no live eBay listing. All 62 rows remain under manual fitment
review. The title ranges did not change `fitment_data`, compatibility rows,
compatibility publication, condition, price, quantity, or listing status. See
[`OEM_FITMENT_LOOKUP_2026-10-04.md`](OEM_FITMENT_LOOKUP_2026-10-04.md) for the
applied MPN ranges, source links, and part-specific caveats.

This runtime fallback is separate from the guarded file-based pass below.

The guarded fitment pass uses `scripts/fitment-ai-discover.mjs` with model `gpt-5.6-luna-20260709` to propose applications from the exact brand, MPN, product type, and UPC. `scripts/fitment-apply.mjs` validates each candidate against the local US eBay MVL release `US_MVL_2026_05` before writing `fitment_data`, `fitment_rows`, `fitment_status`, and `fitment_confidence` to the matching catalog SKU. It also emits eBay File Exchange compatibility continuation rows as `Relationship=Compatibility` with Year/Make/Model details.

The September 20, 2026 pass processed all 866 rows. Seventeen rows produced 33 applications that passed MVL validation and received vehicle-aware titles under 80 characters; 849 rows remain `fitment_pending` because no verified part-to-vehicle mapping was available in the input or approved source evidence. No live eBay publish was performed. The staged outputs are `napa_ebay_shopify_listings.fitment-enriched.csv`, `napa_ebay_shopify_listings.fitment-enriched.ebay-listings-ready.csv`, `napa_ebay_shopify_listings.fitment.manifest.json`, and `napa_fitment_ai_candidates.json`.


## Pricing enrichment

Pricing runs after fitment and before the PartsBazar360 export, via
`scripts/price-enrich-catalog.mjs`. Every listing must carry a defensible,
evidence-backed price; rows that cannot get one are preserved and marked, never
dropped and never given an invented number.

```bash
node scripts/price-enrich-catalog.mjs \
  --csv /app/output/ebay-pipeline/napa_ebay_shopify_listings.complete-fitment-enriched.csv \
  --output-dir /app/output/ebay-pipeline
```

Useful flags: `--offset N` / `--limit N` (price a slice — earlier slices are
merged back in from `napa_pricing_evidence.json`, so batched runs still produce
one complete set of outputs), `--no-db` (skip the catalog MSRP lookup),
`--report-only` (rebuild the reports from the evidence file without re-querying
eBay), `--ready-csv` (override the File Exchange CSV to patch).

Batching matters: the Browse quota for this application token is shared with the
SEO/image stage, and a full 866-row pass costs roughly 1,700–3,400 calls. Run it
in slices when the day's budget is already partly spent; re-running a slice is
safe and simply overwrites those rows' evidence.

**Rate limiting is never silently treated as "no comparables."** When eBay
answers HTTP 429 for every identifier lookup on a row, the row is recorded with
`Pricing Method = lookup_rate_limited`, `lookupFailed: true`, and a note saying
it was NOT evaluated. `--retry-failed` re-prices exactly those rows once the
quota resets, and the validation report splits "missing a defensible price" into
rows that were genuinely searched versus rows that were never evaluated. Without
this split, an exhausted quota looks identical to a part that nobody sells.

### Comparable source and its limit

Comparables come from the eBay Browse API (`item_summary/search`), filtered to
`conditions:{NEW},buyingOptions:{FIXED_PRICE}`. **These are ACTIVE listings, not
sold ones.** The account OAuth grant is `buy.browse` only
(`backend/src/channels/ebay/ebay-auth.service.ts`); sold/completed comparables
require the Marketplace Insights API, which eBay grants by application and this
account does not hold. No pipeline output may therefore claim sold-comp
verification — `pricing_verified_exact_match` is deliberately never emitted, and
every priced row carries a note saying the comparables were active listings.

### Method, in order of preference

Identifier attempts run strongest-first and stop at the first that yields at
least three qualifying comparables (`PRICING_MIN_COMPARABLES`):

| Method | Match basis |
| --- | --- |
| `ebay_browse_active_gtin_exact` | exact UPC/EAN |
| `ebay_browse_active_brand_mpn` | brand + exact MPN in title |
| `ebay_browse_active_mpn` | exact MPN in title |
| `ebay_browse_active_oe_interchange` | OE/interchange number (only when no exact match exists) |
| `catalog_msrp_derived` | no comparables; `catalog_products.price` × `PRICING_MSRP_MULTIPLIER` |
| `none` | no defensible price |

A candidate listing is excluded when it is an auction, not condition `1000`, a
multi-variation listing, a bundle/lot, priced in another currency, under the
price floor, missing the identifier in its title, or sold by a seller below
95% / 50 feedback. Remaining prices are compared **shipping-inclusive** (landed),
then trimmed of anything outside 0.4×–2.5× of the first-pass median.

`Recommended Price` = median × `PRICING_MEDIAN_MULTIPLIER` (default 0.97),
rounded to a buyer-friendly `….99`. `List Price` follows the recommended price.

### Statuses

- `pricing_verified_comparable` — three or more qualifying comparables.
- `pricing_estimated_msrp` — no comparables; priced down from catalog MSRP.
- `manual_pricing_review` — fewer than three comparables, a high/low spread over
  `PRICING_MAX_DISPERSION` (default 6×), or an unresolved identifier conflict
  (a UPC/EAN that resolves to listings not carrying our MPN).
- `pricing_pending` — no comparables and no MSRP. Row preserved, reason in
  `Pricing Notes`.
- `pricing_verified_exact_match` — reserved for sold-comp verification; not
  emitted while only Browse access exists.

### Outputs

- `*.priced.csv` — the source CSV plus the 13 pricing columns (`List Price`,
  `Currency`, `Price Low`, `Price High`, `Median Comparable Price`,
  `Recommended Price`, `Comparable Count`, `Pricing Method`,
  `Pricing Confidence`, `Pricing Source URLs`, `Price Checked At`,
  `Pricing Status`, `Pricing Notes`).
- `napa_pricing_evidence.json` — per-row comparables, exclusions with reasons,
  dropped outliers, and the ready-made column values consumed by
  `scripts/create-partsbazar360-csv.mjs`.
- `partsbazar360-pricing-validation-report.md` / `.json` — verified vs.
  exact-MPN vs. comparable-part vs. MSRP vs. missing vs. manual-review counts,
  plus min/median/max recommended price by brand and by category.
- `*.pricing.manifest.json` — run manifest.
- The File Exchange CSV (`*.ebay-listings-ready.csv`) is patched in place with
  `*StartPrice`, `Currency`, and `Pricing Status`.

### Publish gate

`scripts/create-partsbazar360-csv.mjs` reads `napa_pricing_evidence.json` and
emits the same 13 columns into the audit and postable exports. A row reaches
`partsbazar360-postable-listings.csv` only with a numeric price, an explicit
currency, a pricing source or documented method, a confidence value, and a
publishable pricing status. Content-ready rows that fail the gate stay in the
audit export with `Publish Status = content_ready_pricing_pending`. If the
pricing evidence file is missing, the generator warns and nothing is postable —
it fails closed rather than exporting unpriced listings.

Unit tests for the pricing helpers: `node --test scripts/price-enrich-catalog.test.mjs`.


### Run log — 2026-09-20/21 (figures SUPERSEDED — see "Correction: comparable relevance" below)

First full pass over the 866-row catalog. The Browse daily quota was exhausted
partway through, at 13:31 UTC, so the run splits in two:

| | Rows | Outcome |
| --- | ---: | --- |
| Evaluated before the quota wall | 542 | 223 `pricing_verified_comparable`, 53 `manual_pricing_review`, 266 genuinely without a comparable |
| Processed after the quota wall | 324 | NOT evaluated — every lookup returned HTTP 429 |

The 324 unevaluated rows (252 Napa, all 72 SKF) were initially written as
`pricing_pending` by the pre-fix script and have since been re-marked
`lookup_rate_limited`. They still need `node scripts/price-enrich-catalog.mjs --retry-failed`.

Of the 542 genuinely evaluated rows, the 266 without a comparable are all Napa:
eBay carries very few listings under Napa house-brand part numbers (197 of the
first 207 such rows returned zero search hits, with filters rejecting only 10
candidate listings in total). Delphi (0/1 pending) and Mevotech (0/28 pending)
priced cleanly. `catalog_products.price` is null for this import, so the MSRP
fallback produced nothing — the only MSRP path for Napa rows would be the
official product pages, and the resolver has URLs for roughly 76 of 765 Napa
rows, on napacanada.com (CAD, not USD).

Recommended price by brand from this partial pass: Delphi 149.99; Mevotech
21.99–109.99 (median 62.49); Napa 6.99–1924.99 (median 48.99). The Napa maximum
comes from `manual_pricing_review` rows priced off two widely dispersed
comparables — those are gated out of the postable export by design.

Export state after this pass: 866 audit rows, 146 content-ready on fitment, of
which 44 are postable and 102 are held at `content_ready_pricing_pending`.

### Finishing a quota-interrupted pass (server watcher — DEPRECATED, see the local runner below)

`scripts/pricing-retry-watcher.sh` runs on the EC2 host (not in the container),
polls `scripts/ebay-quota-probe.mjs` every 15 minutes, and on the first HTTP 200
runs `price-enrich-catalog.mjs --retry-failed` followed by
`create-partsbazar360-csv.mjs`, then exits. Launch it detached:

```bash
setsid nohup /home/ubuntu/realtrackapp/scripts/pricing-retry-watcher.sh   > /home/ubuntu/realtrackapp/output/pricing-retry-watcher.log 2>&1 < /dev/null &
```

Progress goes to `/home/ubuntu/realtrackapp/output/pricing-retry.log`, which ends
with `WATCHER_DONE` or `WATCHER_DONE_WITH_ERRORS` and reports how many rows are
still unevaluated — non-zero means the quota ran out again mid-retry and the
watcher should be relaunched.

Note when scripting against this: the eBay quota behaves as a rolling ~24h
window, not a midnight-UTC reset. A pass exhausted at 13:31 UTC was still
returning 429 at 02:40 UTC the next day.


## Web-search pricing (GPT-5.6 Luna)

eBay Browse cannot price everything: many house-brand part numbers (most Napa
rows) have no eBay listing at all. `scripts/price-web-research.mjs` covers the rows
Browse left at `pricing_pending` by asking GPT-5.6 Luna (`openai/gpt-5.6-luna` via
OpenRouter, with the web-search plugin) to find current USD prices for the exact
brand + MPN.

```bash
node scripts/price-web-research.mjs \
  --csv /app/output/ebay-pipeline/napa_ebay_shopify_listings.complete-fitment-enriched.csv
node scripts/price-enrich-catalog.mjs --report-only     # folds the results into reports + CSVs
node scripts/create-partsbazar360-csv.mjs               # regenerates the exports
```

Flags: `--skus a,b` (specific rows), `--limit N`, `--include-review` (also retry
manual-review rows), `--all` (ignore the evidence file), `--force` (redo finished
rows), `--concurrency N`, `--max-cost USD`. It is resumable: finished rows are
skipped, and rows whose lookup failed are retried on the next run.

### The model finds pages; it does not supply prices

The model's answer is treated as a set of claims to check, never as data:

1. It returns candidate sources (URL, price, condition, verbatim evidence).
2. The script **re-fetches every cited page itself**. A source counts only if the
   page contains the brand and MPN (or the UPC) **and** a price. If the quoted price
   is not on the page but the page declares exactly one USD price for this product in
   its schema.org JSON-LD (within 0.5x-2x of the claim), that page-declared price is
   used instead and the correction is written into the notes. Real example: for SKF
   GRW25 the model quoted $94.88 in one run and $97.43 in another; the page's own
   markup says $97.43.
3. Low/high/median/recommended and every status are computed in code. The model never
   supplies a final price.
4. Source type is classified by domain, not by the model: only brand-owned domains
   count as manufacturer pricing (a retailer calling itself "authorized" does not).

Cited URLs must be public http(s) hosts; IP literals, `localhost` and internal names
are refused before any fetch. Fetched page text is only string-matched — it is never
fed back to the model — and the prompt instructs the model to ignore instructions
found in pages.

Provider constraint discovered while building this: the web-search plugin **cannot
be combined with JSON mode** (HTTP 400), so the JSON contract lives in the prompt and
is validated strictly on the way back. OpenRouter also returns no citation
annotations for this model, which is why the script re-verifies pages itself.

### Statuses and methods

| Method | Meaning |
| --- | --- |
| `web_search_exact_mpn` | 3+ page-verified retail/marketplace prices for the exact brand + MPN |
| `web_search_msrp` | priced down (x `PRICING_MSRP_MULTIPLIER`) from a page-verified manufacturer-domain price |

- `pricing_verified_comparable` — 3+ page-verified prices, spread within
  `PRICING_MAX_DISPERSION`. Confidence is capped at `medium`; `high` is reserved for
  structured Browse data.
- `pricing_estimated_msrp` — from a page-verified manufacturer price.
- `manual_pricing_review` — fewer than three verified prices, an over-wide spread, an
  MSRP far above verified market prices, sources the search claimed but a script could
  not confirm (bot-protected retailers return 403), or a **condition conflict**. Such
  rows may carry a price *hint*; they are never postable.
- `pricing_pending` — nothing found. Common for Napa: NAPA's US product pages show no
  price, and napacanada.com prices are CAD.

**Condition conflicts.** The catalog lists every row as New. Where the only exact
pages found say remanufactured/used (e.g. NAPA 1425XB, whose official page says
remanufactured), the row is flagged `conditionConflict`, not priced as new. For
part types commonly sold remanufactured (calipers, starters, alternators, axles,
pumps...) a page must say "new" explicitly; for other types a page showing no
used/remanufactured wording is treated as new and the assumption is noted.

### Merge rule and outputs

`price-enrich-catalog.mjs` overlays `napa_web_pricing_evidence.json` onto rows that
Browse could not price. **A structured Browse price always wins**, and a web lookup
that found nothing never erases a Browse row's "not evaluated" flag — so a later
`--retry-failed` still supersedes the web result when it succeeds.

New output: `partsbazar360-pricing-review-queue.csv` — every manual-review or
condition-conflict row with its price hint, verified URLs, and the claimed-but-
unverified URLs to click through. The validation report gains a condition-conflict
count.

### Cost

Web search is billed at $0.01 per search and the model typically runs two searches,
so a row costs about $0.024 all-in (measured: $0.19 for 8 rows). `--max-cost`
(default $25) stops new requests once reached.

Unit tests: `node --test scripts/price-web-research.test.mjs`.

### Run log — web-search pass, 2026-09-21 (incomplete: out of credits)

Eligible rows: 590 (266 that Browse searched and found nothing for, plus 324 it never
evaluated). The first attempt stopped after **33 rows** on an OpenRouter `HTTP 402` (about
$1.19 of credit left). After a top-up, a second pass with `--only-searched --reserve 3` was
stopped by hand at 143 rows / $3.73 total so the remaining credit could go to fitment work.
**Final yield: 0 auto-verified prices in 143 rows** — 26 condition conflicts, 9 manual-review
price hints, 109 nothing found. Web pricing does not work for this catalog (NAPA US pages show
no price; most retailers block scripts) and further spend on it is not recommended.
The 557-row / 33-row figures below describe the first attempt.

| Researched so far (33) | Rows |
| --- | ---: |
| Condition conflict (NAPA's own page says remanufactured; catalog says New) | 11 |
| No exact-match priced page found | 22 |
| Page-verified price | 0 |

All 33 were Napa brake calipers/rotors, the hardest slice, so this says little about
SKF or the other Napa part types. The 11 conflicts are merged into the exports and the
review queue (`Pricing Status = manual_pricing_review`, `Condition Conflict = yes`);
the 22 empty results are not merged, so those rows keep their Browse status.

An earlier partial run of this pass was discarded: the model's `identifier_conflict`
flag was being treated as a hard block and hid the remanufactured finding behind a
phantom identifier conflict. The flag is now advisory only (see the test
`a condition conflict is not masked by the model raising an identifier flag`).

**Order of operations for finishing it — spend the free step first.** The 324 unevaluated
rows include all 72 SKF rows, which eBay very likely has listings for. Let the server-side
watcher finish `--retry-failed` (free, waits for the Browse quota to reset), then research
only what is still `pricing_pending`. That should cost roughly $8-10 rather than the full
~$14:

```bash
# 1. after the watcher logs WATCHER_DONE, copy the merged evidence down, then run locally
#    (a residential IP is blocked by retailers less often than an AWS one)
node scripts/price-web-research.mjs --output-dir <dir containing napa_pricing_evidence.json> --max-cost 12
# 2. copy napa_web_pricing_evidence.json back to the server output dir, then on the server
node scripts/price-enrich-catalog.mjs --report-only
node scripts/create-partsbazar360-csv.mjs
```


## Vehicle-aware SEO titles and descriptions

`scripts/seo-content.mjs` (pure composer) + `scripts/seo-content-apply.mjs` (CLI) rewrite
the title and description of every row whose fitment is validated
(`Fitment Status = verified_mvl`). Deterministic and free: no API calls, and nothing is
used that is not already in the data.

```bash
node scripts/seo-content-apply.mjs              # dry run: prints samples + invariants, writes nothing
node scripts/seo-content-apply.mjs --apply      # backs up both CSVs, then updates them
node scripts/create-partsbazar360-csv.mjs       # regenerate the exports
```

**Title (<= 80 chars), the store house style** — `Brand MPN PartType [Position] for Make
Model Model [CHASSIS CODES]`, e.g. `Febest 1924-E70FUPL Control Arm Front Upper Left for BMW
X5 X6 E70 E71`. The make appears once with all of its models (`Chevy` for Chevrolet, `VW`,
`Mercedes`). It picks the richest variant that fits: more vehicles before dropping detail.

- **Position is in the title only if every application agrees on it.** SKF BR930071 is a
  *rear* bearing on Honda/Acura but a *front* bearing on Chrysler/Dodge; the previous builder
  took the first record and titled it "Rear". Per-vehicle positions go in the description.
- **Only real chassis codes are appended** (`E70`, `GMT900`, `LX`): 2-4 capitals, or a code
  containing a digit. Words such as `Classic` are not.
- Position casing is normalized (`rear` / `Front left` -> `Rear` / `Front Left`).

**Description** — structured HTML (the publish path accepts HTML, max 4000 chars, and strips
only style/script): intro line, "Compatible vehicles" list (one line per make + model, year
ranges merged and sorted, generation and position shown where they differ), a "Part details"
list (brand, MPN, part type, placement, series, UPC/EAN, interchange numbers, condition), and
a closing "confirm year/make/model/trim/position before ordering". Over-long application lists
are cut on whole entries with an honest overflow note; identifiers always survive. No
specifications, warranty, shipping or service promises are generated.

**Reman-prone parts never claim "New".** For calipers, starters, alternators, axles, steering
racks/gears, compressors, turbos, master cylinders, boosters and transmissions the description
omits the word "new" and the Condition line (KNOWN_ISSUES R24). The catalog `Condition ID` is
unchanged and still needs a human decision.

**Safety:** the CLI is dry-run by default, refuses to write unless parsing and re-serializing
the CSV reproduces it byte-for-byte, checks every title (<= 80, carries the MPN, no dangling
"for") and description (<= 4000) before writing, backs up to
`_backup-seo-content-<timestamp>/`, and never touches the database. Persisting titles,
descriptions and fitment into `catalog_products` remains a separate, deliberate step
(`persist-complete-fitment.mjs`).

### Run log — 2026-09-21

147 rows with validated fitment updated in both CSVs; exports regenerated. All 44 postable
rows now have a vehicle-aware title <= 80 chars, a structured description, a price and an
image. 12 reman-prone rows are described without "New"; one of the 44 postable rows is an
alternator (NAPA-213-8908) priced from NEW eBay listings and exported as New — confirm.
One row with fitment has no image (NAPA-VBR930460).

## Fitment for the remaining rows — what was measured (2026-09-21)

Only 147 of 866 rows have validated fitment (Napa 53/765, SKF 69/72, Mevotech 24/28). The
other 719 are 700+ Napa rows, so this — not price — is what limits how many rows can be
posted. Two sources were tested before committing any credits:

| Source | Result |
| --- | --- |
| Web search (GPT-5.6 Luna) + page verification, 10 priced rows | 3/10 rows found page-verified applications: all 3 Mevotech. **0 of 6 Napa rows.** ~$0.024/row |
| Captured eBay listing text for the priced Napa rows (41 rows) | 2 produced any candidate (both rejected by the eBay vehicle list); 16 mention a vehicle year at all |

Conclusion: house-brand Napa fitment cannot be economically scraped. Real sources are a
supplier ACES/PIES fitment feed or NAPA catalog export, or the structured item-compatibility
tables of the comparable eBay listings (Trading `GetItem` with `IncludeItemCompatibilityList`,
~16 exact-MPN comps per priced row) — the latter needs the app's stored seller token and is
not built. See KNOWN_ISSUES R26.

### Finishing a quota-interrupted pass — the local runner

The server-side watcher above runs Node inside the production backend container, on a host that
has been OOM-killing that container (KNOWN_ISSUES R27), so it is deprecated and was stopped on
2026-09-21. `scripts/pricing-retry-local.sh` does the same job from another machine: it waits for
the eBay Browse quota, pulls the current inputs, runs `--retry-failed` and the export locally, runs
sanity checks (866 rows, verified prices never drop, postable never below 44), and only then
uploads the results with `scp` + `docker cp` — no Node process ever runs on the production host.

```bash
SSH_KEY=/path/to/key.pem scripts/pricing-retry-local.sh          # wait for the quota, then run
MODE=now SSH_KEY=... scripts/pricing-retry-local.sh              # skip the wait
MODE=dry SSH_KEY=... scripts/pricing-retry-local.sh              # everything except the push
MODE=push SSH_KEY=... scripts/pricing-retry-local.sh             # push results already computed locally
REFILTER=1 ...                                                   # also re-derive stored results under the relevance rules
SKIP_RETRY=1 ...                                                 # test path: rebuild reports, no eBay calls
ALLOW_SHRINK=1 ...                                               # a deliberate correction may lower verified/postable
```

Before every push it takes a server-side backup (`docker exec ... cp` into
`/app/output/backups/pre-local-push-<time>`; no Node runs on the host). The sanity gates are: 866 rows,
verified prices not lower than the server's, postable not below `MIN_POSTABLE` (default 44) — unless
`ALLOW_SHRINK=1`, which exists for exactly the case of a correctness fix.

Progress and the final marker (`LOCAL_RETRY_DONE` / `LOCAL_RETRY_FAILED`) go to
`output/_retry-work/retry.log`.

## Persisting SEO content to the catalog database

`scripts/persist-seo-content.mjs` writes the titles/descriptions produced by
`seo-content-apply.mjs` into the database. It is deliberately narrower than
`persist-complete-fitment.mjs` (which rewrites every product of the import plus fitment fields and
the import's warnings). It touches only `catalog_products` (`title`, `title_normalized`,
`optimized_title`, `description`, `optimized_description`, `"updatedAt"`) and draft
`listing_records` from the staging file (`title`, `description`, `"updatedAt"`), only for SKUs with
`Fitment Status = verified_mvl`.

```bash
node scripts/persist-seo-content.mjs                       # dry run: matches SKUs, prints old -> new
node scripts/persist-seo-content.mjs --apply               # backup, then ONE transaction
node scripts/persist-seo-content.mjs --restore <backup>    # put the previous values back
```

Safety: schema check first; aborts if any CSV row fails validation or any SKU is missing or
duplicated; writes a backup of the previous values before the transaction; requires every UPDATE to
touch exactly one row (else rolls back); reads back and compares afterwards. Never publishes.

Because it executes inside the production container, run it only when host memory allows
(KNOWN_ISSUES R27).

### Run log — 2026-09-21

147 catalog products and 147 draft listing records updated; read-back mismatches: 0. Backup:
`/app/output/backups/db-seo-content-before-2026-09-21T07-09-47-247Z.json`. Undo with
`--restore` on that file. Independent check afterwards: exactly 147 of the import's 838
products had `updatedAt` in the window, all with an HTML description, `title = optimized_title`
and a title of 80 characters or fewer.


## Correction: comparable relevance (2026-09-21)

**The defect.** Browse comparables were accepted when the part number appeared anywhere in the
title. For short or numeric part numbers that matches other products: NAPA 22385 (an air filter)
was priced from LEGO tiles, NAPA 18972 (a muffler) from Freightliner torque rods and a 1:18 Camaro
diecast, and NAPA DC18229 (a shock) from bearings, a hatch and a timing belt found via its
interchange number. Those rows were marked `pricing_verified_comparable`, so they could reach the
postable export.

**Impact on the figures reported earlier.** The "223 verified prices" and the "44 postable" rows
were inflated. Re-deriving them under the fix showed, of the 276 rows priced at the time, 83 unchanged,
84 with a different price and 109 (all Napa) with no defensible price; of the original 44 postable
rows, 33 unchanged, 8 repriced and 3 unpriced. Unfiltered, the retry that priced the 324
previously-unevaluated rows had produced 416 "verified" prices — about 180 of them for the wrong
product.

**The fix** (`price-enrich-catalog.mjs`, `relevanceReason`):

- `brand_mpn` / `mpn` comparables must name the **brand**, or at least two of the part type's
  significant words (one when the part type has only one). "Air" alone does not qualify an air filter.
- `oe_interchange` comparables must name the **part type** — the brand cannot apply, since the number
  belongs to another manufacturer.
- A GTIN match identifies the product outright and is not second-guessed.
- The same rules run offline over stored evidence with `--refilter`: it re-derives every Browse
  result from the comparables it already holds (kept plus outlier-dropped), with no eBay calls, and
  leaves web results, unevaluated rows, GTIN rows and rows whose comparables all pass untouched. It is
  idempotent.

**Corrected figures (server, 2026-09-21).** 866 rows; 232 verified prices (287 priced from exact-MPN
comparables, 37 from comparable parts); 126 in manual review; 508 without a defensible price; 26
condition conflicts; **118 postable of 146 with validated fitment** (Mevotech 23, SKF 69, Napa 25,
Delphi 1; 93 high confidence; 15 with fewer than five comparables; $12.99-$369.99). 28 content-ready
rows remain blocked on pricing. Still one reman-prone row postable as New (NAPA-213-8908).

**Limits.** `--refilter` can only use comparables that were stored; if a lower-priority search
(for example brand+MPN after an MPN search) would have found enough relevant listings, only a live
re-query would find them. Rows priced from a GTIN match are untouched, so a wrong GTIN in the source
sheet would still misprice a row.

The corrected files were pushed on 2026-09-21 with a server-side backup at
`/app/output/backups/pre-local-push-20260921-073134`.


## Second correction: the brand must be named (2026-09-21)

The relevance fix above still accepted a comparable that named the brand **or** enough of the part
type. For house-brand parts that let other manufacturers' products set the price: of 132 priced Napa
rows, 85 had no comparable naming NAPA at all, and of the 25 Napa rows reported as postable, 9 had none
and 11 had fewer than half (SKF, Mevotech and Delphi rows were unaffected: every counted comparable
named the brand). NAPA-CU2101 and NAPA-37322 were priced, and in an experiment also given fitment,
from other brands' parts that share the number.

**Rule now:** for the `brand_mpn` and `mpn` methods the title must name the brand (reason
`brand_not_named`). Part type alone qualifies only the `oe_interchange` method, which is labelled
"comparable parts". GTIN matches are unchanged. Re-derived offline with `--refilter`.

**Figures after this correction (server, 2026-09-21):** 147 verified prices (was reported as 232, and
originally 223); 181 rows priced from exact-MPN comparables, 37 from comparable parts; 105 manual review;
614 without a defensible price; **109 postable of 149 content-ready** (Mevotech 25, SKF 70, Napa 13,
Delphi 1); 40 content-ready rows blocked on pricing. No reman-prone row is postable. Every surviving
postable row's counted comparables name the brand. 11 postable rows rest on fewer than five comparables.
Backup of the pre-push server files: `/app/output/backups/pre-local-push-20260921-082434`.

## Fitment from eBay's own compatibility check

House-brand rows have no supplier fitment feed and no scrapeable page (web search found none for 6/6 Napa
rows). Every priced row does carry ~16 comparable eBay listings, and eBay's Browse API
`POST /buy/browse/v1/item/{id}/check_compatibility` answers, **with only the application token**, whether a
listing is compatible with a given vehicle, using the seller's own compatibility table. Trading `GetItem`
(which returns the whole table) was tried first and refuses application tokens (`IAF token supplied is
invalid`), so it would need a seller's stored token; this route needs none.

Scripts (all run on a normal machine, never in the production container — KNOWN_ISSUES R27):

| Script | Role |
| --- | --- |
| `scripts/mvl-pull.sh` + `scripts/sql/mvl-us-variants.sql` | copies the eBay US vehicle list (make/model/year, 2 trim+engine variants each) to a local CSV through a **read-only `psql` in the Postgres container** |
| `scripts/fitment-compat.mjs` | pure logic: candidate vehicles from listing titles/descriptions, year sampling, verification, same-product guard |
| `scripts/fitment-from-ebay-compat.mjs` | the eBay client and per-row orchestration; capped (`--max-calls`), stops on the first 429, resumable |
| `scripts/fitment-compat-apply.mjs` | writes confirmed fitment into the source CSV (dry-run default, backup, byte-exact round-trip guard) |
| `scripts/fitment-compat-eval.mjs` | scores the finder against rows whose fitment is already validated |
| `scripts/persist-fitment-sql.mjs` | writes fitment + title/description to the DB by generating SQL and running it through `psql` (no Node on the host); dry-run default, backup, all-or-nothing transaction, `--restore` |

**Method.** (1) Candidate vehicles are read out of the comparables' titles (and, if none, their
descriptions) by matching against the real vehicle list; candidates only *propose*. (2) Each candidate is
tested on independent listings with real trim/engine variants at its boundary years **plus about one
year in every six**, so a redesign in the middle of a long range splits the range instead of being
claimed across (a Ford Taurus 1986-2007 part is tested at 1986, 1992, 1998, 2004 and 2007). A year is
confirmed only if at least two different sellers' listings say COMPATIBLE. (3) Position comes from
"Placement on Vehicle" only when two listings agree.

**The same-product guard.** A part number alone collides across brands, and a collision brings the other
product's fitment with it. A listing is used as evidence only if its **own item specifics** (from
`getItem`) name our Brand **and** our Manufacturer Part Number; a listing with no specifics is not used.

**Results and accuracy.**

| Run | Rows | Found | Note |
| --- | ---: | ---: | --- |
| 114 target rows (priced, no fitment, 2+ listings; Napa 107, Mevotech 4, SKF 3), no guard | 114 | 47 (116 records) | **discarded** — includes cross-brand collisions |
| same rows, with the guard | 114 | **3 (5 records)** | 98 rows had no listing naming brand + MPN (457 of 490 listing rejections were `brand_mismatch`); Napa: 0 of 107 |
| 24 rows with already-validated fitment, no guard | 24 | 13 | precision 67% (39/58 confirmed year-points inside the reference) |
| same 24 rows, with the guard | 24 | 9 | **precision 88.6% (31/35)**; the two collision rows refused |

The reference is not ground truth. Of the four points still outside it: a Mevotech Ford Edge range that
extends to 2024, and SKF-BR930263K, where the reference says Ford F-150 but 18 listings and eBay's check
say Ford Focus 2000-2011 (see KNOWN_ISSUES R29). Applied: MEVOTECH-TXMS408100 (Ford Taurus 1986-2007),
MEVOTECH-TXMS40629 (Ford Escape 2014-2019), SKF-BR930829 (Nissan Armada/Titan, Infiniti QX56 2008) — all with images.

**Conclusion.** This works for brands whose listings carry their own item specifics (Mevotech, SKF); it
cannot work for Napa house-brand parts, because the eBay listings sharing those numbers are other
manufacturers' products. The remaining ~700 Napa rows still need a supplier ACES/PIES feed or NAPA catalog
export. About 2,350 Browse/check calls were spent on this; the unguarded state files are kept out of the
way as `*.UNFILTERED-DO-NOT-APPLY.json` and must never be applied.

**Sequence:** `mvl-pull.sh` -> `fitment-from-ebay-compat.mjs` -> `fitment-compat-apply.mjs` ->
`seo-content-apply.mjs --apply` -> `create-partsbazar360-csv.mjs` -> `pricing-retry-local.sh` with
`MODE=push PUSH_SOURCE=1` (the source CSV is replaced only after a server-side backup and an md5 check
that the server's copy is unchanged since it was pulled) -> `persist-fitment-sql.mjs` for the database.
The File Exchange CSV gets the new titles/descriptions but not eBay compatibility continuation rows for
these rows.

## Images, fitment and pricing sourced directly from NAPA's own site (2026-09-22/23)

With Luna web search and the eBay-Browse-compatibility route both exhausted for Napa house-brand
parts (0/143 pricing matches, 0/5 image matches in pilots — the same underlying problem as above:
Napa's supplier identifiers don't resolve to Napa-brand listings anywhere on the open web or on
eBay), `napacanada.com` — NAPA's own Canadian consumer storefront — turned out to be a genuine,
if awkward, source for all three: a product photo, the full manufacturer "Vehicle Fitment Guide",
and (for one part category) a real retail price.

**Access constraints — why this could not be scripted end-to-end.** Plain HTTP clients (axios,
curl) get a flat Cloudflare "Just a moment..." challenge for any request, including the homepage;
only a real browser with JS execution gets through. `napaonline.com` (the US storefront) is
Cloudflare-blocked even in a real browser. Rapid same-origin `fetch()` bursts from inside the page
get Cloudflare-429-rate-limited after about 4 quick requests, and repeated `navigate` bursts can
trigger a fresh challenge requiring an 8-20s cooldown. All of this research was therefore done as
human-paced, single-tab browser navigation (`scripts/_tmp_*` throwaway helpers plus the built-in
browser tool), never a bulk script — there is no supported bulk API.

**Resolving a supplier MPN to NAPA's internal code.** The header search's typeahead resolves a raw
MPN to NAPA's own SKU (pattern: `<PREFIX><compact-digits-no-dash>`, e.g. `242-2218` -> `PCL2422218`)
but has a one-query input lag: type the full query, then a "nudge" keystroke (`space` then
`Backspace`) and a ~6s wait before the real suggestion appears. Once the prefix pattern for a part
family is known (confirmed via one resolved lookup), later codes in the same family can be reached
by direct navigation to `/en/p/<code>` without going through search again — this is the main
speed-up over researching every row from scratch.

**NAPA internal SKU prefixes observed, by part type:** `PCL`/`NUC` (Caliper, reman/new), `ADC`
(Caliper, "NAPA Gold" reman line — a different sub-brand from `PCL`/`NUC`), `VLR` (Value Line
rotor — different brand), `NDR` (Rotor or Drum — part type varies per number), `NDU` (Adaptive One
rotor), `RCN` (Strut), `NSA` (Strut mount kit), `BAP` (Wheel hub/bearing), `ADO` (Adaptive One
pads), `FQE`/`FQR` (QE pads), `PFC` (Proformer chassis: ball joint, control arm, tie rod, sway bar
link, etc.), `NCP`/`NCT` (Premium chassis), `NEU` (Alternator/starter), `NUP` (Brake hose), `FNU`/
`FNT` (Brake shoes), `NGF` (Air filter), `PPF` (Cabin/oil filter), `RAP` (Reman rack & pinion).

**Images and fitment (`scripts/napa-official-apply.mjs`).** 375 Napa rows with no image were
researched one at a time: 190 found (Brand + MPN confirmed against the product page's own spec
table or, where no dedicated MPN row exists, the page title/URL), 179 genuinely absent from the
site under that identifier, 5 same-MPN-but-different-part-type mismatches, 1 MPN mismatch, all
left alone. Applied rows get the product's Bynder-hosted CDN photo (where one exists — most reman
parts have none) and the full manufacturer fitment table, written the same way
`fitment-compat-apply.mjs` writes eBay-sourced fitment (`Fitment Status: verified_mvl`, additive
only — never overwrites an existing image or an already-verified fitment). 14 of the 190 are
listed as Remanufactured on NAPA's own page despite the catalog saying New; these are applied
(not blocked) with a `CONDITION CONFLICT` note in `Review Reason` so a human can verify before
publish, following the same non-blocking-but-flagged pattern as the eBay compatibility route's
identifier conflicts.

**Pricing (`scripts/napa-price-apply.mjs`) — and why most rows still come back with no price.**
Sampling across every major Napa part-type prefix found that napacanada.com shows a real
consumer/retail price (not a wholesale one — it's a normal e-commerce storefront with Add to
Cart, Store Pickup, Same-Day Delivery) for the **Caliper category only** (`PCL`/`NUC`/`ADC`); pads,
rotors (both Premium and Value Line), chassis parts, alternators, hoses, and strut mount kits
consistently show no price at all, verified against 9+ distinct prefixes before extrapolating the
rest. Even within Calipers, price presence is per-SKU, not universal (roughly 1 in 9 sampled had
one) — some product pages simply never render a price, apparently tied to default-store
inventory rather than the SKU's existence. Of 639 un-priced Napa rows, 96 are Calipers; those 96
plus the 184 rows already resolved to a NAPA code by the image/fitment pass above were checked
(280 total), yielding 11 real prices, 7 of which were still eligible to apply (4 already carried
an eBay identifier-conflict flag and were left for manual review, per the additive-only rule).
**The price shown is CAD**, and this pipeline's pricing columns are USD-only (see
[docs/decisions.md](../decisions.md), 2026-09-23 entry) — each applied price is converted with a
live-fetched FX rate cited in `Pricing Notes`, `Pricing Method: napa_official_site_cad_fx_converted`,
`Pricing Confidence: low`.

**Sequence:** research (manual browser) -> `napa-official-apply.mjs --apply` (images + fitment) ->
`napa-price-apply.mjs --fx-rate <live> --fx-date <today> --apply` (pricing) ->
`seo-content-apply.mjs --apply` -> `create-partsbazar360-csv.mjs`. The evidence files
(`napa_official_site_evidence.json`, `napa_pricing_site_evidence.json`) are resumable, keyed by
CSV row index, and are not part of `pricing-retry-local.sh`'s `PUSH` array — copy them to the
server manually if they need to survive there for a future session to resume from.

**This sequence, and `pricing-retry-local.sh`, only ever touch CSV/JSON files — never the
database.** A separate, deliberate persist step is required before any of it is visible on the
live app; see the next section.

## Persisting NAPA-site fitment, images and price to the database (2026-09-24)

The staging layer above (CSV + JSON files, pushed to the server's filesystem) is entirely
separate from the Postgres tables the live catalog app (`app.omnicoreholding.com`) actually
reads: `catalog_products` and `listing_records`. A report of "changes not visible on the live
site" traced back to exactly this — the 190 image/fitment rows and 7 NAPA-priced rows from the
sections above had been pushed to the server and looked complete in every pipeline report, but
none of it had reached the database. Worse, **no row's price, from any source, had ever been
persisted** — `catalog_products.price` and `listing_records.startPrice`/`startPriceNum` were unset
for the whole catalog, not just the Napa rows from this session.

Two scripts close this gap, both following `persist-fitment-sql.mjs`'s established pattern
exactly: SQL generated locally, executed through `ssh` + `psql` inside the Postgres container (no
Node process on the memory-constrained production host — KNOWN_ISSUES R27), dry-run by default,
a full backup taken before `--apply`, one all-or-nothing transaction that raises (and so rolls
back everything) if the actual row count written doesn't match what was planned, and a
`--restore <backup.json>` undo path.

| Script | Writes | Why not the existing script |
| --- | --- | --- |
| `scripts/persist-napa-official-sql.mjs` | `catalog_products` (fitment_data, fitment_status, title, description, image_urls) + `listing_records` (title, description, itemPhotoUrl) | `persist-fitment-sql.mjs` only accepts rows whose `Fitment Source` starts with `"eBay compatibility check"` — it silently excludes NAPA-site-sourced fitment (`Fitment Source` starting with `"NAPA's own product page"`). Rather than widen that script's scope, this is a sibling for the NAPA provenance. Fitment and image updates are planned and validated **independently** (a row may need one, the other, or both), each additive-only (fitment: skipped if the database's `fitment_status` is already `verified_mvl`; image: skipped if `image_urls` is already non-empty). |
| `scripts/persist-napa-pricing-sql.mjs` | `catalog_products.price` + `listing_records.startPrice`/`startPriceNum` | No prior script wrote price at all. Scoped to every SKU with a publishable `Pricing Status` in `napa_pricing_evidence.json` (`pricing_verified_exact_match`, `pricing_verified_comparable`, `pricing_estimated_msrp` — the same set `create-partsbazar360-csv.mjs` uses), not only NAPA-sourced rows, since the gap applies to the whole catalog. Additive-only: skipped if the database's `catalog_products.price` is already set. |

Both scripts independently re-check the database immediately before generating SQL (a row whose
CSV data looks eligible but whose SKU has no matching `catalog_products` row under this import —
`not_in_database` — is skipped, never silently included; an early version of
`persist-napa-official-sql.mjs` missed this check for fitment rows and the whole transaction
correctly aborted rather than partially write when 3 such rows were found).

```bash
SSH_KEY=... node scripts/persist-napa-official-sql.mjs --dir output/_retry-work            # dry run
SSH_KEY=... node scripts/persist-napa-official-sql.mjs --dir output/_retry-work --apply
SSH_KEY=... node scripts/persist-napa-pricing-sql.mjs  --dir output/_retry-work --apply
SSH_KEY=... node scripts/persist-napa-official-sql.mjs --restore <backups/db-napa-official-before-*.json>
```

### Run log — 2026-09-24

186 rows persisted fitment + title/description (3 skipped, `not_in_database`); 4 rows persisted
an image; 152 rows persisted a price for the first time ever (2 skipped, `not_in_database`) — 7
NAPA-site (CAD-converted), 4 eBay exact-GTIN, 128 eBay brand+MPN, 13 eBay OE-interchange. All
read back clean (`notVerifiedAfter`/`notImagedAfter`/`notPricedAfter`: `[]`).

### Run log — 2026-09-29 NAPA missing-price follow-up

The earlier 2026-09-24 sampling claim that prices appeared only for calipers is **outdated as of
2026-09-29**. Exact NAPA product pages also exposed prices for a steering sleeve, tie rod end,
and CV axle. Source price presence varies by product and storefront location; an exact product
page without a displayed price is not evidence of a zero price.

The read-only `output/_retry-work/run-napa-mpn-gap-search.mjs` searched the normalized MPN of
235 then-unpriced, unresolved catalog rows across NAPA US and Canada (470 You.com searches).
Eighteen rows had candidate product links; 25 of 26 candidate pages were retrieved. The page
identity and product type were checked before selection: four rows were compatible, while
different part types (including rotor versus drum), remanufactured condition conflicts, and
longer part numbers with the same suffix were held. The guarded merge
(`output/_retry-work/merge-napa-mpn-gap-selected.mjs`) backed up its checkpoints before adding
those four exact products. The database writer
(`output/_retry-work/apply-napa-you-checkpoint.mjs --apply --limit 4`) took a production backup,
committed one transaction, and verified readback: three new official prices, four official primary
images and descriptions, and three fitment updates. Post-write counts were 376/737 NAPA rows
with any price, 438 with an official NAPA primary image, and 284 with both an official price and
official image. The USD-normalized median of 289 accepted official price observations was $67.99.

The evidence and before/after audit remain under `output/_retry-work/`. Another search mode,
`--accepted-no-price`, checks alternate official links for the 40 accepted exact products whose
current NAPA pages do not expose a price. Keep prices unset where no price is displayed; do not
copy a different product's price or use the median as a listing price.

That alternate-page pass completed 80 searches over all 40 products, returning candidate links
for 18 rows. Twelve links were new relative to the saved official page and were retrieved fresh.
Seven exact, type-compatible products were selected. Five displayed an official CAD price;
seven supplied official primary images; four yielded new fitment data; two needed new
descriptions. `output/_retry-work/merge-napa-accepted-alt-selected.mjs` backed up the evidence
checkpoints, and the guarded writer backed up the database, applied one seven-row transaction,
and verified readback. Live totals became 381/737 with any price, 441 with an official NAPA
primary image, and 289 with both verified official price and official image. The normalized USD
median of 294 accepted official price observations became $68.01. A remanufactured caliper and
an adjusting sleeve misidentified as a tie rod end were held instead of copying their prices.

The Apify actor `fortuitous_pirate/napa-scraper` was checked twice with the supplied API token:
one exact-part query and one documented `brake pads` query, both with ZIP 90210, residential
Apify proxy, and a low output/charge cap. The API accepted both runs, but the actor crawler got
HTTP 403 at `https://www.napaonline.com` on every retry and produced zero dataset items. The
actor's final `SUCCEEDED` state means its process ended; it does not mean products were scraped.
Run IDs `RcJXZCC5A7ACjLc97` and `H2lTkhnavsKxdUTgj` preserve the diagnostic logs. Do not
scale this actor until it successfully retrieves and validates an exact NAPA product.

The next official-price recovery pass, including the 87 NAPA rows with a price from another
source, is specified in [NAPA_OFFICIAL_PRICE_RECOVERY.md](NAPA_OFFICIAL_PRICE_RECOVERY.md).

The 87-row count above is **outdated as of the next 2026-09-29 pass**. The
`--accepted-other-price` search checked 19 exact, type-compatible NAPA products
that still carried another-source prices. Fourteen new official candidate URLs
were retrieved. Three exact products displayed official prices: `NAPA-4161`,
`NAPA-IC7`, and `NAPA-MA822`. Candidate pages with a matching numeric suffix
but a different part type were rejected. The evidence merge backed up its
checkpoints; the guarded writer backed up production, updated the three catalog
and draft prices and official images, added verified fitment for `NAPA-IC7`,
and confirmed readback. The live total with any catalog price stayed 381/737,
while accepted official price evidence rose to 297 and the official-price gap
fell to 440 (356 with no price, 84 with another-source price). Of the 297,
292 have both accepted official price and official primary image. The median
normalized official price is $67.99 USD. A further MPN-only search covered all
22 other-priced rows without an exact verified official page (44 You.com
searches, no errors). Four rows had official URL candidates, but the indexed
product titles described a different part type than the catalog listing.
None was promoted to an official price; the evidence is in
`napa_unverified_other_price_search_2026-09-29.json`.

### Run log — 2026-09-29 Google indexed prices and exact-part condition override

The owner supplied Google result screenshots showing NAPA's exact `SFI 26917`
price of $14.49/Each and exact `ADC 2072XB` price of $108.99/Each. The latter
result also showed a different $111.99 Shopping price; the NAPA result-text
price was selected and the Shopping price excluded. Both product pages confirm
the exact part number but the page extract did not contain a price. The images
were retained as evidence with SHA-256 hashes under `output/_retry-work/`, and
the guarded writer applied each indexed price with a production backup and
verified catalog/draft readback. Indexed prices remain distinguishable from
fresh page prices in the report.

The owner then explicitly allowed a remanufactured official NAPA page to price
an exact-part catalog listing marked new. The writer's condition hold was
removed; exact part number, product family, and position checks remain.
Previously held exact-part evidence yielded 124 planned rows, applied in five
backed-up, readback-verified batches: 93 additional prices, official images,
descriptions, and available fitment. Eleven different-product-type matches
remain held. The refreshed live totals are 444/737 with any catalog price,
392 with accepted official NAPA price evidence (389 fresh page, three indexed),
293 with no catalog price, and 385 with both official price and official primary
image. The USD-normalized median of official price evidence is $91.81.

A full-title three-product pilot found exact `SFI26917` in You.com Search, but
its snippet omitted the price visible in Google. Tavily returned HTTP 432 usage
limit for all three controls. This explains why the previous API-only pass missed
Google-visible prices and limits scaling until another indexed-price retrieval
route is available.

The post-override alternate-page pass searched 19 newly eligible blank-priced
exact-page rows (38 You.com queries). `NAPA-2775XA` had a type-compatible exact
NAPA Canada page with C$163.29/Each, an official primary image, and 2013–2016
Dodge Dart fitment. The guarded writer converted the price at the recorded
0.7058 CAD/USD rate to US$115.25, backed up production, and verified catalog
and draft readback. The other new candidate pages were unavailable or described
different part types. Latest live totals: 445/737 with any price, 393 with
accepted official price evidence, 292 with no catalog price, 386 with official
price and official primary image, and a US$91.82 official-price median.
