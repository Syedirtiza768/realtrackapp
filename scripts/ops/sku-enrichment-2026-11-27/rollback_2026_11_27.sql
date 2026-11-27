-- Rollback of the 2026-11-27 database enrichment (1,645 catalogue rows).
-- Restores the before-values saved in sku_enrich_backup_20261127 by apply_enh.cjs (APPLY=1).
-- Run in one transaction. Check the row count first: SELECT count(*) FROM sku_enrich_backup_20261127; (expect 1645)
BEGIN;
UPDATE catalog_products cp
   SET description = b.description,
       brand = b.brand,
       vertical_attributes = b.vertical_attributes,
       "updatedAt" = now()
  FROM sku_enrich_backup_20261127 b
 WHERE cp.sku = b.sku;
COMMIT;
-- The eBay side is NOT covered by this file. To revert live listings, PUT the old
-- offer listingDescription (ebay_prestate_*_2026-11-27.jsonl, field offerListingDescription)
-- and the old inventory description/aspects (inventoryDescription, inventoryAspects).
-- Rows with pre_state_captured = "no" in Publish_Log_2026-11-27.csv have no stored pre-state.
