import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the `sourceFileName === 'warehouse-intake'` sentinel string
 * (used everywhere as a stand-in for "did this part come from the Add Part
 * form or the pipeline?") with a real, explicit `origin` column.
 *
 * `sourceFileName`/`sourceFilePath` are left untouched — they still back
 * the `uq_listing_source_row` unique constraint, the warehouse-intake row
 * sequence, and real pipeline filename lineage. This is purely additive.
 */
export class AddOriginToListingRecords1789200000000
  implements MigrationInterface
{
  name = 'AddOriginToListingRecords1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "origin" VARCHAR(20) NULL
    `);

    await queryRunner.query(`
      UPDATE listing_records
      SET "origin" = CASE
        WHEN "sourceFileName" = 'warehouse-intake' THEN 'add_part'
        ELSE 'pipeline_import'
      END
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      ALTER COLUMN "origin" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      ADD CONSTRAINT "chk_listing_origin"
      CHECK ("origin" IN ('add_part', 'pipeline_import'))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_listing_origin"
      ON listing_records ("origin")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_origin"
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      DROP CONSTRAINT IF EXISTS "chk_listing_origin"
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "origin"
    `);
  }
}
