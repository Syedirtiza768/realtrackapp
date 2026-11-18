import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * order_items.external_listing_id — the channel listing number a line sold from
 * (eBay item number, a.k.a. legacyItemId). external_item_id keeps eBay's
 * lineItemId because shipping fulfillment sends it back to eBay.
 *
 * Lets a sale be joined to ebay_published_listings.ebay_item_id and lets stock
 * allocation match a line whose SKU is missing or differs from ours.
 * Existing rows stay NULL (eBay's item number was never stored for them).
 */
export class OrderItemExternalListingId1791800000000 implements MigrationInterface {
  name = 'OrderItemExternalListingId1791800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "external_listing_id" varchar(100)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_order_item_external_listing" ON "order_items" ("external_listing_id") WHERE "external_listing_id" IS NOT NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_order_item_external_listing"`);
    await q.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "external_listing_id"`,
    );
  }
}
