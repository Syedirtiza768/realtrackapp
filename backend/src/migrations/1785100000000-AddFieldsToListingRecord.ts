import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add `cMaterial`, `cPlacement`, `countryOfOrigin`, and `conditionLabel`
 * columns to `listing_records` for syncing catalog product fields.
 */
export class AddFieldsToListingRecord1785100000000 implements MigrationInterface {
  name = 'AddFieldsToListingRecord1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "cMaterial" TEXT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "cPlacement" TEXT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "country_of_origin" TEXT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "condition_label" TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "cMaterial"
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "cPlacement"
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "country_of_origin"
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "condition_label"
    `);
  }
}
