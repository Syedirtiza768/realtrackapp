"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_IT_URL = void 0;
exports.createStockTestDb = createStockTestDb;
exports.seedBasics = seedBasics;
const crypto_1 = require("crypto");
const typeorm_1 = require("typeorm");
const index_js_1 = require("../entities/index.js");
const _1791100000000_CreateWarehouseInventory_js_1 = require("../../migrations/1791100000000-CreateWarehouseInventory.js");
exports.STOCK_IT_URL = process.env.STOCK_IT_DATABASE_URL;
async function createStockTestDb(additionalEntities = []) {
    const schema = `stock_it_${(0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 12)}`;
    const admin = new typeorm_1.DataSource({ type: 'postgres', url: exports.STOCK_IT_URL });
    await admin.initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.destroy();
    const ds = new typeorm_1.DataSource({
        type: 'postgres',
        url: exports.STOCK_IT_URL,
        schema,
        entities: [...index_js_1.STOCK_ENTITIES, ...additionalEntities],
        extra: { max: 20, options: `-c search_path=${schema},public` },
    });
    await ds.initialize();
    await ds.query(`
    CREATE TABLE organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
    CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
    CREATE TABLE catalog_products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text, quantity int, organization_id uuid);
    CREATE TABLE listing_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "customLabelSku" text, quantity text, "quantityNum" int, organization_id uuid);
    CREATE TABLE product_variants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text, quantity int NOT NULL DEFAULT 0);
    CREATE TABLE stores (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, channel text DEFAULT 'ebay', store_name text DEFAULT 'Store', status text DEFAULT 'active');
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid, channel text DEFAULT 'ebay', status text DEFAULT 'pending',
      external_order_id text, buyer_username text, shipping_name text, shipping_country text, ordered_at timestamptz DEFAULT now());
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, listing_id uuid, external_item_id text,
      external_listing_id text, sku text, title text DEFAULT 'Item', quantity int, created_at timestamptz DEFAULT now());
    CREATE TABLE organization_members (user_id uuid, organization_id uuid);
    CREATE TABLE ebay_published_listings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, store_id uuid, sku text, catalog_product_id uuid,
      offer_id text, ebay_item_id text, marketplace_id text DEFAULT 'EBAY_US', listing_status text DEFAULT 'active',
      quantity_available int DEFAULT 0, updated_at timestamptz DEFAULT now());
    CREATE TABLE listing_channel_instances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid, connection_id uuid, store_id uuid,
      channel text, override_quantity int, sync_status text DEFAULT 'synced');
  `);
    const qr = ds.createQueryRunner();
    await new _1791100000000_CreateWarehouseInventory_js_1.CreateWarehouseInventory1791100000000().up(qr);
    await qr.release();
    return {
        ds,
        schema,
        close: async () => {
            await ds.destroy();
            const cleanup = new typeorm_1.DataSource({ type: 'postgres', url: exports.STOCK_IT_URL });
            await cleanup.initialize();
            await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`);
            await cleanup.destroy();
        },
    };
}
async function seedBasics(ds) {
    const [{ id: orgId }] = await ds.query(`INSERT INTO organizations (name) VALUES ('Test org') RETURNING id`);
    const [{ id: warehouseId }] = await ds.query(`INSERT INTO warehouses (organization_id, code, name, is_default) VALUES ($1, 'MAIN', 'Main', true) RETURNING id`, [orgId]);
    const [{ id: locationId }] = await ds.query(`INSERT INTO warehouse_locations (organization_id, warehouse_id, code) VALUES ($1, $2, 'A-01') RETURNING id`, [orgId, warehouseId]);
    const [{ id: catalogProductId }] = await ds.query(`INSERT INTO catalog_products (sku, quantity, organization_id) VALUES ('SKU-1', 0, $1) RETURNING id`, [orgId]);
    const [{ id: itemId }] = await ds.query(`INSERT INTO inventory_items (organization_id, sku, catalog_product_id) VALUES ($1, 'SKU-1', $2) RETURNING id`, [orgId, catalogProductId]);
    return { orgId, warehouseId, locationId, itemId, catalogProductId };
}
//# sourceMappingURL=stock-test-db.js.map