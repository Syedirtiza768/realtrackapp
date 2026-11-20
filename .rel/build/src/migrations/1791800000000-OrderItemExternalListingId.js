"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderItemExternalListingId1791800000000 = void 0;
class OrderItemExternalListingId1791800000000 {
    name = 'OrderItemExternalListingId1791800000000';
    async up(q) {
        await q.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "external_listing_id" varchar(100)`);
        await q.query(`CREATE INDEX IF NOT EXISTS "idx_order_item_external_listing" ON "order_items" ("external_listing_id") WHERE "external_listing_id" IS NOT NULL`);
    }
    async down(q) {
        await q.query(`DROP INDEX IF EXISTS "idx_order_item_external_listing"`);
        await q.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "external_listing_id"`);
    }
}
exports.OrderItemExternalListingId1791800000000 = OrderItemExternalListingId1791800000000;
//# sourceMappingURL=1791800000000-OrderItemExternalListingId.js.map