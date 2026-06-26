import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drop the single-column unique index on customLabelSku and replace it with
 * a composite unique index on (customLabelSku, marketplace) so that the same
 * SKU can have separate listing records for US, AU, and DE marketplaces.
 *
 * Run AFTER pipeline products have been re-processed / backfilled so existing
 * single-marketplace rows are not affected (they each get a null or a single
 * marketplace value, keeping the combo unique).
 */
export class ListingSkuMarketplaceUniqueIndex1783000000000 implements MigrationInterface {
  name = 'ListingSkuMarketplaceUniqueIndex1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old single-column unique index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_sku_unique_active"
    `);

    // Create new composite unique index on (customLabelSku, marketplace)
    // Only covers active (non-deleted) records with both columns non-null.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_listing_sku_marketplace_unique_active"
      ON listing_records ("customLabelSku", "marketplace")
      WHERE "customLabelSku" IS NOT NULL
        AND "deletedAt" IS NULL
        AND "marketplace" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_sku_marketplace_unique_active"
    `);

    // Re-create the old single-column index
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_listing_sku_unique_active"
      ON listing_records ("customLabelSku")
      WHERE "customLabelSku" IS NOT NULL AND "deletedAt" IS NULL
    `);
  }
}
