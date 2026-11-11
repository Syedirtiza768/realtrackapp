import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grants the dedicated Primemotive feed and sale-event permissions to the
 * existing external listing reader role, when that role is present.
 */
export class PrimemotiveExternalApiPermissions1791200000000
  implements MigrationInterface
{
  name = 'PrimemotiveExternalApiPermissions1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("key", "label", "module", "description")
      VALUES
        (
          'published_listings.external_feed',
          'Read the Primemotive external listing feed',
          'published_listings',
          'Dedicated access to the server-scoped Primemotive JSON listing feed.'
        ),
        (
          'published_listings.sales.notify',
          'Report external sales for Primemotive listings',
          'published_listings',
          'Allows a service account to submit sale events for its organization’s Primemotive listings.'
        )
      ON CONFLICT ("key") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "permissionId")
      SELECT role_row."id", permission_row."id"
      FROM "roles" role_row
      CROSS JOIN "permissions" permission_row
      WHERE role_row."slug" = 'api_published_listings_reader'
        AND permission_row."key" IN (
          'published_listings.external_feed',
          'published_listings.sales.notify'
        )
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
        AND permission_row."key" IN (
          'published_listings.external_feed',
          'published_listings.sales.notify'
        )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" permission_row
      WHERE permission_row."key" IN (
        'published_listings.external_feed',
        'published_listings.sales.notify'
      )
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" role_permission
          WHERE role_permission."permissionId" = permission_row."id"
        )
    `);
  }
}
