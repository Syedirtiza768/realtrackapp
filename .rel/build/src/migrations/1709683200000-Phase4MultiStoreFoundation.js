"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Phase4MultiStoreFoundation1709683200000 = void 0;
class Phase4MultiStoreFoundation1709683200000 {
    name = 'Phase4MultiStoreFoundation1709683200000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_order_store ON orders(store_id)
        WHERE store_id IS NOT NULL
    `);
        await queryRunner.query(`
      ALTER TABLE inventory_events
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inv_event_store ON inventory_events(store_id)
        WHERE store_id IS NOT NULL
    `);
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
        await queryRunner.query(`
      ALTER TABLE pricing_rules
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_rule_store ON pricing_rules(store_id)
        WHERE store_id IS NOT NULL
    `);
        await queryRunner.query(`
      ALTER TABLE sales_records
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_store ON sales_records(store_id)
        WHERE store_id IS NOT NULL
    `);
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
        await queryRunner.query(`
      INSERT INTO feature_flags (id, key, enabled, description, metadata, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'store_aware_publish', false,
         'When ON, PublishModal uses store selection and the unified publish path', '{}', NOW(), NOW()),
        (gen_random_uuid(), 'per_store_inventory', false,
         'When ON, enables per-store inventory allocation instead of shared pool', '{}', NOW(), NOW())
      ON CONFLICT (key) DO NOTHING
    `);
        await queryRunner.query(`
      ALTER TABLE channel_webhook_logs
        ADD COLUMN IF NOT EXISTS store_id UUID NULL
          REFERENCES stores(id) ON DELETE SET NULL
    `);
    }
    async down(queryRunner) {
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
exports.Phase4MultiStoreFoundation1709683200000 = Phase4MultiStoreFoundation1709683200000;
//# sourceMappingURL=1709683200000-Phase4MultiStoreFoundation.js.map