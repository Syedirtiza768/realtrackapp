SELECT COUNT(*) AS total,
       COUNT("searchVector") AS with_vector
FROM "listing_records";
