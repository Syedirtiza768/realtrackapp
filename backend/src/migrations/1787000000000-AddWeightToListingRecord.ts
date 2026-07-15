import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add optional `weight` (kg, NUMERIC(10,3)) column to `listing_records`
 * and `catalog_products` so warehouse-intake parts can capture part weight.
 */
export class AddWeightToListingRecord1787000000000 implements MigrationInterface {
  name = 'AddWeightToListingRecord1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "weight" NUMERIC(10,3) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE catalog_products
      ADD COLUMN "weight" NUMERIC(10,3) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "weight"
    `);

    await queryRunner.query(`
      ALTER TABLE catalog_products
      DROP COLUMN IF EXISTS "weight"
    `);
  }
}
