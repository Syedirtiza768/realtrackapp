import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the existing published-listing CSV export permission to the API reader. */
export class PrimemotiveExportPermissionGrant1791300000000
  implements MigrationInterface
{
  name = 'PrimemotiveExportPermissionGrant1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "permissionId")
      SELECT role_row."id", permission_row."id"
      FROM "roles" role_row
      CROSS JOIN "permissions" permission_row
      WHERE role_row."slug" = 'api_published_listings_reader'
        AND permission_row."key" = 'published_listings.export'
      ON CONFLICT ("roleId", "permissionId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions" role_permission
      USING "roles" role_row, "permissions" permission_row
      WHERE role_permission."roleId" = role_row."id"
        AND role_permission."permissionId" = permission_row."id"
        AND role_row."slug" = 'api_published_listings_reader'
        AND permission_row."key" = 'published_listings.export'
    `);
  }
}
