-- Check problematic price values
SELECT DISTINCT "startPrice" FROM listing_records 
WHERE "startPrice" ~ ',' AND "startPrice" IS NOT NULL AND "startPrice" != '' 
LIMIT 20;

-- Count them
SELECT COUNT(*) as comma_prices FROM listing_records 
WHERE "startPrice" ~ ',' AND "startPrice" IS NOT NULL AND "startPrice" != '';

-- Also check for any other non-numeric patterns
SELECT DISTINCT "startPrice" FROM listing_records 
WHERE "startPrice" IS NOT NULL AND "startPrice" != '' 
AND "startPrice" !~ '^\d+\.?\d*$'
LIMIT 20;
