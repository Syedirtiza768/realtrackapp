"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Phase3MultiTenant1709596800000 = void 0;
class Phase3MultiTenant1709596800000 {
    name = 'Phase3MultiTenant1709596800000';
    async up(queryRunner) {
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
    async down(queryRunner) {
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
exports.Phase3MultiTenant1709596800000 = Phase3MultiTenant1709596800000;
//# sourceMappingURL=1709596800000-Phase3MultiTenant.js.map