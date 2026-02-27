-- ============================================================================
-- Extract Make & Model from listing titles
-- Title patterns: "YYYY-YYYY Make Model Part..." or "YYYY Make Model Part..."
--                 "YY-YY Make Model Part..." or "# Make Model Part..."
-- ============================================================================

SET client_min_messages TO WARNING;   -- suppress FTS "word too long" notices

-- Disable FTS trigger to prevent slow re-indexing during bulk UPDATE
ALTER TABLE listing_records DISABLE TRIGGER trig_listing_search_vector;

-- ── 1. Add columns if they don't exist ──
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS "extractedMake" VARCHAR(100);
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS "extractedModel" VARCHAR(100);

-- ── 2. Create indexes ──
CREATE INDEX IF NOT EXISTS idx_listing_extracted_make  ON listing_records("extractedMake");
CREATE INDEX IF NOT EXISTS idx_listing_extracted_model ON listing_records("extractedModel");

-- Year-prefix regex used throughout:  ^\d{2,4}(?:-\d{2,4})?\s+
-- Also handle rare # prefix:          ^#\s*

-- ── 3. Extract make from title ──
UPDATE listing_records SET "extractedMake" = CASE
  -- Multi-word makes (longest match first)
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Aston\s+Martin\b'   THEN 'Aston Martin'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Alfa\s+Romeo\b'     THEN 'Alfa Romeo'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Land\s+Rover\b'     THEN 'Land Rover'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Range\s+Rover\b'    THEN 'Range Rover'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Rolls[\s-]Royce\b'  THEN 'Rolls-Royce'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Mercedes[\s-]Benz\b' THEN 'Mercedes-Benz'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Mini\s+Cooper\b'    THEN 'MINI'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+BMW\s+MINI\b'       THEN 'MINI'
  -- Single-word aliases → normalized
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Mercedes\b'     THEN 'Mercedes-Benz'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+VW\b'           THEN 'Volkswagen'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Volkswagen\b'   THEN 'Volkswagen'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Chevy\b'        THEN 'Chevrolet'
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+Mini\b'         THEN 'MINI'
  -- Handle "# MINI Cooper ..."  (hash prefix)
  WHEN title ~* '^#\s*MINI\s+Cooper\b'                    THEN 'MINI'
  WHEN title ~* '^#\s*(\w+)'                              THEN INITCAP((regexp_match(title, '^#\s*(\w+)', 'i'))[1])
  -- Generic single-word make: first word after year prefix
  WHEN title ~* '^\d{2,4}(?:-\d{2,4})?\s+(\w+)' THEN INITCAP(
    (regexp_match(title, '^\d{2,4}(?:-\d{2,4})?\s+(\w+)', 'i'))[1]
  )
  ELSE NULL
END
WHERE title IS NOT NULL;

-- Fix uppercase brand names that INITCAP lowered
UPDATE listing_records SET "extractedMake" = 'BMW'  WHERE "extractedMake" = 'Bmw';
UPDATE listing_records SET "extractedMake" = 'GMC'  WHERE "extractedMake" = 'Gmc';
UPDATE listing_records SET "extractedMake" = 'DS'   WHERE "extractedMake" = 'Ds';
UPDATE listing_records SET "extractedMake" = 'MINI' WHERE "extractedMake" = 'Mini';
UPDATE listing_records SET "extractedMake" = 'SEAT' WHERE "extractedMake" = 'Seat';

-- ── 4. Extract model from title ──
-- Strategy: strip year-prefix + make, take first token as model
-- Use a simple approach: extract the first word AFTER the make
UPDATE listing_records
SET "extractedModel" = extracted.model
FROM (
  SELECT
    lr.id,
    -- Get the "rest" of the title after stripping year + make
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

-- Re-enable FTS trigger
ALTER TABLE listing_records ENABLE TRIGGER trig_listing_search_vector;
