import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase1 Upgrade: Master Products, eBay Offers, Cross-References,
 * eBay Categories, Competitor Prices, Market Snapshots, Export Rules.
 *
 * Also extends stores table with eBay-specific columns and converts
 * listing_records price columns from TEXT to NUMERIC.
 */
export class Phase1UpgradeSchema1774000000000 implements MigrationInterface {
  name = 'Phase1UpgradeSchema1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════════════════════════════════════════════
    //  master_products
    // ═══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "master_products" (
        "id"                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id"     uuid,
        "sku"                 varchar(100) NOT NULL,
        "brand"               varchar(200),
        "mpn"                 varchar(200),
        "oem_number"          varchar(200),
        "upc"                 varchar(100),
        "ean"                 varchar(100),
        "epid"                varchar(100),
        "title"               varchar(200) NOT NULL,
        "part_type"           varchar(200),
        "condition"           varchar(50) NOT NULL DEFAULT 'NEW',
        "condition_description" text,
        "description"         text,
        "short_description"   text,
        "features"            jsonb NOT NULL DEFAULT '[]',
        "cost_price"          numeric(12,2),
        "retail_price"        numeric(12,2),
        "map_price"           numeric(12,2),
        "currency"            varchar(3) NOT NULL DEFAULT 'USD',
        "total_quantity"      integer NOT NULL DEFAULT 0,
        "warehouse_location"  varchar(100),
        "weight_lbs"          numeric(8,2),
        "dimensions"          jsonb,
        "image_urls"          jsonb NOT NULL DEFAULT '[]',
        "ebay_category_id"    varchar(50),
        "ebay_category_name"  varchar(300),
        "item_specifics"      jsonb NOT NULL DEFAULT '{}',
        "ai_search_keywords"  jsonb NOT NULL DEFAULT '[]',
        "ai_confidence"       jsonb,
        "ai_enriched_at"      timestamptz,
        "status"              varchar(20) NOT NULL DEFAULT 'draft',
        "source_file"         varchar(500),
        "listing_record_id"   uuid,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_master_product_sku" ON "master_products" ("sku");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_master_product_brand" ON "master_products" ("brand");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_master_product_mpn" ON "master_products" ("mpn");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_master_product_oem" ON "master_products" ("oem_number");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_master_product_part_type" ON "master_products" ("part_type");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_master_product_org" ON "master_products" ("organization_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_master_product_status" ON "master_products" ("status");`);

    // ═══════════════════════════════════════════════════════
    //  ebay_offers
    // ═══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ebay_offers" (
        "id"                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "master_product_id"     uuid NOT NULL REFERENCES "master_products"("id") ON DELETE CASCADE,
        "store_id"              uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
        "sku"                   varchar(100) NOT NULL,
        "ebay_offer_id"         varchar(100),
        "ebay_listing_id"       varchar(100),
        "marketplace_id"        varchar(30) NOT NULL DEFAULT 'EBAY_US',
        "title_override"        varchar(200),
        "price"                 numeric(12,2),
        "quantity"              integer,
        "category_id"           varchar(50),
        "format"                varchar(20) NOT NULL DEFAULT 'FIXED_PRICE',
        "fulfillment_policy_id" varchar(100),
        "payment_policy_id"     varchar(100),
        "return_policy_id"      varchar(100),
        "merchant_location_key" varchar(100),
        "status"                varchar(20) NOT NULL DEFAULT 'draft',
        "last_error"            text,
        "last_synced_at"        timestamptz,
        "published_at"          timestamptz,
        "ended_at"              timestamptz,
        "created_at"            timestamptz NOT NULL DEFAULT now(),
        "updated_at"            timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ebay_offer_product" ON "ebay_offers" ("master_product_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ebay_offer_store" ON "ebay_offers" ("store_id");`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_ebay_offer_ebay_offer_id" ON "ebay_offers" ("ebay_offer_id") WHERE "ebay_offer_id" IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ebay_offer_ebay_listing_id" ON "ebay_offers" ("ebay_listing_id");`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_ebay_offer_sku_store" ON "ebay_offers" ("sku", "store_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ebay_offer_status" ON "ebay_offers" ("status");`);

    // ═══════════════════════════════════════════════════════
    //  cross_references
    // ═══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cross_references" (
        "id"                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "master_product_id" uuid NOT NULL REFERENCES "master_products"("id") ON DELETE CASCADE,
        "part_number"       varchar(200) NOT NULL,
        "brand"             varchar(200),
        "reference_type"    varchar(50) NOT NULL,
        "notes"             text,
        "source"            varchar(50) NOT NULL DEFAULT 'manual',
        "created_at"        timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_xref_product" ON "cross_references" ("master_product_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_xref_part_number" ON "cross_references" ("part_number");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_xref_type" ON "cross_references" ("reference_type");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_xref_brand_part" ON "cross_references" ("brand", "part_number");`);

    // ═══════════════════════════════════════════════════════
    //  ebay_categories
    // ═══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ebay_categories" (
        "id"                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "ebay_category_id"        varchar(50) NOT NULL,
        "tree_id"                 varchar(10) NOT NULL,
        "parent_category_id"      varchar(50),
        "category_name"           varchar(300) NOT NULL,
        "category_path"           text,
        "depth"                   integer NOT NULL DEFAULT 0,
        "is_leaf"                 boolean NOT NULL DEFAULT false,
        "required_aspects"        jsonb NOT NULL DEFAULT '[]',
        "recommended_aspects"     jsonb NOT NULL DEFAULT '[]',
        "supports_compatibility"  boolean NOT NULL DEFAULT false,
        "tree_version"            varchar(50),
        "created_at"              timestamptz NOT NULL DEFAULT now(),
        "updated_at"              timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_ebay_cat_id_tree" ON "ebay_categories" ("ebay_category_id", "tree_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ebay_cat_parent" ON "ebay_categories" ("parent_category_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ebay_cat_name" ON "ebay_categories" ("category_name");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ebay_cat_leaf" ON "ebay_categories" ("is_leaf");`);

    // ═══════════════════════════════════════════════════════
    //  competitor_prices
    // ═══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "competitor_prices" (
        "id"                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "master_product_id" uuid,
        "part_number"       varchar(200) NOT NULL,
        "ebay_item_id"      varchar(100),
        "title"             varchar(300),
        "seller"            varchar(100),
        "price"             numeric(12,2) NOT NULL,
        "currency"          varchar(3) NOT NULL DEFAULT 'USD',
        "condition"         varchar(50),
        "quantity_available" integer,
        "quantity_sold"     integer,
        "captured_at"       timestamptz NOT NULL,
        "created_at"        timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_competitor_part" ON "competitor_prices" ("part_number");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_competitor_captured" ON "competitor_prices" ("captured_at");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_competitor_product" ON "competitor_prices" ("master_product_id");`);

    // ═══════════════════════════════════════════════════════
    //  market_snapshots
    // ═══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_snapshots" (
        "id"                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "master_product_id"   uuid NOT NULL,
        "part_number"         varchar(200) NOT NULL,
        "total_listings"      integer NOT NULL DEFAULT 0,
        "avg_price"           numeric(12,2),
        "median_price"        numeric(12,2),
        "min_price"           numeric(12,2),
        "max_price"           numeric(12,2),
        "recommended_pricing" jsonb,
        "market_insights"     jsonb NOT NULL DEFAULT '[]',
        "confidence"          numeric(3,2),
        "ai_cost_usd"        numeric(8,4),
        "captured_at"         timestamptz NOT NULL,
        "created_at"          timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_market_snapshot_product" ON "market_snapshots" ("master_product_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_market_snapshot_captured" ON "market_snapshots" ("captured_at");`);

    // ═══════════════════════════════════════════════════════
    //  export_rules
    // ═══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "export_rules" (
        "id"                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id"       uuid,
        "name"                  varchar(200) NOT NULL,
        "description"           text,
        "store_id"              uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
        "filters"               jsonb NOT NULL DEFAULT '{}',
        "price_multiplier"      numeric(5,4) NOT NULL DEFAULT 1,
        "price_addition"        numeric(12,2) NOT NULL DEFAULT 0,
        "title_prefix"          varchar(50),
        "title_suffix"          varchar(50),
        "fulfillment_policy_id" varchar(100),
        "payment_policy_id"     varchar(100),
        "return_policy_id"      varchar(100),
        "schedule_cron"         varchar(50),
        "auto_publish"          boolean NOT NULL DEFAULT false,
        "status"                varchar(20) NOT NULL DEFAULT 'active',
        "last_run_at"           timestamptz,
        "last_run_count"        integer NOT NULL DEFAULT 0,
        "total_exported"        integer NOT NULL DEFAULT 0,
        "created_at"            timestamptz NOT NULL DEFAULT now(),
        "updated_at"            timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_export_rule_store" ON "export_rules" ("store_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_export_rule_status" ON "export_rules" ("status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_export_rule_org" ON "export_rules" ("organization_id");`);

    // ═══════════════════════════════════════════════════════
    //  Extend stores table with eBay-specific columns
    // ═══════════════════════════════════════════════════════
    await queryRunner.query(`
      ALTER TABLE "stores"
        ADD COLUMN IF NOT EXISTS "ebay_user_id"           varchar(200),
        ADD COLUMN IF NOT EXISTS "ebay_site_id"           varchar(10),
        ADD COLUMN IF NOT EXISTS "ebay_marketplace_id"    varchar(30) DEFAULT 'EBAY_US',
        ADD COLUMN IF NOT EXISTS "fulfillment_policy_id"  varchar(100),
        ADD COLUMN IF NOT EXISTS "payment_policy_id"      varchar(100),
        ADD COLUMN IF NOT EXISTS "return_policy_id"       varchar(100),
        ADD COLUMN IF NOT EXISTS "location_key"           varchar(100),
        ADD COLUMN IF NOT EXISTS "token_expires_at"       timestamptz,
        ADD COLUMN IF NOT EXISTS "last_sync_at"           timestamptz;
    `);

    // ═══════════════════════════════════════════════════════
    //  Convert TEXT price columns to NUMERIC in listing_records
    //  (safe: uses NULLIF + CAST to handle empty strings)
    // ═══════════════════════════════════════════════════════
    // Add numeric shadow columns first, then migrate data
    await queryRunner.query(`
      ALTER TABLE "listing_records"
        ADD COLUMN IF NOT EXISTS "start_price_num"              numeric(12,2),
        ADD COLUMN IF NOT EXISTS "buy_it_now_price_num"         numeric(12,2),
        ADD COLUMN IF NOT EXISTS "best_offer_auto_accept_num"   numeric(12,2),
        ADD COLUMN IF NOT EXISTS "minimum_best_offer_num"       numeric(12,2);
    `);

    // Populate numeric columns from text
    await queryRunner.query(`
      UPDATE "listing_records" SET
        "start_price_num" = NULLIF(regexp_replace("startPrice", '[^0-9.]', '', 'g'), '')::numeric(12,2),
        "buy_it_now_price_num" = NULLIF(regexp_replace("buyItNowPrice", '[^0-9.]', '', 'g'), '')::numeric(12,2),
        "best_offer_auto_accept_num" = NULLIF(regexp_replace("bestOfferAutoAcceptPrice", '[^0-9.]', '', 'g'), '')::numeric(12,2),
        "minimum_best_offer_num" = NULLIF(regexp_replace("minimumBestOfferPrice", '[^0-9.]', '', 'g'), '')::numeric(12,2)
      WHERE "startPrice" IS NOT NULL
        OR "buyItNowPrice" IS NOT NULL
        OR "bestOfferAutoAcceptPrice" IS NOT NULL
        OR "minimumBestOfferPrice" IS NOT NULL;
    `);

    // Index the numeric price column
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_start_price_num" ON "listing_records" ("start_price_num");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_start_price_num";`);

    // Drop numeric shadow columns
    await queryRunner.query(`
      ALTER TABLE "listing_records"
        DROP COLUMN IF EXISTS "start_price_num",
        DROP COLUMN IF EXISTS "buy_it_now_price_num",
        DROP COLUMN IF EXISTS "best_offer_auto_accept_num",
        DROP COLUMN IF EXISTS "minimum_best_offer_num";
    `);

    // Drop eBay-specific store columns
    await queryRunner.query(`
      ALTER TABLE "stores"
        DROP COLUMN IF EXISTS "ebay_user_id",
        DROP COLUMN IF EXISTS "ebay_site_id",
        DROP COLUMN IF EXISTS "ebay_marketplace_id",
        DROP COLUMN IF EXISTS "fulfillment_policy_id",
        DROP COLUMN IF EXISTS "payment_policy_id",
        DROP COLUMN IF EXISTS "return_policy_id",
        DROP COLUMN IF EXISTS "location_key",
        DROP COLUMN IF EXISTS "token_expires_at",
        DROP COLUMN IF EXISTS "last_sync_at";
    `);

    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "export_rules" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "market_snapshots" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competitor_prices" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ebay_categories" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cross_references" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ebay_offers" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "master_products" CASCADE;`);
  }
}
