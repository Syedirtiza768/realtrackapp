import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * eBay Master Vehicle List (MVL) reference tables.
 *
 * Stores official per-marketplace MVL releases and flattened vehicle rows
 * used for local fitment validation (DB-first, Taxonomy API fallback).
 */
export class EbayMvlReferenceData1785500000000 implements MigrationInterface {
  name = 'EbayMvlReferenceData1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ebay_mvl_releases" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "marketplace" varchar(4) NOT NULL,
        "version_label" varchar(64) NOT NULL,
        "file_name" varchar(255) NOT NULL,
        "file_sha256" char(64) NOT NULL,
        "source_row_count" integer NOT NULL DEFAULT 0,
        "entry_count" integer NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'importing',
        "error_message" text,
        "imported_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ebay_mvl_releases" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ebay_mvl_releases_marketplace_status"
        ON "ebay_mvl_releases" ("marketplace", "status");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ebay_mvl_entries" (
        "id" BIGSERIAL NOT NULL,
        "release_id" uuid NOT NULL,
        "marketplace" varchar(4) NOT NULL,
        "epid" varchar(32),
        "make" varchar(120) NOT NULL,
        "model" varchar(120) NOT NULL,
        "year" smallint NOT NULL,
        "trim" varchar(255),
        "engine" varchar(255),
        "submodel" varchar(120),
        "variant" varchar(255),
        "platform" varchar(120),
        "body" varchar(120),
        "ktype" varchar(32),
        "display_name" varchar(255),
        "extras" jsonb,
        CONSTRAINT "PK_ebay_mvl_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ebay_mvl_entries_release"
          FOREIGN KEY ("release_id") REFERENCES "ebay_mvl_releases"("id")
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ebay_mvl_entries_lookup"
        ON "ebay_mvl_entries" ("marketplace", "make", "model", "year");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ebay_mvl_entries_make"
        ON "ebay_mvl_entries" ("marketplace", "make");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ebay_mvl_entries_release"
        ON "ebay_mvl_entries" ("release_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ebay_mvl_entries";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ebay_mvl_releases";`);
  }
}
