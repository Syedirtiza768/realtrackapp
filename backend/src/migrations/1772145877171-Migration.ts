import { MigrationInterface, QueryRunner } from 'typeorm';

/** @deprecated Superseded by InitialSchema1708999999999. Kept for migration history. */
export class Migration1772145877171 implements MigrationInterface {
  name = 'Migration1772145877171';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Schema is created by InitialSchema1708999999999 on fresh databases.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: InitialSchema owns the schema.
  }
}
