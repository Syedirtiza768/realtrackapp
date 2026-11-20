"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateWarehouseIntakeRowSequence1789100000000 = void 0;
class CreateWarehouseIntakeRowSequence1789100000000 {
    name = 'CreateWarehouseIntakeRowSequence1789100000000';
    async up(queryRunner) {
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS warehouse_intake_row_seq`);
        await queryRunner.query(`
      SELECT setval(
        'warehouse_intake_row_seq',
        GREATEST(
          COALESCE((
            SELECT MAX("sourceRowNumber")
            FROM listing_records
            WHERE "sourceFileName" = 'warehouse-intake'
              AND "sheetName" = 'intake'
          ), 0),
          (SELECT last_value FROM warehouse_intake_row_seq)
        ),
        true
      )
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP SEQUENCE IF EXISTS warehouse_intake_row_seq`);
    }
}
exports.CreateWarehouseIntakeRowSequence1789100000000 = CreateWarehouseIntakeRowSequence1789100000000;
//# sourceMappingURL=1789100000000-CreateWarehouseIntakeRowSequence.js.map