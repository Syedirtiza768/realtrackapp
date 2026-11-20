"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSkuSequence1785200000000 = void 0;
class CreateSkuSequence1785200000000 {
    name = 'CreateSkuSequence1785200000000';
    async up(queryRunner) {
        const rows = await queryRunner.query(`
      SELECT COALESCE(MAX(num), 0) AS max_num FROM (
        SELECT MAX(CAST(SUBSTRING(r."customLabelSku" FROM 5) AS INTEGER)) AS num
          FROM listing_records r
         WHERE r."customLabelSku" ~ '^BLA-[0-9]+$'
        UNION ALL
        SELECT MAX(CAST(SUBSTRING(p.sku FROM 5) AS INTEGER)) AS num
          FROM catalog_products p
         WHERE p.sku ~ '^BLA-[0-9]+$'
      ) combined
    `);
        const maxNum = Number(rows[0]?.max_num ?? 0);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS sku_seq START WITH ${maxNum + 1}`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP SEQUENCE IF EXISTS sku_seq`);
    }
}
exports.CreateSkuSequence1785200000000 = CreateSkuSequence1785200000000;
//# sourceMappingURL=1785200000000-CreateSkuSequence.js.map