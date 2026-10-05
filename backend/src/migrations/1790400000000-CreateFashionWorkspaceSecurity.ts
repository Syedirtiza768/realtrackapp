import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fashion compliance review records are private workspace data. Evidence keys
 * are intentionally kept out of catalog/listing payloads and listing feeds.
 */
export class CreateFashionWorkspaceSecurity1790400000000 implements MigrationInterface {
  name = 'CreateFashionWorkspaceSecurity1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fashion_reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "catalog_product_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "authenticity_confirmed" boolean NOT NULL DEFAULT false,
        "evidence_keys" text[] NOT NULL DEFAULT '{}',
        "reviewed_by_user_id" uuid,
        "notes" text,
        "reviewed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_fashion_reviews_catalog_product"
          FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_fashion_reviews_product"
        ON "fashion_reviews" ("catalog_product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_fashion_reviews_org_status"
        ON "fashion_reviews" ("organization_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_fashion_reviews_org_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_fashion_reviews_product"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "fashion_reviews"`);
  }
}
