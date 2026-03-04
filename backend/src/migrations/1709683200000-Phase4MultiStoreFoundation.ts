import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 — Multi-Store Foundation
 *
 * Adds nullable store_id FK to: orders, inventory_events, automation_rules,
 * pricing_rules, sales_records.
 *
 * Creates store_inventory_allocations table for opt-in per-store stock.
 *
 * Seeds feature flags: store_aware_publish, per_store_inventory.
 *
 * All columns are nullable → fully backward-compatible. Existing rows
 * keep store_id = NULL meaning "all stores / unresolved".
 *
 * ROLLBACK: down() drops the new columns, table, and feature flags.
 */
export class Phase4MultiStoreFoundation1709683200000 implements MigrationInterface {
  name = 'Phase4MultiStoreFoundation1709683200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. orders.store_id ───
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_order_store ON orders(store_id)
        WHERE store_id IS NOT NULL
    `);

    // ─── 2. inventory_events.store_id ───
    await queryRunner.query(`
      ALTER TABLE inventory_events
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inv_event_store ON inventory_events(store_id)
        WHERE store_id IS NOT NULL
    `);

    // ─── 3. automation_rules.store_id + channel ───
    await queryRunner.query(`
      ALTER TABLE automation_rules
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE automation_rules
        ADD COLUMN IF NOT EXISTS channel VARCHAR(30) NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auto_rule_store ON automation_rules(store_id)
        WHERE store_id IS NOT NULL
    `);

    // ─── 4. pricing_rules.store_id ───
    await queryRunner.query(`
      ALTER TABLE pricing_rules
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_rule_store ON pricing_rules(store_id)
        WHERE store_id IS NOT NULL
    `);

    // ─── 5. sales_records.store_id ───
    await queryRunner.query(`
      ALTER TABLE sales_records
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_store ON sales_records(store_id)
        WHERE store_id IS NOT NULL
    `);

    // ─── 6. store_inventory_allocations (per-store stock) ───
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS store_inventory_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id UUID NOT NULL REFERENCES listing_records(id) ON DELETE CASCADE,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        allocated_qty INTEGER NOT NULL DEFAULT 0,
        reserved_qty INTEGER NOT NULL DEFAULT 0,
        available_qty INTEGER GENERATED ALWAYS AS (allocated_qty - reserved_qty) STORED,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        version INTEGER NOT NULL DEFAULT 1,
        UNIQUE (listing_id, store_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sia_listing ON store_inventory_allocations(listing_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sia_store ON store_inventory_allocations(store_id)
    `);

    // ─── 7. Feature flags ───
    await queryRunner.query(`
      INSERT INTO feature_flags (id, key, enabled, description, metadata, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'store_aware_publish', false,
         'When ON, PublishModal uses store selection and the unified publish path', '{}', NOW(), NOW()),
        (gen_random_uuid(), 'per_store_inventory', false,
         'When ON, enables per-store inventory allocation instead of shared pool', '{}', NOW(), NOW())
      ON CONFLICT (key) DO NOTHING
    `);

    // ─── 8. channel_webhook_logs.store_id (for webhook → store resolution) ───
    await queryRunner.query(`
      ALTER TABLE channel_webhook_logs
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order
    await queryRunner.query(`ALTER TABLE channel_webhook_logs DROP COLUMN IF EXISTS store_id`);
    await queryRunner.query(`DELETE FROM feature_flags WHERE key IN ('store_aware_publish', 'per_store_inventory')`);
    await queryRunner.query(`DROP TABLE IF EXISTS store_inventory_allocations`);
    await queryRunner.query(`ALTER TABLE sales_records DROP COLUMN IF EXISTS store_id`);
    await queryRunner.query(`ALTER TABLE pricing_rules DROP COLUMN IF EXISTS store_id`);
    await queryRunner.query(`ALTER TABLE automation_rules DROP COLUMN IF EXISTS channel`);
    await queryRunner.query(`ALTER TABLE automation_rules DROP COLUMN IF EXISTS store_id`);
    await queryRunner.query(`ALTER TABLE inventory_events DROP COLUMN IF EXISTS store_id`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS store_id`);
  }
}
