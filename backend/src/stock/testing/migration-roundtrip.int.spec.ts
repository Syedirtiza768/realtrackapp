import { DataSource } from 'typeorm';
import { CreateWarehouseInventory1791100000000 } from '../../migrations/1791100000000-CreateWarehouseInventory.js';

const url = process.env.STOCK_SCHEMA_DATABASE_URL;
const describeIt = url ? describe : describe.skip;

/** Runs the migration up → down → up against a restored copy of the real schema. */
describeIt('CreateWarehouseInventory migration round-trip', () => {
  it('applies, reverts and re-applies cleanly', async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const qr = ds.createQueryRunner();
    const m = new CreateWarehouseInventory1791100000000();
    try {
      await m.up(qr);
      await m.up(qr); // idempotent (IF NOT EXISTS everywhere)
      await m.down(qr);
      await m.up(qr);
      const [{ n }] = await ds.query(
        `SELECT count(*)::int n FROM information_schema.tables WHERE table_schema = 'public'
          AND table_name IN ('warehouses','warehouse_locations','suppliers','inventory_items','inventory_item_sources','stock_levels',
            'inventory_units','stock_documents','stock_document_lines','stock_movements','stock_reservations','procurement_requests',
            'store_warehouse_links','store_stock_policies','channel_stock_sync_state','user_warehouse_assignments')`,
      );
      expect(n).toBe(16);
    } finally {
      await qr.release();
      await ds.destroy();
    }
  }, 60_000);
});
