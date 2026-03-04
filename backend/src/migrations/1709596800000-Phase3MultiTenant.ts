import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.7 – Multi-Tenant Organization Model
 *
 * Creates:
 *  - organizations table
 *  - organization_members join table (user ⇔ org with role)
 *  - Nullable organization_id FK on: listing_records, channel_connections, stores,
 *    orders, tenant_settings, automation_rules, listing_templates, ingestion_jobs
 *
 * All FKs are nullable so existing single-tenant data continues to work.
 * Feature flag 'multi_tenant' starts OFF.
 *
 * Once turned on, an org-scoping middleware/guard filters all queries.
 */
export class Phase3MultiTenant1709596800000 implements MigrationInterface {
  name = 'Phase3MultiTenant1709596800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. organizations table ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(200) NOT NULL,
        slug        VARCHAR(100) NOT NULL UNIQUE,
        plan        VARCHAR(30)  NOT NULL DEFAULT 'free',
        listing_limit   INT,
        connection_limit INT,
        member_limit    INT,
        status      VARCHAR(20) NOT NULL DEFAULT 'active',
        settings    JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // ── 2. organization_members join table ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role            VARCHAR(20) NOT NULL DEFAULT 'editor',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_org_member UNIQUE (organization_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_org_member_user ON organization_members(user_id);
    `);

    // ── 3. Nullable organization_id FK on core tables ──
    const tables = [
      'listing_records',
      'channel_connections',
      'stores',
      'orders',
      'tenant_settings',
      'automation_rules',
      'listing_templates',
      'ingestion_jobs',
    ];

    for (const table of tables) {
      const exists = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '${table}' AND column_name = 'organization_id'
      `);
      if (exists.length === 0) {
        await queryRunner.query(`
          ALTER TABLE ${table}
          ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_${table}_org ON ${table}(organization_id);
        `);
      }
    }

    // ── 4. Seed feature flag (off by default) ──
    await queryRunner.query(`
      INSERT INTO feature_flags (id, key, enabled, description, metadata, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'multi_tenant',
        false,
        'Enable multi-tenant organization isolation. When OFF, all data is globally visible.',
        '{"phase": "3.7"}',
        now(),
        now()
      )
      ON CONFLICT (key) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'listing_records',
      'channel_connections',
      'stores',
      'orders',
      'tenant_settings',
      'automation_rules',
      'listing_templates',
      'ingestion_jobs',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP INDEX IF EXISTS idx_${table}_org;`);
      await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS organization_id;`);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS organization_members;`);
    await queryRunner.query(`DROP TABLE IF EXISTS organizations;`);
    await queryRunner.query(`DELETE FROM feature_flags WHERE key = 'multi_tenant';`);
  }
}
