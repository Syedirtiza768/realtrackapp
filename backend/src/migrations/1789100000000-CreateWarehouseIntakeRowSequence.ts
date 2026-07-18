import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allocates warehouse-intake source row numbers atomically.
 *
 * listing_records has a unique source-row key used by imports. The Add Part
 * flow used to allocate this with MAX(sourceRowNumber)+1, which can collide
 * when two intake saves happen at nearly the same time.
 */
export class CreateWarehouseIntakeRowSequence1789100000000
  implements MigrationInterface
{
  name = 'CreateWarehouseIntakeRowSequence1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS warehouse_intake_row_seq`,
    );
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS warehouse_intake_row_seq`);
  }
}
