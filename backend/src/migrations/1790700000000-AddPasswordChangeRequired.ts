import { MigrationInterface, QueryRunner } from 'typeorm';

/** Existing accounts are unchanged; bootstrap opt-in belongs to the scoped seed. */
export class AddPasswordChangeRequired1790700000000 implements MigrationInterface {
  name = 'AddPasswordChangeRequired1790700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN "password_change_required" boolean NOT NULL DEFAULT false',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "password_change_required"',
    );
  }
}
