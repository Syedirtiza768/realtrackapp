import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tracks whether a catalog product's images have been queued for responsive
 * variant generation (_thumb/_sm/_medium/_lg). Catalog-imported images have
 * no image_assets row (see mirrorRemoteImages), so the existing
 * s3_key_medium-based backfill tracking doesn't cover them — this is the
 * equivalent marker for the backfill-catalog-variants endpoint.
 */
export class AddImagesVariantsGeneratedAtToCatalogProducts1789700000000 implements MigrationInterface {
  name = 'AddImagesVariantsGeneratedAtToCatalogProducts1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "catalog_products"
        ADD COLUMN IF NOT EXISTS "images_variants_generated_at" timestamptz
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_catalog_products_variants_pending"
        ON "catalog_products" ("id")
        WHERE "images_variants_generated_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_catalog_products_variants_pending"
    `);
    await queryRunner.query(`
      ALTER TABLE "catalog_products"
        DROP COLUMN IF EXISTS "images_variants_generated_at"
    `);
  }
}
