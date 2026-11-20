"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateEbayHostedImages1790100000000 = void 0;
class CreateEbayHostedImages1790100000000 {
    name = 'CreateEbayHostedImages1790100000000';
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_ebay_hosted_images_store`);
        await queryRunner.query(`DROP INDEX IF EXISTS uq_ebay_hosted_images_store_source`);
        await queryRunner.query(`DROP TABLE IF EXISTS ebay_hosted_images`);
    }
}
exports.CreateEbayHostedImages1790100000000 = CreateEbayHostedImages1790100000000;
//# sourceMappingURL=1790100000000-CreateEbayHostedImages.js.map