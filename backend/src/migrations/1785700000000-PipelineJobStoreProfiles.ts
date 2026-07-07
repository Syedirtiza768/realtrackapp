import { MigrationInterface, QueryRunner } from 'typeorm';

export class PipelineJobStoreProfiles1785700000000 implements MigrationInterface {
  name = 'PipelineJobStoreProfiles1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        ADD COLUMN IF NOT EXISTS "marketplace" varchar(3),
        ADD COLUMN IF NOT EXISTS "store_id" uuid,
        ADD COLUMN IF NOT EXISTS "shipping_profile_name" varchar(255),
        ADD COLUMN IF NOT EXISTS "return_profile_name" varchar(255),
        ADD COLUMN IF NOT EXISTS "payment_profile_name" varchar(255),
        ADD COLUMN IF NOT EXISTS "fulfillment_policy_id" varchar(64),
        ADD COLUMN IF NOT EXISTS "payment_policy_id" varchar(64),
        ADD COLUMN IF NOT EXISTS "return_policy_id" varchar(64)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pipeline_job_store"
        ON "pipeline_jobs" ("store_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pipeline_job_marketplace"
        ON "pipeline_jobs" ("marketplace")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pipeline_job_marketplace"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pipeline_job_store"`);
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        DROP COLUMN IF EXISTS "return_policy_id",
        DROP COLUMN IF EXISTS "payment_policy_id",
        DROP COLUMN IF EXISTS "fulfillment_policy_id",
        DROP COLUMN IF EXISTS "payment_profile_name",
        DROP COLUMN IF EXISTS "return_profile_name",
        DROP COLUMN IF EXISTS "shipping_profile_name",
        DROP COLUMN IF EXISTS "store_id",
        DROP COLUMN IF EXISTS "marketplace"
    `);
  }
}
