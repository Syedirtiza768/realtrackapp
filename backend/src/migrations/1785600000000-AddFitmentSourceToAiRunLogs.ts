import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFitmentSourceToAiRunLogs1785600000000
  implements MigrationInterface
{
  name = 'AddFitmentSourceToAiRunLogs1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_run_logs"
        ADD COLUMN IF NOT EXISTS "fitment_source" varchar(20),
        ADD COLUMN IF NOT EXISTS "fitment_rows_pre" integer,
        ADD COLUMN IF NOT EXISTS "fitment_rows_post" integer,
        ADD COLUMN IF NOT EXISTS "tokens_saved_estimate" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_run_logs"
        DROP COLUMN IF EXISTS "fitment_source",
        DROP COLUMN IF EXISTS "fitment_rows_pre",
        DROP COLUMN IF EXISTS "fitment_rows_post",
        DROP COLUMN IF EXISTS "tokens_saved_estimate"
    `);
  }
}
