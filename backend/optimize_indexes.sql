-- ============================================================
-- RealTrackApp: Performance Optimization Indexes
-- Run AFTER setup_search.sql
-- ============================================================

-- Additional B-tree indexes for fast facet GROUP BY and filter IN() queries
-- These eliminate sequential scans on facet aggregation queries

CREATE INDEX IF NOT EXISTS idx_listing_category_id
  ON "listing_records"("categoryId");

CREATE INDEX IF NOT EXISTS idx_listing_category_name
  ON "listing_records"("categoryName");

CREATE INDEX IF NOT EXISTS idx_listing_format
  ON "listing_records"("format");

CREATE INDEX IF NOT EXISTS idx_listing_location
  ON "listing_records"("location");

CREATE INDEX IF NOT EXISTS idx_listing_imported_at
  ON "listing_records"("importedAt" DESC);

-- Composite index for the most common no-search facet query pattern
-- (when user is just browsing without a text query)
CREATE INDEX IF NOT EXISTS idx_listing_brand_type
  ON "listing_records"("cBrand", "cType");

-- Covering index for price range queries with European comma fix
-- Replaces the older idx_listing_price with the REPLACE-based expression
DROP INDEX IF EXISTS idx_listing_price;
CREATE INDEX IF NOT EXISTS idx_listing_price_safe
  ON "listing_records"( (NULLIF(REPLACE("startPrice", ',', '.'), '')::numeric) )
  WHERE "startPrice" IS NOT NULL AND "startPrice" != '';

-- Partial index for "has image" filter (common toggle)
CREATE INDEX IF NOT EXISTS idx_listing_has_image
  ON "listing_records"(id)
  WHERE "itemPhotoUrl" IS NOT NULL AND "itemPhotoUrl" != '';

-- Analyze all tables to update planner statistics
ANALYZE "listing_records";

-- Verify index count
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'listing_records'
ORDER BY indexname;
