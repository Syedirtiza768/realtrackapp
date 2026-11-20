"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacRoleCustomizationAndSidebarConfig1785400000000 = void 0;
class RbacRoleCustomizationAndSidebarConfig1785400000000 {
    name = 'RbacRoleCustomizationAndSidebarConfig1785400000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "roles"
      ADD COLUMN IF NOT EXISTS "isCustomized" boolean NOT NULL DEFAULT false
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sidebar_module_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "roleSlug" varchar(80) NOT NULL,
        "moduleKey" varchar(120) NOT NULL,
        "visible" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sidebar_module_configs" PRIMARY KEY ("id"),
        CONSTRAINT "uq_sidebar_config_role_module" UNIQUE ("roleSlug", "moduleKey")
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sidebar_config_role"
      ON "sidebar_module_configs" ("roleSlug")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sidebar_config_module"
      ON "sidebar_module_configs" ("moduleKey")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "sidebar_module_configs"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "isCustomized"`);
    }
}
exports.RbacRoleCustomizationAndSidebarConfig1785400000000 = RbacRoleCustomizationAndSidebarConfig1785400000000;
//# sourceMappingURL=1785400000000-RbacRoleCustomizationAndSidebarConfig.js.map