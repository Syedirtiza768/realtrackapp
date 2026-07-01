import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add `enrichmentStage` column to `listing_records` for tracking inline
 * enrichment progress (vision_lookup → category_mapping → enrichment →
 * generating_us → generating_au → generating_de → completed / failed).
 */
export class AddEnrichmentStageToListingRecords1784000000000 implements MigrationInterface {
  name = 'AddEnrichmentStageToListingRecords1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "enrichmentStage" VARCHAR(50) NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_listing_enrichment_stage"
      ON listing_records ("enrichmentStage")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_enrichment_stage"
    `);

    await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "enrichmentStage"
    `);
  }
}
