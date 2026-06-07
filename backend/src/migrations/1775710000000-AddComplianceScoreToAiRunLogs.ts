import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComplianceScoreToAiRunLogs1775710000000
  implements MigrationInterface
{
  name = 'AddComplianceScoreToAiRunLogs1775710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_run_logs"
      ADD COLUMN IF NOT EXISTS "compliance_score" numeric(5,4) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_run_logs"
      DROP COLUMN IF EXISTS "compliance_score"
    `);
  }
}
