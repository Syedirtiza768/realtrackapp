import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddListingRecordPipelineMarketplace1775710000001 implements MigrationInterface {
  name = 'AddListingRecordPipelineMarketplace1775710000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "listing_records"
      ADD COLUMN IF NOT EXISTS "pipeline_job_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "listing_records"
      ADD COLUMN IF NOT EXISTS "marketplace" varchar(3)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_listing_pipeline_job"
      ON "listing_records" ("pipeline_job_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_listing_marketplace"
      ON "listing_records" ("marketplace")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_pipeline_job"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_marketplace"`);
    await queryRunner.query(
      `ALTER TABLE "listing_records" DROP COLUMN IF EXISTS "pipeline_job_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listing_records" DROP COLUMN IF EXISTS "marketplace"`,
    );
  }
}
