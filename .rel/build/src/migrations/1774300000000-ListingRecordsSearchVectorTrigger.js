"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingRecordsSearchVectorTrigger1774300000000 = void 0;
class ListingRecordsSearchVectorTrigger1774300000000 {
    name = 'ListingRecordsSearchVectorTrigger1774300000000';
    async up(queryRunner) {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION listing_search_vector_trigger() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" :=
          setweight(to_tsvector('english', COALESCE(NEW."customLabelSku", '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW."cBrand", '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW."cManufacturerPartNumber", '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW."cOeOemPartNumber", '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW."categoryName", '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(NEW."cType", '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(NEW."cFeatures", '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(NEW."description", '')), 'D');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `);
        await queryRunner.query(`DROP TRIGGER IF EXISTS trig_listing_search_vector ON "listing_records"`);
        await queryRunner.query(`
      CREATE TRIGGER trig_listing_search_vector
      BEFORE INSERT OR UPDATE ON "listing_records"
      FOR EACH ROW EXECUTE FUNCTION listing_search_vector_trigger()
    `);
        await queryRunner.query(`
      UPDATE "listing_records" SET "searchVector" =
        setweight(to_tsvector('english', COALESCE("customLabelSku", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE("title", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE("cBrand", '')), 'B') ||
        setweight(to_tsvector('english', COALESCE("cManufacturerPartNumber", '')), 'B') ||
        setweight(to_tsvector('english', COALESCE("cOeOemPartNumber", '')), 'B') ||
        setweight(to_tsvector('english', COALESCE("categoryName", '')), 'C') ||
        setweight(to_tsvector('english', COALESCE("cType", '')), 'C') ||
        setweight(to_tsvector('english', COALESCE("cFeatures", '')), 'C') ||
        setweight(to_tsvector('english', COALESCE("description", '')), 'D')
      WHERE "searchVector" IS NULL
         OR "searchVector" = ''::tsvector
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_listing_search_vector
      ON "listing_records" USING gin("searchVector")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TRIGGER IF EXISTS trig_listing_search_vector ON "listing_records"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS listing_search_vector_trigger()`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_listing_search_vector`);
    }
}
exports.ListingRecordsSearchVectorTrigger1774300000000 = ListingRecordsSearchVectorTrigger1774300000000;
//# sourceMappingURL=1774300000000-ListingRecordsSearchVectorTrigger.js.map