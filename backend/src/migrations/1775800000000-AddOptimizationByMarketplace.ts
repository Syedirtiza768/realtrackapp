import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOptimizationByMarketplace1775800000000 implements MigrationInterface {
  name = 'AddOptimizationByMarketplace1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
      ADD COLUMN IF NOT EXISTS "optimization_by_marketplace" jsonb NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
      DROP COLUMN IF EXISTS "optimization_by_marketplace"
    `);
  }
}
