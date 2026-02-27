SET client_min_messages TO WARNING;

SELECT 'MAKES:' AS label;
SELECT "extractedMake" AS make, COUNT(*) AS cnt
FROM listing_records
WHERE "extractedMake" IS NOT NULL
GROUP BY "extractedMake"
ORDER BY cnt DESC
LIMIT 20;

SELECT 'MODELS:' AS label;
SELECT "extractedMake" AS make, "extractedModel" AS model, COUNT(*) AS cnt
FROM listing_records
WHERE "extractedMake" IS NOT NULL AND "extractedModel" IS NOT NULL
GROUP BY "extractedMake", "extractedModel"
ORDER BY cnt DESC
LIMIT 20;

SELECT 'TOTALS:' AS label;
SELECT
  COUNT(*) AS total,
  COUNT("extractedMake") AS with_make,
  COUNT("extractedModel") AS with_model
FROM listing_records;
