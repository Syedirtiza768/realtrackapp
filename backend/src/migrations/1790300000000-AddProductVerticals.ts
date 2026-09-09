import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive schema for explicit eBay product verticals and variant families.
 * Existing rows remain nullable/legacy-safe and resolve to automotive in code.
 */
export class AddProductVerticals1790300000000 implements MigrationInterface {
  name = 'AddProductVerticals1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stores"
        ADD COLUMN IF NOT EXISTS "vertical_config" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_products"
        ADD COLUMN IF NOT EXISTS "organization_id" uuid,
        ADD COLUMN IF NOT EXISTS "vertical" varchar(32),
        ADD COLUMN IF NOT EXISTS "vertical_attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS "vertical_validation_status" varchar(24) NOT NULL DEFAULT 'draft'
    `);
    await queryRunner.query(`
      ALTER TABLE "listing_records"
        ADD COLUMN IF NOT EXISTS "vertical" varchar(32),
        ADD COLUMN IF NOT EXISTS "vertical_attributes" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_imports"
        ADD COLUMN IF NOT EXISTS "organization_id" uuid,
        ADD COLUMN IF NOT EXISTS "vertical" varchar(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        ADD COLUMN IF NOT EXISTS "vertical" varchar(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "ebay_listing_job_targets"
        ADD COLUMN IF NOT EXISTS "vertical" varchar(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "ebay_listing_channels"
        ADD COLUMN IF NOT EXISTS "vertical" varchar(32)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_families" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid,
        "catalog_product_id" uuid,
        "vertical" varchar(32) NOT NULL,
        "slug" varchar(180) NOT NULL,
        "name" text NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_product_families_catalog_product"
          FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_families_org_slug"
        ON "product_families" ("organization_id", "slug")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_product_families_vertical"
        ON "product_families" ("organization_id", "vertical")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_variants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid,
        "family_id" uuid NOT NULL,
        "catalog_product_id" uuid,
        "vertical" varchar(32) NOT NULL,
        "sku" text NOT NULL,
        "price" numeric(12,2),
        "quantity" integer,
        "upc" text,
        "ean" text,
        "mpn" text,
        "condition_id" text,
        "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "image_urls" text[] NOT NULL DEFAULT '{}',
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_product_variants_family"
          FOREIGN KEY ("family_id") REFERENCES "product_families"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_product_variants_catalog_product"
          FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_variants_family_sku"
        ON "product_variants" ("family_id", "sku")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_product_variants_org_sku"
        ON "product_variants" ("organization_id", "sku")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "variant_marketplace_mappings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "variant_id" uuid NOT NULL,
        "ebay_account_id" uuid,
        "marketplace_id" varchar(30) NOT NULL,
        "inventory_sku" text NOT NULL,
        "offer_id" varchar(100),
        "listing_id" varchar(100),
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "last_error" text,
        "result_payload" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_variant_mappings_variant"
          FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_variant_mappings_target"
        ON "variant_marketplace_mappings" ("variant_id", "ebay_account_id", "marketplace_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_marketplace_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid,
        "catalog_product_id" uuid NOT NULL,
        "vertical" varchar(32) NOT NULL,
        "marketplace_id" varchar(30) NOT NULL,
        "category_tree_id" varchar(30) NOT NULL,
        "category_id" varchar(30) NOT NULL,
        "category_name" text,
        "aspect_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "condition_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "supports_variations" boolean,
        "fetched_at" timestamptz NOT NULL DEFAULT now(),
        "invalidated_at" timestamptz,
        CONSTRAINT "fk_product_marketplace_categories_product"
          FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_marketplace_categories_product_marketplace"
        ON "product_marketplace_categories" ("catalog_product_id", "marketplace_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_marketplace_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "variant_marketplace_mappings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_variants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_families"`);
    await queryRunner.query(`
      ALTER TABLE "ebay_listing_channels"
        DROP COLUMN IF EXISTS "vertical"
    `);
    await queryRunner.query(`
      ALTER TABLE "ebay_listing_job_targets"
        DROP COLUMN IF EXISTS "vertical"
    `);
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        DROP COLUMN IF EXISTS "vertical"
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_imports"
        DROP COLUMN IF EXISTS "vertical",
        DROP COLUMN IF EXISTS "organization_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "listing_records"
        DROP COLUMN IF EXISTS "vertical_attributes",
        DROP COLUMN IF EXISTS "vertical"
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_products"
        DROP COLUMN IF EXISTS "vertical_validation_status",
        DROP COLUMN IF EXISTS "vertical_attributes",
        DROP COLUMN IF EXISTS "vertical",
        DROP COLUMN IF EXISTS "organization_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "stores"
        DROP COLUMN IF EXISTS "vertical_config"
    `);
  }
}
