SELECT 'format' as col, COUNT(DISTINCT format) as distinct_vals, COUNT(*) FILTER (WHERE format IS NOT NULL AND format != '') as non_null FROM listing_records
UNION ALL SELECT 'location', COUNT(DISTINCT location), COUNT(*) FILTER (WHERE location IS NOT NULL AND location != '') FROM listing_records
UNION ALL SELECT 'cDriveType', COUNT(DISTINCT "cDriveType"), COUNT(*) FILTER (WHERE "cDriveType" IS NOT NULL AND "cDriveType" != '') FROM listing_records
UNION ALL SELECT 'cFuelType', COUNT(DISTINCT "cFuelType"), COUNT(*) FILTER (WHERE "cFuelType" IS NOT NULL AND "cFuelType" != '') FROM listing_records
UNION ALL SELECT 'cOperatingMode', COUNT(DISTINCT "cOperatingMode"), COUNT(*) FILTER (WHERE "cOperatingMode" IS NOT NULL AND "cOperatingMode" != '') FROM listing_records
UNION ALL SELECT 'manufacturerName', COUNT(DISTINCT "manufacturerName"), COUNT(*) FILTER (WHERE "manufacturerName" IS NOT NULL AND "manufacturerName" != '') FROM listing_records
UNION ALL SELECT 'bestOfferEnabled', COUNT(DISTINCT "bestOfferEnabled"), COUNT(*) FILTER (WHERE "bestOfferEnabled" IS NOT NULL AND "bestOfferEnabled" != '') FROM listing_records
UNION ALL SELECT 'returnsAccepted', COUNT(DISTINCT "returnsAcceptedOption"), COUNT(*) FILTER (WHERE "returnsAcceptedOption" IS NOT NULL AND "returnsAcceptedOption" != '') FROM listing_records
UNION ALL SELECT 'cFeatures', COUNT(DISTINCT "cFeatures"), COUNT(*) FILTER (WHERE "cFeatures" IS NOT NULL AND "cFeatures" != '') FROM listing_records
UNION ALL SELECT 'cBrand', COUNT(DISTINCT "cBrand"), COUNT(*) FILTER (WHERE "cBrand" IS NOT NULL AND "cBrand" != '') FROM listing_records
UNION ALL SELECT 'cType', COUNT(DISTINCT "cType"), COUNT(*) FILTER (WHERE "cType" IS NOT NULL AND "cType" != '') FROM listing_records
UNION ALL SELECT 'conditionId', COUNT(DISTINCT "conditionId"), COUNT(*) FILTER (WHERE "conditionId" IS NOT NULL AND "conditionId" != '') FROM listing_records
UNION ALL SELECT 'categoryName', COUNT(DISTINCT "categoryName"), COUNT(*) FILTER (WHERE "categoryName" IS NOT NULL AND "categoryName" != '') FROM listing_records
UNION ALL SELECT 'cMPN', COUNT(DISTINCT "cManufacturerPartNumber"), COUNT(*) FILTER (WHERE "cManufacturerPartNumber" IS NOT NULL AND "cManufacturerPartNumber" != '') FROM listing_records
UNION ALL SELECT 'cOemPartNum', COUNT(DISTINCT "cOeOemPartNumber"), COUNT(*) FILTER (WHERE "cOeOemPartNumber" IS NOT NULL AND "cOeOemPartNumber" != '') FROM listing_records
ORDER BY non_null DESC;
