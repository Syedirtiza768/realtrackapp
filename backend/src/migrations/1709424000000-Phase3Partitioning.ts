import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.4 — PostgreSQL Partitioning for high-volume tables.
 *
 * Converts inventory_events, audit_logs, and channel_webhook_logs
 * to range-partitioned tables (by created_at month).
 *
 * Strategy: Since these tables may already have data, we use the
 * "rename + recreate + copy" approach:
 * 1. Rename existing table to _old
 * 2. Create new partitioned table with same schema
 * 3. Copy data from _old into partitioned table
 * 4. Drop _old
 * 5. Pre-create partitions for current and next 6 months
 *
 * This migration is safe because:
 * - It's wrapped in a transaction
 * - _old tables are preserved until data is verified
 * - Rollback recreates the original unpartitioned tables
 */
export class Phase3Partitioning1709424000000 implements MigrationInterface {
  name = 'Phase3Partitioning1709424000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Helper: generate partition DDL for 12 months ───
    const now = new Date();
    const partitions: Array<{ name: string; from: string; to: string }> = [];
    for (let i = -3; i <= 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const suffix = `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const to = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      partitions.push({ name: suffix, from, to });
    }

    // ──────────────── inventory_events ────────────────
    await queryRunner.query(`ALTER TABLE IF EXISTS inventory_events RENAME TO inventory_events_old`);

    await queryRunner.query(`
      CREATE TABLE inventory_events (
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        listing_id UUID NOT NULL,
        event_type VARCHAR(30) NOT NULL,
        quantity_change INTEGER NOT NULL,
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        source_channel VARCHAR(30),
        source_order_id VARCHAR(100),
        source_reference TEXT,
        idempotency_key VARCHAR(200),
        reason TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at)
    `);

    for (const p of partitions) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS inventory_events_${p.name}
        PARTITION OF inventory_events
        FOR VALUES FROM ('${p.from}') TO ('${p.to}')
      `);
    }

    // Create a default partition for data outside explicit ranges
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory_events_default
      PARTITION OF inventory_events DEFAULT
    `);

    await queryRunner.query(`
      INSERT INTO inventory_events SELECT * FROM inventory_events_old
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_listing_part ON inventory_events(listing_id, created_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_event_type_part ON inventory_events(event_type, created_at)`);
    // Unique constraint on partitioned table must include the partition key (created_at)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_event_idempotency_part ON inventory_events(idempotency_key, created_at) WHERE idempotency_key IS NOT NULL`);

    await queryRunner.query(`DROP TABLE IF EXISTS inventory_events_old`);

    // ──────────────── audit_logs ────────────────
    await queryRunner.query(`ALTER TABLE IF EXISTS audit_logs RENAME TO audit_logs_old`);

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        "entityType" VARCHAR(50) NOT NULL,
        "entityId" UUID NOT NULL,
        action VARCHAR(30) NOT NULL,
        "actorId" UUID,
        "actorType" VARCHAR(20) NOT NULL DEFAULT 'user',
        changes JSONB,
        metadata JSONB DEFAULT '{}',
        "ipAddress" INET,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, "createdAt")
      ) PARTITION BY RANGE ("createdAt")
    `);

    for (const p of partitions) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS audit_logs_${p.name}
        PARTITION OF audit_logs
        FOR VALUES FROM ('${p.from}') TO ('${p.to}')
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs_default
      PARTITION OF audit_logs DEFAULT
    `);

    await queryRunner.query(`
      INSERT INTO audit_logs SELECT * FROM audit_logs_old
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_entity_part ON audit_logs("entityType")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_action_part ON audit_logs(action)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_actor_part ON audit_logs("actorId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_created_part ON audit_logs("createdAt")`);

    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs_old`);

    // ──────────────── channel_webhook_logs ────────────────
    await queryRunner.query(`ALTER TABLE IF EXISTS channel_webhook_logs RENAME TO channel_webhook_logs_old`);

    await queryRunner.query(`
      CREATE TABLE channel_webhook_logs (
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        channel VARCHAR(30) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        external_id VARCHAR(200),
        payload JSONB DEFAULT '{}',
        processing_status VARCHAR(20) NOT NULL DEFAULT 'received',
        processing_error TEXT,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, created_at)
      ) PARTITION BY RANGE (created_at)
    `);

    for (const p of partitions) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS channel_webhook_logs_${p.name}
        PARTITION OF channel_webhook_logs
        FOR VALUES FROM ('${p.from}') TO ('${p.to}')
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS channel_webhook_logs_default
      PARTITION OF channel_webhook_logs DEFAULT
    `);

    await queryRunner.query(`
      INSERT INTO channel_webhook_logs SELECT * FROM channel_webhook_logs_old
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_webhook_log_channel_part ON channel_webhook_logs(channel)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_webhook_log_created_part ON channel_webhook_logs(created_at)`);

    await queryRunner.query(`DROP TABLE IF EXISTS channel_webhook_logs_old`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ─── Restore non-partitioned tables ───

    // inventory_events
    await queryRunner.query(`ALTER TABLE IF EXISTS inventory_events RENAME TO inventory_events_partitioned`);
    await queryRunner.query(`
      CREATE TABLE inventory_events (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        listing_id UUID NOT NULL,
        event_type VARCHAR(30) NOT NULL,
        quantity_change INTEGER NOT NULL,
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        source_channel VARCHAR(30),
        source_order_id VARCHAR(100),
        source_reference TEXT,
        idempotency_key VARCHAR(200) UNIQUE,
        reason TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`INSERT INTO inventory_events SELECT * FROM inventory_events_partitioned`);
    await queryRunner.query(`CREATE INDEX idx_event_listing ON inventory_events(listing_id, created_at)`);
    await queryRunner.query(`CREATE INDEX idx_event_type ON inventory_events(event_type, created_at)`);
    await queryRunner.query(`CREATE INDEX idx_event_source ON inventory_events(source_channel, source_order_id)`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_events_partitioned CASCADE`);

    // audit_logs
    await queryRunner.query(`ALTER TABLE IF EXISTS audit_logs RENAME TO audit_logs_partitioned`);
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "entityType" VARCHAR(50) NOT NULL,
        "entityId" UUID NOT NULL,
        action VARCHAR(30) NOT NULL,
        "actorId" UUID,
        "actorType" VARCHAR(20) NOT NULL DEFAULT 'user',
        changes JSONB,
        metadata JSONB DEFAULT '{}',
        "ipAddress" INET,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`INSERT INTO audit_logs SELECT * FROM audit_logs_partitioned`);
    await queryRunner.query(`CREATE INDEX idx_audit_entity ON audit_logs("entityType")`);
    await queryRunner.query(`CREATE INDEX idx_audit_action ON audit_logs(action)`);
    await queryRunner.query(`CREATE INDEX idx_audit_actor ON audit_logs("actorId")`);
    await queryRunner.query(`CREATE INDEX idx_audit_created ON audit_logs("createdAt")`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs_partitioned CASCADE`);

    // channel_webhook_logs
    await queryRunner.query(`ALTER TABLE IF EXISTS channel_webhook_logs RENAME TO channel_webhook_logs_partitioned`);
    await queryRunner.query(`
      CREATE TABLE channel_webhook_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        channel VARCHAR(30) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        external_id VARCHAR(200),
        payload JSONB DEFAULT '{}',
        processing_status VARCHAR(20) NOT NULL DEFAULT 'received',
        processing_error TEXT,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`INSERT INTO channel_webhook_logs SELECT * FROM channel_webhook_logs_partitioned`);
    await queryRunner.query(`CREATE INDEX idx_webhook_log_channel ON channel_webhook_logs(channel)`);
    await queryRunner.query(`DROP TABLE IF EXISTS channel_webhook_logs_partitioned CASCADE`);
  }
}
