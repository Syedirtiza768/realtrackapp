"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerPunditExtensions1775600000000 = void 0;
class SellerPunditExtensions1775600000000 {
    name = 'SellerPunditExtensions1775600000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "connected_ebay_accounts"
      ADD COLUMN IF NOT EXISTS "connection_source" varchar(30) NOT NULL DEFAULT 'native_oauth',
      ADD COLUMN IF NOT EXISTS "sellerpundit_token_id" int,
      ADD COLUMN IF NOT EXISTS "sellerpundit_account_name" varchar(200),
      ADD COLUMN IF NOT EXISTS "sellerpundit_marketplace_id" int,
      ADD COLUMN IF NOT EXISTS "sellerpundit_last_sync_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "sellerpundit_last_policy_sync_at" timestamptz
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_connected_ebay_org_sp_token"
      ON "connected_ebay_accounts" ("organization_id", "sellerpundit_token_id")
      WHERE "sellerpundit_token_id" IS NOT NULL
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_sellerpundit_config" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "credentials_encrypted" text,
        "last_jwt_refresh_at" timestamptz,
        "last_sync_at" timestamptz,
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_sellerpundit_config" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_sellerpundit_config_org" UNIQUE ("organization_id"),
        CONSTRAINT "FK_organization_sellerpundit_config_org"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "organization_sellerpundit_config"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_connected_ebay_org_sp_token"`);
        await queryRunner.query(`
      ALTER TABLE "connected_ebay_accounts"
      DROP COLUMN IF EXISTS "sellerpundit_last_policy_sync_at",
      DROP COLUMN IF EXISTS "sellerpundit_last_sync_at",
      DROP COLUMN IF EXISTS "sellerpundit_marketplace_id",
      DROP COLUMN IF EXISTS "sellerpundit_account_name",
      DROP COLUMN IF EXISTS "sellerpundit_token_id",
      DROP COLUMN IF EXISTS "connection_source"
    `);
    }
}
exports.SellerPunditExtensions1775600000000 = SellerPunditExtensions1775600000000;
//# sourceMappingURL=1775600000000-SellerPunditExtensions.js.map