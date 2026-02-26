-- Test full-text search with ranking
SELECT "customLabelSku", "title", "cBrand",
       ts_rank("searchVector", websearch_to_tsquery('english', 'mercedes brake pad')) AS rank
FROM "listing_records"
WHERE "searchVector" @@ websearch_to_tsquery('english', 'mercedes brake pad')
ORDER BY rank DESC
LIMIT 5;

-- Test fuzzy/trigram search
SELECT "customLabelSku", "title", similarity("title", 'mercedes brak pad') AS sim
FROM "listing_records"
WHERE similarity("title", 'mercedes brak pad') > 0.1
ORDER BY sim DESC
LIMIT 5;

-- Test index sizes
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'listing_records'
ORDER BY pg_relation_size(indexname::regclass) DESC;
