import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTitleVerificationToPipelineJobs1786000000000
  implements MigrationInterface
{
  name = 'AddTitleVerificationToPipelineJobs1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
      ADD COLUMN IF NOT EXISTS "title_verification_status" varchar(32) NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "title_verification_processed" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "title_verification_total" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "title_verification_flagged_count" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "title_verification_cost_usd" numeric(8,4) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
      DROP COLUMN IF EXISTS "title_verification_status",
      DROP COLUMN IF EXISTS "title_verification_processed",
      DROP COLUMN IF EXISTS "title_verification_total",
      DROP COLUMN IF EXISTS "title_verification_flagged_count",
      DROP COLUMN IF EXISTS "title_verification_cost_usd"
    `);
  }
}
