import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { StockLedgerService } from './stock-ledger.service.js';
import { StockAccessService } from './stock-access.service.js';
import { WarehousesService } from './warehouses.service.js';
import { StockSetupService } from './stock-setup.service.js';
import { createStockTestDb, STOCK_IT_URL } from './testing/stock-test-db.js';

const describeIt = STOCK_IT_URL ? describe : describe.skip;

describeIt('StockSetupService.bootstrap (PostgreSQL integration)', () => {
  let ds: DataSource;
  let close: () => Promise<void>;
  let setup: StockSetupService;

  beforeAll(async () => {
    ({ ds, close } = await createStockTestDb());
    // Extra columns the backfill reads from existing product tables.
    await ds.query(`
      ALTER TABLE catalog_products ADD COLUMN title text, ADD COLUMN vertical text, ADD COLUMN vertical_attributes jsonb DEFAULT '{}',
        ADD COLUMN image_urls text[] DEFAULT '{}';
      ALTER TABLE listing_records ADD COLUMN title text, ADD COLUMN "itemPhotoUrl" text, ADD COLUMN "deletedAt" timestamptz,
        ADD COLUMN "updatedAt" timestamptz DEFAULT now(), ADD COLUMN status text DEFAULT 'draft';
      ALTER TABLE product_variants ADD COLUMN organization_id uuid, ADD COLUMN vertical text, ADD COLUMN active boolean DEFAULT true,
        ADD COLUMN catalog_product_id uuid, ADD COLUMN updated_at timestamptz DEFAULT now();
      ALTER TABLE stores ADD COLUMN location_key text, ADD COLUMN is_primary boolean DEFAULT false, ADD COLUMN created_at timestamptz DEFAULT now();
      CREATE TABLE fashion_warehouses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, code text, name text, country_code text, active boolean DEFAULT true);
      CREATE TABLE business_industrial_units (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, catalog_product_id uuid,
        serial_number_private text, serial_number_public text, status text, created_at timestamptz DEFAULT now());
    `);
    const events = new EventEmitter2();
    const ledger = new StockLedgerService(ds, events);
    const access = new StockAccessService(ds, {} as never);
    setup = new StockSetupService(ds, ledger, new WarehousesService(ds, access, ledger));
  }, 60_000);
  afterAll(async () => close?.());

  it('dry-runs without writing, then seeds items, units, opening balances and store links idempotently', async () => {
    const [{ id: org }] = await ds.query(`INSERT INTO organizations (name) VALUES ('Shop') RETURNING id`);
    const scope = { organizationId: org, userId: null, warehouseIds: null };
    await ds.query(`INSERT INTO fashion_warehouses (organization_id, code, name, country_code) VALUES ($1, 'PAK_KHI', 'Karachi', 'PK')`, [org]);
    await ds.query(`INSERT INTO stores (organization_id, channel, location_key) VALUES ($1, 'ebay', 'AE_Dubai')`, [org]);
    const [{ id: cp }] = await ds.query(
      `INSERT INTO catalog_products (sku, quantity, organization_id, title, image_urls) VALUES ('BRK-1', 4, $1, 'Brake pad', ARRAY['https://x/a.jpg']) RETURNING id`,
      [org],
    );
    // Same SKU on a listing record: linked to the same item, not duplicated.
    await ds.query(`INSERT INTO listing_records ("customLabelSku", "quantityNum", organization_id, title) VALUES ('BRK-1', 4, $1, 'Brake pad')`, [org]);
    await ds.query(`INSERT INTO listing_records ("customLabelSku", "quantityNum", organization_id) VALUES ('MIRROR-9', 1, $1)`, [org]);
    const [{ id: bi }] = await ds.query(
      `INSERT INTO catalog_products (sku, quantity, organization_id, vertical, vertical_attributes) VALUES ('PUMP-1', 2, $1, 'business_industrial', '{"inventoryMode":"serialized"}') RETURNING id`,
      [org],
    );
    await ds.query(
      `INSERT INTO business_industrial_units (organization_id, catalog_product_id, serial_number_private, status)
       VALUES ($1,$2,'SN-1','available'), ($1,$2,'SN-2','sold'), ($1,$2,'SN-3','quarantined')`,
      [org, bi],
    );

    const dry = await setup.bootstrap(scope, { dryRun: true });
    expect(dry.items.total).toBe(3);
    expect((await ds.query(`SELECT count(*)::int n FROM inventory_items WHERE organization_id = $1`, [org]))[0].n).toBe(0);

    const report = await setup.bootstrap(scope, { dryRun: false });
    expect(report).toMatchObject({
      dryRun: false,
      warehousesFromFashion: 1,
      items: { fromCatalog: 2, fromListings: 1, total: 3 },
      serialUnitsImported: 3,
      storesLinked: 1,
    });
    const items = await ds.query(
      `SELECT i.sku, i.tracking_mode, i.catalog_product_id IS NOT NULL has_cp, i.listing_record_id IS NOT NULL has_lr,
              COALESCE(SUM(sl.on_hand),0)::int on_hand, COALESCE(SUM(sl.damaged),0)::int damaged
         FROM inventory_items i LEFT JOIN stock_levels sl ON sl.inventory_item_id = i.id
        WHERE i.organization_id = $1 GROUP BY i.id ORDER BY i.sku`,
      [org],
    );
    expect(items).toEqual([
      { sku: 'BRK-1', tracking_mode: 'quantity', has_cp: true, has_lr: true, on_hand: 4, damaged: 0 },
      { sku: 'MIRROR-9', tracking_mode: 'quantity', has_cp: false, has_lr: true, on_hand: 1, damaged: 0 },
      { sku: 'PUMP-1', tracking_mode: 'serial', has_cp: true, has_lr: false, on_hand: 2, damaged: 1 },
    ]);
    const [def] = await ds.query(`SELECT code, ebay_merchant_location_key FROM warehouses WHERE organization_id = $1 AND is_default`, [org]);
    expect(def).toEqual({ code: 'PAK_KHI', ebay_merchant_location_key: 'AE_Dubai' });
    expect((await ds.query(`SELECT quantity FROM catalog_products WHERE id = $1`, [cp]))[0].quantity).toBe(4);

    const again = await setup.bootstrap(scope, { dryRun: false });
    expect(again.items).toMatchObject({ fromCatalog: 0, fromListings: 0, total: 3 });
    expect(again.serialUnitsImported).toBe(0);
    expect(again.openingBalances.items).toBe(0);
    const [{ n }] = await ds.query(`SELECT COALESCE(SUM(on_hand),0)::int n FROM stock_levels WHERE organization_id = $1`, [org]);
    expect(n).toBe(7);
  });
});
