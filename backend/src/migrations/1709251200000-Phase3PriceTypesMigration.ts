import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.1 — TEXT → NUMERIC Price/Quantity Migration
 *
 * Strategy: Add new NUMERIC columns alongside existing TEXT columns.
 * The old TEXT columns remain untouched for rollback safety.
 * Application code reads from the new columns; the import pipeline
 * writes to BOTH (dual-write) during the transition period.
 *
 * Once fully validated, a future migration drops the old TEXT columns.
 */
export class Phase3PriceTypesMigration1709251200000 implements MigrationInterface {
  name = 'Phase3PriceTypesMigration1709251200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Step 1: Add new NUMERIC columns alongside TEXT ones ───
    await queryRunner.query(`
      ALTER TABLE listing_records
        ADD COLUMN IF NOT EXISTS "startPriceNum" NUMERIC(12,2),
        ADD COLUMN IF NOT EXISTS "quantityNum" INTEGER,
        ADD COLUMN IF NOT EXISTS "buyItNowPriceNum" NUMERIC(12,2),
        ADD COLUMN IF NOT EXISTS "bestOfferAutoAcceptPriceNum" NUMERIC(12,2),
        ADD COLUMN IF NOT EXISTS "minimumBestOfferPriceNum" NUMERIC(12,2),
        ADD COLUMN IF NOT EXISTS "shippingService1CostNum" NUMERIC(12,2),
        ADD COLUMN IF NOT EXISTS "shippingService2CostNum" NUMERIC(12,2)
    `);

    // ─── Step 2: Backfill — convert text values to numeric ───
    // Handles commas (e.g., "139,99"), currency symbols, spaces
    await queryRunner.query(`
      UPDATE listing_records SET
        "startPriceNum" = NULLIF(REGEXP_REPLACE(REPLACE(REPLACE("startPrice", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2),
        "quantityNum" = NULLIF(REGEXP_REPLACE(REPLACE("quantity", ' ', ''), '[^0-9]', '', 'g'), '')::INTEGER,
        "buyItNowPriceNum" = NULLIF(REGEXP_REPLACE(REPLACE(REPLACE("buyItNowPrice", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2),
        "bestOfferAutoAcceptPriceNum" = NULLIF(REGEXP_REPLACE(REPLACE(REPLACE("bestOfferAutoAcceptPrice", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2),
        "minimumBestOfferPriceNum" = NULLIF(REGEXP_REPLACE(REPLACE(REPLACE("minimumBestOfferPrice", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2),
        "shippingService1CostNum" = NULLIF(REGEXP_REPLACE(REPLACE(REPLACE("shippingService1Cost", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2),
        "shippingService2CostNum" = NULLIF(REGEXP_REPLACE(REPLACE(REPLACE("shippingService2Cost", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2)
      WHERE "startPriceNum" IS NULL
        AND ("startPrice" IS NOT NULL OR "quantity" IS NOT NULL OR "buyItNowPrice" IS NOT NULL)
    `);

    // ─── Step 3: Create indexes on new numeric columns ───
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_listing_start_price_num ON listing_records("startPriceNum")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_listing_quantity_num ON listing_records("quantityNum")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_listing_bin_price_num ON listing_records("buyItNowPriceNum")`);

    // ─── Step 4: Create a trigger to auto-sync TEXT → NUMERIC on INSERT/UPDATE ───
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_listing_numeric_prices()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."startPriceNum" := NULLIF(REGEXP_REPLACE(REPLACE(REPLACE(NEW."startPrice", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2);
        NEW."quantityNum" := NULLIF(REGEXP_REPLACE(REPLACE(NEW."quantity", ' ', ''), '[^0-9]', '', 'g'), '')::INTEGER;
        NEW."buyItNowPriceNum" := NULLIF(REGEXP_REPLACE(REPLACE(REPLACE(NEW."buyItNowPrice", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2);
        NEW."bestOfferAutoAcceptPriceNum" := NULLIF(REGEXP_REPLACE(REPLACE(REPLACE(NEW."bestOfferAutoAcceptPrice", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2);
        NEW."minimumBestOfferPriceNum" := NULLIF(REGEXP_REPLACE(REPLACE(REPLACE(NEW."minimumBestOfferPrice", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2);
        NEW."shippingService1CostNum" := NULLIF(REGEXP_REPLACE(REPLACE(REPLACE(NEW."shippingService1Cost", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2);
        NEW."shippingService2CostNum" := NULLIF(REGEXP_REPLACE(REPLACE(REPLACE(NEW."shippingService2Cost", ',', '.'), ' ', ''), '[^0-9.]', '', 'g'), '')::NUMERIC(12,2);
        RETURN NEW;
      EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_sync_listing_prices ON listing_records
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_sync_listing_prices
      BEFORE INSERT OR UPDATE ON listing_records
      FOR EACH ROW
      EXECUTE FUNCTION sync_listing_numeric_prices()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_sync_listing_prices ON listing_records`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_listing_numeric_prices()`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_listing_bin_price_num`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_listing_quantity_num`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_listing_start_price_num`);
    await queryRunner.query(`
      ALTER TABLE listing_records
        DROP COLUMN IF EXISTS "shippingService2CostNum",
        DROP COLUMN IF EXISTS "shippingService1CostNum",
        DROP COLUMN IF EXISTS "minimumBestOfferPriceNum",
        DROP COLUMN IF EXISTS "bestOfferAutoAcceptPriceNum",
        DROP COLUMN IF EXISTS "buyItNowPriceNum",
        DROP COLUMN IF EXISTS "quantityNum",
        DROP COLUMN IF EXISTS "startPriceNum"
    `);
  }
}
