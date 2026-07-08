import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforce one active listing row per customLabelSku (soft-deleted rows excluded).
 * Renames duplicate SKUs before creating the index (keeps oldest row per SKU).
 */
export class ListingSkuUniqueIndex1782000000000 implements MigrationInterface {
  name = 'ListingSkuUniqueIndex1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "customLabelSku"
            ORDER BY "importedAt" ASC, id ASC
          ) AS rn
        FROM listing_records
        WHERE "customLabelSku" IS NOT NULL
          AND "deletedAt" IS NULL
      )
      UPDATE listing_records lr
      SET "customLabelSku" = lr."customLabelSku" || '-dup-' || substr(lr.id::text, 1, 8)
      FROM ranked r
      WHERE lr.id = r.id AND r.rn > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_listing_sku_unique_active"
      ON listing_records ("customLabelSku")
      WHERE "customLabelSku" IS NOT NULL AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_listing_sku_unique_active"`,
    );
  }
}
