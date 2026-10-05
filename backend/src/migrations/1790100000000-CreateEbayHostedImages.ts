import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Caches eBay Picture Services URLs by source image and eBay store. Image
 * hosting is account-scoped and must happen before Inventory API or
 * SellerPundit publish, but the same source image should not be uploaded for
 * every listing retry.
 */
export class CreateEbayHostedImages1790100000000 implements MigrationInterface {
  name = 'CreateEbayHostedImages1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_hosted_images (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        store_id uuid NOT NULL,
        source_url text NOT NULL,
        hosted_url text NOT NULL,
        image_id varchar(255),
        expiration_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ebay_hosted_images" PRIMARY KEY (id),
        CONSTRAINT "FK_ebay_hosted_images_store"
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ebay_hosted_images_store_source
      ON ebay_hosted_images (store_id, source_url)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ebay_hosted_images_store
      ON ebay_hosted_images (store_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_ebay_hosted_images_store`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_ebay_hosted_images_store_source`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_hosted_images`);
  }
}
