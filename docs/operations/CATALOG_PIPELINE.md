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


## Fitment and vehicle-aware title enrichment

The guarded fitment pass uses `scripts/fitment-ai-discover.mjs` with model `gpt-5.6-luna-20260709` to propose applications from the exact brand, MPN, product type, and UPC. `scripts/fitment-apply.mjs` validates each candidate against the local US eBay MVL release `US_MVL_2026_05` before writing `fitment_data`, `fitment_rows`, `fitment_status`, and `fitment_confidence` to the matching catalog SKU. It also emits eBay File Exchange compatibility continuation rows as `Relationship=Compatibility` with Year/Make/Model details.

The September 20, 2026 pass processed all 866 rows. Seventeen rows produced 33 applications that passed MVL validation and received vehicle-aware titles under 80 characters; 849 rows remain `fitment_pending` because no verified part-to-vehicle mapping was available in the input or approved source evidence. No live eBay publish was performed. The staged outputs are `napa_ebay_shopify_listings.fitment-enriched.csv`, `napa_ebay_shopify_listings.fitment-enriched.ebay-listings-ready.csv`, `napa_ebay_shopify_listings.fitment.manifest.json`, and `napa_fitment_ai_candidates.json`.
