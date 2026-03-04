import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — Automation Rules + Listing Templates tables.
 * Additive only: creates new tables and indexes. No existing data modified.
 */
export class Phase2AutomationAndTemplates1709164800000 implements MigrationInterface {
  name = 'Phase2AutomationAndTemplates1709164800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Automation Rules ───
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS automation_rules (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "name" VARCHAR(200) NOT NULL,
        description TEXT,
        "triggerType" VARCHAR(50) NOT NULL,
        "triggerConfig" JSONB NOT NULL DEFAULT '{}',
        "actionType" VARCHAR(50) NOT NULL,
        "actionConfig" JSONB NOT NULL DEFAULT '{}',
        conditions JSONB DEFAULT '[]',
        enabled BOOLEAN NOT NULL DEFAULT false,
        priority INTEGER NOT NULL DEFAULT 0,
        "lastExecutedAt" TIMESTAMPTZ,
        "executionCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auto_rules_trigger
      ON automation_rules ("triggerType", enabled)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auto_rules_enabled
      ON automation_rules (enabled) WHERE enabled = true
    `);

    // ─── Listing Templates ───
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS listing_templates (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "name" VARCHAR(200) NOT NULL,
        description TEXT,
        channel VARCHAR(30),
        category VARCHAR(100),
        "templateType" VARCHAR(30) NOT NULL DEFAULT 'description',
        content TEXT NOT NULL,
        css TEXT,
        "previewImage" TEXT,
        variables JSONB DEFAULT '[]',
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        active BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_template_channel
      ON listing_templates (channel, active)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_template_type
      ON listing_templates ("templateType")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_template_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_template_channel`);
    await queryRunner.query(`DROP TABLE IF EXISTS listing_templates`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_auto_rules_enabled`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_auto_rules_trigger`);
    await queryRunner.query(`DROP TABLE IF EXISTS automation_rules`);
  }
}
