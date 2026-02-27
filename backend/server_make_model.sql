-- ============================================================================
-- COMBINED: Extract Make & Model from listing titles (server-safe)
-- Run on server: psql -U postgres -d listingpro -f server_make_model.sql
-- ============================================================================

SET client_min_messages TO WARNING;

-- Disable FTS trigger if it exists (won't error if missing)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trig_listing_search_vector') THEN
    ALTER TABLE listing_records DISABLE TRIGGER trig_listing_search_vector;
  END IF;
END $$;

-- ── 1. Add columns ──
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS "extractedMake" VARCHAR(100);
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS "extractedModel" VARCHAR(100);

-- ── 2. Create indexes ──
CREATE INDEX IF NOT EXISTS idx_listing_extracted_make  ON listing_records("extractedMake");
CREATE INDEX IF NOT EXISTS idx_listing_extracted_model ON listing_records("extractedModel");

-- ── 3. Extract make from title ──
UPDATE listing_records SET "extractedMake" = CASE
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Aston\s+Martin\b'    THEN 'Aston Martin'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Alfa\s+Romeo\b'      THEN 'Alfa Romeo'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Land\s+Rover\b'      THEN 'Land Rover'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Range\s+Rover\b'     THEN 'Range Rover'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Rolls[\s-]Royce\b'   THEN 'Rolls-Royce'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Mercedes[\s-]Benz\b' THEN 'Mercedes-Benz'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Mini\s+Cooper\b'     THEN 'MINI'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+BMW\s+MINI\b'        THEN 'MINI'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Mercedes\b'          THEN 'Mercedes-Benz'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+VW\b'                THEN 'Volkswagen'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Volkswagen\b'        THEN 'Volkswagen'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Chevy\b'             THEN 'Chevrolet'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Mini\b'              THEN 'MINI'
  WHEN title ~* '^#\s*MINI\s+Cooper\b'                         THEN 'MINI'
  WHEN title ~* '^#\s*(\w+)'          THEN INITCAP((regexp_match(title, '^#\s*(\w+)', 'i'))[1])
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+(\w+)' THEN INITCAP(
    (regexp_match(title, '^\d{2,4}(?:-\d{2,4})?\s+(\w+)', 'i'))[1]
  )
  ELSE NULL
END
WHERE title IS NOT NULL;

-- Fix uppercase brand names
UPDATE listing_records SET "extractedMake" = 'BMW'  WHERE "extractedMake" = 'Bmw';
UPDATE listing_records SET "extractedMake" = 'GMC'  WHERE "extractedMake" = 'Gmc';
UPDATE listing_records SET "extractedMake" = 'DS'   WHERE "extractedMake" = 'Ds';
UPDATE listing_records SET "extractedMake" = 'MINI' WHERE "extractedMake" = 'Mini';
UPDATE listing_records SET "extractedMake" = 'SEAT' WHERE "extractedMake" = 'Seat';

-- ── 4. Extract model from title ──
UPDATE listing_records
SET "extractedModel" = extracted.model
FROM (
  SELECT
    lr.id,
    CASE
      WHEN lr.title ~* '^\d{2,4}(?:-\d{2,4})?\s+(?:Aston\s+Martin|Alfa\s+Romeo|Land\s+Rover|Range\s+Rover|Rolls[\s-]Royce|Mercedes[\s-]Benz|Mini\s+Cooper|BMW\s+MINI)\s+(\S+)'
        THEN (regexp_match(lr.title, '^\d{2,4}(?:-\d{2,4})?\s+(?:Aston\s+Martin|Alfa\s+Romeo|Land\s+Rover|Range\s+Rover|Rolls[\s-]Royce|Mercedes[\s-]Benz|Mini\s+Cooper|BMW\s+MINI)\s+(\S+)', 'i'))[1]
      WHEN lr.title ~* '^#\s*\w+(?:\s+Cooper)?\s+(\S+)'
        THEN (regexp_match(lr.title, '^#\s*\w+(?:\s+Cooper)?\s+(\S+)', 'i'))[1]
      WHEN lr.title ~* '^\d{2,4}(?:-\d{2,4})?\s+\w+\s+(\S+)'
        THEN (regexp_match(lr.title, '^\d{2,4}(?:-\d{2,4})?\s+\w+\s+(\S+)', 'i'))[1]
      ELSE NULL
    END AS model
  FROM listing_records lr
  WHERE lr."extractedMake" IS NOT NULL
) extracted
WHERE extracted.id = listing_records.id
  AND extracted.model IS NOT NULL;

-- ── 5. Fix multi-word make/model issues ──
UPDATE listing_records SET "extractedMake" = 'Mercedes-Benz' WHERE "extractedMake" = 'Mercedes';
UPDATE listing_records SET "extractedMake" = 'Land Rover'    WHERE "extractedMake" = 'Land';
UPDATE listing_records SET "extractedMake" = 'Range Rover'   WHERE "extractedMake" = 'Range';

-- Land Rover "Range" model → "Range Rover"
UPDATE listing_records SET "extractedModel" = 'Range Rover'
WHERE "extractedMake" = 'Land Rover' AND "extractedModel" = 'Range';

-- Land Rover "Rover" model → re-extract
UPDATE listing_records SET "extractedModel" = (
  regexp_match(title, '^\d{2,4}(?:-\d{2,4})?\s+Land\s+Rover\s+(\S+)', 'i')
)[1]
WHERE "extractedMake" = 'Land Rover' AND "extractedModel" = 'Rover';

-- Re-enable FTS trigger if it exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trig_listing_search_vector') THEN
    ALTER TABLE listing_records ENABLE TRIGGER trig_listing_search_vector;
  END IF;
END $$;

-- ── 6. Verify ──
SELECT "extractedMake" AS make, COUNT(*) AS cnt
FROM listing_records WHERE "extractedMake" IS NOT NULL
GROUP BY 1 ORDER BY cnt DESC LIMIT 25;

SELECT "extractedMake" AS make, "extractedModel" AS model, COUNT(*) AS cnt
FROM listing_records WHERE "extractedModel" IS NOT NULL
GROUP BY 1, 2 ORDER BY cnt DESC LIMIT 20;

SELECT COUNT(*) AS total,
       COUNT("extractedMake") AS with_make,
       COUNT("extractedModel") AS with_model
FROM listing_records;
