import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiEnhancementConfidenceScore1775500000000 implements MigrationInterface {
  name = 'AddAiEnhancementConfidenceScore1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_enhancements"
      ADD COLUMN IF NOT EXISTS "confidence_score" real NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_enhancements"
      DROP COLUMN IF EXISTS "confidence_score"
    `);
  }
}
