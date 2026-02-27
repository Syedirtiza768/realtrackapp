SET client_min_messages TO WARNING;
ALTER TABLE listing_records DISABLE TRIGGER trig_listing_search_vector;

-- Fix multi-word makes
UPDATE listing_records SET "extractedMake" = 'Mercedes-Benz' WHERE "extractedMake" IN ('Mercedes');
UPDATE listing_records SET "extractedMake" = 'Land Rover' WHERE "extractedMake" = 'Land';
UPDATE listing_records SET "extractedMake" = 'Range Rover' WHERE "extractedMake" = 'Range';

-- Fix model for rows where make was "Land" → model was "Rover" → now need to re-extract model
-- For Land Rover: strip "YYYY-YYYY Land Rover" and get next word
UPDATE listing_records SET "extractedModel" = (
  regexp_match(title, '^\d{2,4}(?:-\d{2,4})?\s+Land\s+Rover\s+(\S+)', 'i')
)[1]
WHERE "extractedMake" = 'Land Rover' AND "extractedModel" = 'Rover';

-- For Range Rover: strip "YYYY-YYYY Range Rover" and get next word
UPDATE listing_records SET "extractedModel" = (
  regexp_match(title, '^\d{2,4}(?:-\d{2,4})?\s+Range\s+Rover\s+(\S+)', 'i')
)[1]
WHERE "extractedMake" = 'Range Rover' AND "extractedModel" = 'Rover';

-- For Mercedes-Benz: the model currently is "GL-Class", "E-Class", "W212" etc - keep those
-- But some might have grabbed "Benz" as model. Fix those:
UPDATE listing_records SET "extractedModel" = (
  regexp_match(title, '^\d{2,4}(?:-\d{2,4})?\s+Mercedes[\s-]Benz\s+(\S+)', 'i')
)[1]
WHERE "extractedMake" = 'Mercedes-Benz' AND "extractedModel" IN ('Benz', 'GL-Class,');

-- For Mercedes-Benz where original was just "Mercedes", model was the second word: SLK280, CLK, W212 etc - keep those

ALTER TABLE listing_records ENABLE TRIGGER trig_listing_search_vector;

-- Verify
SELECT "extractedMake", COUNT(*) AS cnt FROM listing_records WHERE "extractedMake" IS NOT NULL GROUP BY 1 ORDER BY cnt DESC LIMIT 25;
SELECT "extractedMake", "extractedModel", COUNT(*) AS cnt FROM listing_records WHERE "extractedModel" IS NOT NULL GROUP BY 1,2 ORDER BY cnt DESC LIMIT 30;
