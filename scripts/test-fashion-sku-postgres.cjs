// Run against a disposable PostgreSQL database only: this creates minimal test tables.
const assert = require('node:assert/strict');
const { DataSource } = require('../backend/node_modules/typeorm');
const { FashionIntakeService } = require('../backend/dist/src/verticals/fashion-intake.service.js');
async function main() {
  if (!process.env.FASHION_TEST_DATABASE_URL) throw new Error('Set FASHION_TEST_DATABASE_URL to a disposable database.');
  const db = new DataSource({ type: 'postgres', url: process.env.FASHION_TEST_DATABASE_URL, extra: { max: 12 } });
  await db.initialize();
  try {
    await db.query('CREATE TABLE IF NOT EXISTS catalog_products (sku text PRIMARY KEY)');
    await db.query('CREATE TABLE IF NOT EXISTS fashion_sku_counters (organization_id text, batch text, last_value integer, updated_at timestamptz DEFAULT now(), PRIMARY KEY (organization_id, batch))');
    const prefix = 'TEST' + Date.now();
    await db.query('INSERT INTO catalog_products (sku) VALUES ($1)', [`${prefix}-12969-XL`]);
    const service = new FashionIntakeService(db, {}, {}, {}, {});
    const first = await service.reserveNumber('organization-a', prefix);
    assert.equal(first, 12970, 'Seed from the existing catalog');
    const allocated = await Promise.all(Array.from({ length: 30 }, (_, i) => service.reserveNumber(`organization-${i % 3}`, prefix)));
    assert.equal(new Set(allocated).size, 30, 'Reservations across organizations must be unique');
    assert.deepEqual(allocated.sort((a, b) => a - b), Array.from({ length: 30 }, (_, i) => 12971 + i));
    console.log('PASS PostgreSQL: existing AVP-style seed, 30 concurrent reservations across 3 organizations');
  } finally { await db.destroy(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
