import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogImportSystem1772600000000 implements MigrationInterface {
  name = 'CatalogImportSystem1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── catalog_products table ───────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_products" (
        "id"                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "sku"                 text,
        "mpn"                 text,
        "mpn_normalized"      text,
        "upc"                 text,
        "ean"                 text,
        "ebay_item_id"        text,
        "epid"                text,
        "title"               text NOT NULL,
        "title_normalized"    text,
        "description"         text,
        "brand"               text,
        "brand_normalized"    text,
        "part_type"           text,
        "placement"           text,
        "material"            text,
        "features"            text,
        "country_of_origin"   text,
        "oem_part_number"     text,
        "price"               numeric(12,2),
        "quantity"            integer,
        "condition_id"        text,
        "condition_label"     text,
        "category_id"         text,
        "category_name"       text,
        "image_urls"          text[] DEFAULT '{}',
        "location"            text,
        "format"              text,
        "duration"            text,
        "shipping_profile"    text,
        "return_profile"      text,
        "payment_profile"     text,
        "fitment_data"        jsonb,
        "source_file"         text,
        "source_row"          integer,
        "import_id"           uuid,
        "createdAt"           timestamptz DEFAULT now(),
        "updatedAt"           timestamptz DEFAULT now(),
        "searchVector"        tsvector
      );
    `);

    // Indexes for catalog_products
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_catalog_sku" ON "catalog_products" ("sku") WHERE "sku" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_catalog_mpn" ON "catalog_products" ("mpn")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_catalog_upc" ON "catalog_products" ("upc") WHERE "upc" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_catalog_ebay_item_id" ON "catalog_products" ("ebay_item_id") WHERE "ebay_item_id" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_catalog_brand_mpn" ON "catalog_products" ("brand_normalized", "mpn_normalized")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_catalog_title_normalized" ON "catalog_products" ("title_normalized")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_catalog_brand" ON "catalog_products" ("brand_normalized")`);

    // ── catalog_imports table ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_imports" (
        "id"                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "file_name"           text NOT NULL,
        "file_path"           text,
        "file_size_bytes"     bigint,
        "mime_type"           text,
        "detected_headers"    text[] DEFAULT '{}',
        "column_mapping"      jsonb,
        "status"              varchar(20) DEFAULT 'pending',
        "total_rows"          integer DEFAULT 0,
        "processed_rows"      integer DEFAULT 0,
        "inserted_rows"       integer DEFAULT 0,
        "updated_rows"        integer DEFAULT 0,
        "skipped_duplicates"  integer DEFAULT 0,
        "flagged_for_review"  integer DEFAULT 0,
        "invalid_rows"        integer DEFAULT 0,
        "error_message"       text,
        "warnings"            jsonb,
        "last_processed_row"  integer DEFAULT 0,
        "created_by"          uuid,
        "started_at"          timestamptz,
        "completed_at"        timestamptz,
        "createdAt"           timestamptz DEFAULT now(),
        "updatedAt"           timestamptz DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_catalog_import_status" ON "catalog_imports" ("status")`);

    // ── catalog_import_rows table ───────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_import_rows" (
        "id"                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "import_id"           uuid NOT NULL REFERENCES "catalog_imports"("id") ON DELETE CASCADE,
        "row_number"          integer NOT NULL,
        "status"              varchar(30) NOT NULL,
        "match_strategy"      text,
        "matched_product_id"  uuid REFERENCES "catalog_products"("id") ON DELETE SET NULL,
        "created_product_id"  uuid,
        "message"             text,
        "raw_data"            jsonb,
        "createdAt"           timestamptz DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_import_row_import_id" ON "catalog_import_rows" ("import_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_import_row_status" ON "catalog_import_rows" ("status")`);

    // ── Full-text search trigger for catalog_products ────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION catalog_products_search_update() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" :=
          setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW."brand", '')), 'B') ||
          setweight(to_tsvector('english', coalesce(NEW."mpn", '')), 'B') ||
          setweight(to_tsvector('english', coalesce(NEW."oem_part_number", '')), 'B') ||
          setweight(to_tsvector('english', coalesce(NEW."part_type", '')), 'C') ||
          setweight(to_tsvector('english', coalesce(NEW."description", '')), 'D');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_catalog_products_search ON "catalog_products";
      CREATE TRIGGER trg_catalog_products_search
        BEFORE INSERT OR UPDATE ON "catalog_products"
        FOR EACH ROW EXECUTE FUNCTION catalog_products_search_update();
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_catalog_search_vector" ON "catalog_products" USING gin("searchVector")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_catalog_products_search ON "catalog_products"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS catalog_products_search_update()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_import_rows"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_imports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_products"`);
  }
}
