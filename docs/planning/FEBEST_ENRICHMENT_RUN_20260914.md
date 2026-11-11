# FEBEST enrichment run — 2026-09-14

Status: **DRAFT / BLOCKED**. This run performed source ingestion, deterministic audit, and local artifact generation only. It did not write production catalog/listing data, upload to eBay, publish listings, or change production configuration. Read-only production inspection was performed over the supplied SSH session to understand existing SKU/collision context.

## Source and identity

- Source workbook: `FEBEST_US_COMBINED_MASTER_4599_SKUS_UPDATED_1.xlsx`
- Source sheet: `Combined Master`
- Source SHA-256: `858608409ba839ad75e3c77e0516c141bc21840544098b8d5ebccb28e9739700`
- Data rows: 4,599; unique `(Brand=FEBEST, Part Number)` identities: 4,599; duplicate rows: 0; hidden rows: 0.
- Primary official catalog: [catalog.febest.eu](https://catalog.febest.eu/). The current catalog exposes part-number search, product info, compatibility/OE evidence, “used in vehicles” information, official images, and an observed result count of `1-20 / 20102`.
- Exact product links are persisted only when observed. Article URL patterns are not guessed.

## Pricing and quality gates

The private acquisition markup is recorded as `round(cost_price_aed * 1.30, 2)`. Public USD prices are derived as `round(marked_up_cost_aed * Google Finance AED->USD, 2)`, with the observed 2026-09-14 rate `AED/USD=0.2723`. The run records the Google Finance source URL and rate in `quality-report.json`; cost and markup remain private.

The run is blocked on:

- 886 products with no accepted `EBAY_MOTORS_US` MVL intersection;
- 8 products with unresolved official article/image evidence after bounded retries;
- a production collision dry-run, which is intentionally outside this enrichment run.

The finalizer enumerated all 1,006 catalog pages (`20,102` observed items), matched 4,596 source MPNs, and captured official article evidence for 4,591 of 4,599 source rows. It produced 533,612 accepted target-MVL fitment rows in `fitments-review.jsonl`; 1,102,126 official applications that did not resolve to the active US MVL were retained in `fitments-needs-review.jsonl` and excluded from the blocked import workbook. Accepted rows are capped at 200 per SKU for the eventual pipeline payload; overflow counts remain in the master dataset.

No paid model inference was used, so no ambiguous model identifier was used. The implementation records the requested user-facing model name, GPT-5.6 Luna, only as a not-used configuration note.

## Implementation

- `pre_enriched_febest_v1` is an explicit upload mode alongside `legacy_gridx`.
- The server validator requires exact `Manifest`, `Products`, and `Fitments` sheets and exact header order.
- `POST /api/pipeline/pre-enriched-febest/dry-run` validates without enqueueing or writing.
- The trusted worker path performs no legacy generation and no mandatory optimization queue. It preserves approved HTML and original official image evidence, uses the existing storage mirror helper for approved image URLs when an authorized import runs, persists item specifics/accepted fitments/source hashes, writes listings as `draft`, and rejects non-idempotent SKU collisions without overwrite.
- Focused validator tests pass: 3/3. Backend build passes.

## Artifacts

- `workspaces/febest-enrichment-20260914/artifacts/febest-enrichment-review.xlsx`
- `workspaces/febest-enrichment-20260914/artifacts/pre-enriched-febest-v1-DRAFT-BLOCKED.xlsx` (products only; fitments intentionally omitted while blocked)
- `workspaces/febest-enrichment-20260914/fitments-review.jsonl` (533,612 accepted target-MVL rows)
- `workspaces/febest-enrichment-20260914/fitments-needs-review.jsonl` (1,102,126 audit rows)
- Deterministic source/master/review JSONL and manifest files are in the same run workspace.

The import workbook is intentionally not ready for upload. It is a schema-valid DRAFT/BLOCKED layout with 4,599 products and an empty Fitments sheet; the complete fitment outputs remain in JSONL until all hard gates pass. No production catalog/listing rows, eBay uploads, or publishing actions were performed.
