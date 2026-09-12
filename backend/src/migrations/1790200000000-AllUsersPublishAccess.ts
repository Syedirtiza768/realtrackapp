import { MigrationInterface, QueryRunner } from 'typeorm';

/** Make all active users eligible to publish across all connected stores. */
export class AllUsersPublishAccess1790200000000 implements MigrationInterface {
  name = 'AllUsersPublishAccess1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ALTER COLUMN store_access_all SET DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE users SET store_access_all = true WHERE active = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ALTER COLUMN store_access_all SET DEFAULT false`,
    );
  }
}
