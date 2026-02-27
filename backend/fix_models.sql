SET client_min_messages TO WARNING;
ALTER TABLE listing_records DISABLE TRIGGER trig_listing_search_vector;

-- Land Rover "Range" model → "Range Rover" (they're "Land Rover Range Rover ..." titles)
UPDATE listing_records SET "extractedModel" = 'Range Rover'
WHERE "extractedMake" = 'Land Rover' AND "extractedModel" = 'Range';

-- Land Rover "Rover" model → re-extract
UPDATE listing_records SET "extractedModel" = (
  regexp_match(title, '^\d{2,4}(?:-\d{2,4})?\s+Land\s+Rover\s+(\S+)', 'i')
)[1]
WHERE "extractedMake" = 'Land Rover' AND "extractedModel" = 'Rover';

ALTER TABLE listing_records ENABLE TRIGGER trig_listing_search_vector;
