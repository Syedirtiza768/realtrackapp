SELECT COUNT(*) AS total_rows FROM listing_records;
SELECT COUNT(DISTINCT "customLabelSku") AS unique_skus FROM listing_records;
SELECT "sourceFileName", COUNT(*) AS rows FROM listing_records GROUP BY "sourceFileName" ORDER BY "sourceFileName";
