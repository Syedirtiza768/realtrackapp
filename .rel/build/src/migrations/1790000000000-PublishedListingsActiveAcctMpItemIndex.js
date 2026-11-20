"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsActiveAcctMpItemIndex1790000000000 = void 0;
class PublishedListingsActiveAcctMpItemIndex1790000000000 {
    name = 'PublishedListingsActiveAcctMpItemIndex1790000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_epl_active_acct_mp_item
      ON ebay_published_listings (ebay_account_id, marketplace_id, ebay_item_id)
      WHERE listing_status = 'active'
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_epl_active_acct_mp_item`);
    }
}
exports.PublishedListingsActiveAcctMpItemIndex1790000000000 = PublishedListingsActiveAcctMpItemIndex1790000000000;
//# sourceMappingURL=1790000000000-PublishedListingsActiveAcctMpItemIndex.js.map