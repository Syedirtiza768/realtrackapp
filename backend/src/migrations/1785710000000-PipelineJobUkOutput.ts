import { MigrationInterface, QueryRunner } from 'typeorm';

export class PipelineJobUkOutput1785710000000 implements MigrationInterface {
  name = 'PipelineJobUkOutput1785710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        ADD COLUMN IF NOT EXISTS "output_uk_path" varchar(1000)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        DROP COLUMN IF EXISTS "output_uk_path"
    `);
  }
}
