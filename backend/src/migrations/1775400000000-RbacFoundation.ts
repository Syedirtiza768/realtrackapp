import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RBAC foundation: roles, permissions, role_permissions, user_roles.
 * Data is synced from permission-registry via RbacService on startup.
 */
export class RbacFoundation1775400000000 implements MigrationInterface {
  name = 'RbacFoundation1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(120) NOT NULL,
        "label" character varying(200) NOT NULL,
        "module" character varying(80) NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permissions_key" UNIQUE ("key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_permissions_key" ON "permissions" ("key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_permissions_module" ON "permissions" ("module")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying(80) NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "isSystem" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_roles_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_roles_slug" ON "roles" ("slug")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "roleId" uuid NOT NULL,
        "permissionId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_role_permissions_role_permission" UNIQUE ("roleId", "permissionId"),
        CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_role_permissions_role" ON "role_permissions" ("roleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_role_permissions_permission" ON "role_permissions" ("permissionId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "roleId" uuid NOT NULL,
        "isPrimary" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_roles_user_role" UNIQUE ("userId", "roleId"),
        CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_roles_user" ON "user_roles" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_roles_role" ON "user_roles" ("roleId")`,
    );

    // Allow super_admin in legacy users.role column (varchar — no enum constraint in DB)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
  }
}
