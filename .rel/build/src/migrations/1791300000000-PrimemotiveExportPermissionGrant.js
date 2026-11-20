"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimemotiveExportPermissionGrant1791300000000 = void 0;
class PrimemotiveExportPermissionGrant1791300000000 {
    name = 'PrimemotiveExportPermissionGrant1791300000000';
    async up(queryRunner) {
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
    async down(queryRunner) {
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
exports.PrimemotiveExportPermissionGrant1791300000000 = PrimemotiveExportPermissionGrant1791300000000;
//# sourceMappingURL=1791300000000-PrimemotiveExportPermissionGrant.js.map