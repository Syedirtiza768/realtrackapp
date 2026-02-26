-- ============================================================
-- RealTrackApp: Full-Text Search + Fuzzy Matching Infrastructure
-- ============================================================

-- 1. Enable trigram extension (for fuzzy / typo-tolerant search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add tsvector column for full-text search
ALTER TABLE "listing_records"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- 3. Populate search vector with weighted content
--    A = highest priority (SKU, title)
--    B = brand, MPN, OEM part number
--    C = category, type, features
--    D = description (lowest weight, usually HTML)
UPDATE "listing_records" SET "searchVector" =
  setweight(to_tsvector('english', COALESCE("customLabelSku", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("cBrand", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("cManufacturerPartNumber", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("cOeOemPartNumber", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("categoryName", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("cType", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("cFeatures", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("description", '')), 'D');

-- 4. GIN index on tsvector for fast full-text queries
CREATE INDEX IF NOT EXISTS idx_listing_search_vector
  ON "listing_records" USING gin("searchVector");

-- 5. Trigram GIN indexes for fuzzy matching / similarity
CREATE INDEX IF NOT EXISTS idx_listing_title_trgm
  ON "listing_records" USING gin("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listing_sku_trgm
  ON "listing_records" USING gin("customLabelSku" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listing_brand_trgm
  ON "listing_records" USING gin("cBrand" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listing_mpn_trgm
  ON "listing_records" USING gin("cManufacturerPartNumber" gin_trgm_ops);

-- 6. B-tree indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_listing_brand
  ON "listing_records"("cBrand");

CREATE INDEX IF NOT EXISTS idx_listing_condition
  ON "listing_records"("conditionId");

CREATE INDEX IF NOT EXISTS idx_listing_source_file
  ON "listing_records"("sourceFileName");

CREATE INDEX IF NOT EXISTS idx_listing_c_type
  ON "listing_records"("cType");

-- 7. Price index (cast to numeric for range queries)
CREATE INDEX IF NOT EXISTS idx_listing_price
  ON "listing_records"( (NULLIF("startPrice", '')::numeric) )
  WHERE "startPrice" IS NOT NULL AND "startPrice" != '';

-- 8. Trigger to auto-update searchVector on INSERT / UPDATE
CREATE OR REPLACE FUNCTION listing_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW."customLabelSku", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."cBrand", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."cManufacturerPartNumber", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."cOeOemPartNumber", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."categoryName", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."cType", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."cFeatures", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."description", '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trig_listing_search_vector ON "listing_records";

CREATE TRIGGER trig_listing_search_vector
  BEFORE INSERT OR UPDATE ON "listing_records"
  FOR EACH ROW EXECUTE FUNCTION listing_search_vector_trigger();

-- 9. Verify
SELECT
  COUNT(*) AS total_rows,
  COUNT("searchVector") AS rows_with_vector,
  pg_size_pretty(pg_total_relation_size('listing_records')) AS table_size
FROM "listing_records";
