import { MigrationInterface, QueryRunner } from 'typeorm';

/** Captures durable Primemotive listing changes for polling and webhook delivery. */
export class PrimemotiveListingChangeFeed1791400000000 implements MigrationInterface {
  name = 'PrimemotiveListingChangeFeed1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ebay_published_listings"
      ADD COLUMN "is_test_listing" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE "ebay_published_listing_changes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "store_id" uuid NOT NULL,
        "listing_id" uuid NOT NULL,
        "event_type" varchar(40) NOT NULL,
        "listing_snapshot" jsonb NOT NULL,
        "occurred_at" timestamptz NOT NULL DEFAULT clock_timestamp(),
        "delivery_attempts" integer NOT NULL DEFAULT 0,
        "next_attempt_at" timestamptz NOT NULL DEFAULT clock_timestamp(),
        "delivered_at" timestamptz NULL,
        "last_delivery_error" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT clock_timestamp()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_epl_changes_org_store_time"
      ON "ebay_published_listing_changes" ("organization_id", "store_id", "occurred_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_epl_changes_delivery"
      ON "ebay_published_listing_changes" ("next_attempt_at", "occurred_at")
      WHERE "delivered_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE FUNCTION capture_primemotive_listing_change()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        old_is_primemotive boolean := false;
        new_is_primemotive boolean := false;
        event_name varchar(40);
        snapshot jsonb;
        row_id uuid;
        row_org uuid;
        row_store uuid;
      BEGIN
        IF TG_OP <> 'INSERT' THEN
          SELECT channel = 'ebay' AND LOWER(BTRIM(store_name)) = 'primemotive'
          INTO old_is_primemotive FROM stores WHERE id = OLD.store_id;
          old_is_primemotive := COALESCE(old_is_primemotive, false);
        END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT channel = 'ebay' AND LOWER(BTRIM(store_name)) = 'primemotive'
          INTO new_is_primemotive FROM stores WHERE id = NEW.store_id;
          new_is_primemotive := COALESCE(new_is_primemotive, false);
        END IF;

        IF TG_OP = 'INSERT' THEN
          IF NOT new_is_primemotive THEN RETURN NEW; END IF;
          event_name := 'listing.added';
          row_id := NEW.id;
          row_org := NEW.organization_id;
          row_store := NEW.store_id;
          snapshot := jsonb_build_object(
            'id', NEW.id, 'ebayItemId', NEW.ebay_item_id, 'sku', NEW.sku,
            'title', NEW.title, 'description', NEW.description,
            'price', NEW.price::text, 'currency', NEW.currency,
            'quantityAvailable', NEW.quantity_available, 'quantitySold', NEW.quantity_sold,
            'listingStatus', NEW.listing_status, 'listingFormat', NEW.listing_format,
            'condition', NEW.condition, 'categoryId', NEW.category_id,
            'categoryName', NEW.category_name, 'listingUrl', NEW.listing_url,
            'imageUrls', NEW.image_urls, 'itemSpecifics', NEW.item_specifics,
            'marketplaceId', NEW.marketplace_id, 'isTestListing', NEW.is_test_listing
          );
        ELSIF TG_OP = 'DELETE' THEN
          IF NOT old_is_primemotive THEN RETURN OLD; END IF;
          event_name := 'listing.removed';
          row_id := OLD.id;
          row_org := OLD.organization_id;
          row_store := OLD.store_id;
          snapshot := jsonb_build_object(
            'id', OLD.id, 'ebayItemId', OLD.ebay_item_id, 'sku', OLD.sku,
            'title', OLD.title, 'description', OLD.description,
            'price', OLD.price::text, 'currency', OLD.currency,
            'quantityAvailable', OLD.quantity_available, 'quantitySold', OLD.quantity_sold,
            'listingStatus', 'removed', 'listingFormat', OLD.listing_format,
            'condition', OLD.condition, 'categoryId', OLD.category_id,
            'categoryName', OLD.category_name, 'listingUrl', OLD.listing_url,
            'imageUrls', OLD.image_urls, 'itemSpecifics', OLD.item_specifics,
            'marketplaceId', OLD.marketplace_id, 'isTestListing', OLD.is_test_listing
          );
        ELSE
          IF old_is_primemotive AND NOT new_is_primemotive THEN
            event_name := 'listing.removed';
            row_id := OLD.id;
            row_org := OLD.organization_id;
            row_store := OLD.store_id;
            snapshot := jsonb_build_object(
              'id', OLD.id, 'ebayItemId', OLD.ebay_item_id, 'sku', OLD.sku,
              'title', OLD.title, 'price', OLD.price::text, 'currency', OLD.currency,
              'quantityAvailable', OLD.quantity_available, 'quantitySold', OLD.quantity_sold,
              'listingStatus', 'removed', 'marketplaceId', OLD.marketplace_id,
              'isTestListing', OLD.is_test_listing
            );
          ELSIF NOT old_is_primemotive AND new_is_primemotive THEN
            event_name := 'listing.added';
            row_id := NEW.id;
            row_org := NEW.organization_id;
            row_store := NEW.store_id;
            snapshot := jsonb_build_object(
              'id', NEW.id, 'ebayItemId', NEW.ebay_item_id, 'sku', NEW.sku,
              'title', NEW.title, 'description', NEW.description,
              'price', NEW.price::text, 'currency', NEW.currency,
              'quantityAvailable', NEW.quantity_available, 'quantitySold', NEW.quantity_sold,
              'listingStatus', NEW.listing_status, 'listingFormat', NEW.listing_format,
              'condition', NEW.condition, 'categoryId', NEW.category_id,
              'categoryName', NEW.category_name, 'listingUrl', NEW.listing_url,
              'imageUrls', NEW.image_urls, 'itemSpecifics', NEW.item_specifics,
              'marketplaceId', NEW.marketplace_id, 'isTestListing', NEW.is_test_listing
            );
          ELSIF new_is_primemotive AND ROW(
            NEW.ebay_item_id, NEW.sku, NEW.title, NEW.description, NEW.price,
            NEW.currency, NEW.quantity_available, NEW.quantity_sold,
            NEW.listing_status, NEW.listing_format, NEW.condition,
            NEW.category_id, NEW.category_name, NEW.listing_url,
            NEW.image_urls, NEW.item_specifics, NEW.marketplace_id
          ) IS DISTINCT FROM ROW(
            OLD.ebay_item_id, OLD.sku, OLD.title, OLD.description, OLD.price,
            OLD.currency, OLD.quantity_available, OLD.quantity_sold,
            OLD.listing_status, OLD.listing_format, OLD.condition,
            OLD.category_id, OLD.category_name, OLD.listing_url,
            OLD.image_urls, OLD.item_specifics, OLD.marketplace_id
          ) THEN
            IF OLD.listing_status = 'active' AND NEW.listing_status = 'ended' THEN
              event_name := 'listing.removed';
            ELSE
              event_name := 'listing.updated';
            END IF;
            row_id := NEW.id;
            row_org := NEW.organization_id;
            row_store := NEW.store_id;
            snapshot := jsonb_build_object(
              'id', NEW.id, 'ebayItemId', NEW.ebay_item_id, 'sku', NEW.sku,
              'title', NEW.title, 'description', NEW.description,
              'price', NEW.price::text, 'currency', NEW.currency,
              'quantityAvailable', NEW.quantity_available, 'quantitySold', NEW.quantity_sold,
              'listingStatus', NEW.listing_status, 'listingFormat', NEW.listing_format,
              'condition', NEW.condition, 'categoryId', NEW.category_id,
              'categoryName', NEW.category_name, 'listingUrl', NEW.listing_url,
              'imageUrls', NEW.image_urls, 'itemSpecifics', NEW.item_specifics,
              'marketplaceId', NEW.marketplace_id, 'isTestListing', NEW.is_test_listing
            );
          ELSE
            RETURN NEW;
          END IF;
        END IF;

        INSERT INTO "ebay_published_listing_changes"
          (organization_id, store_id, listing_id, event_type, listing_snapshot)
        VALUES (row_org, row_store, row_id, event_name, snapshot);
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_capture_primemotive_listing_change"
      AFTER INSERT OR UPDATE OR DELETE ON "ebay_published_listings"
      FOR EACH ROW EXECUTE FUNCTION capture_primemotive_listing_change()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "trg_capture_primemotive_listing_change" ON "ebay_published_listings"',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS capture_primemotive_listing_change()',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS "ebay_published_listing_changes"',
    );
    await queryRunner.query(
      'ALTER TABLE "ebay_published_listings" DROP COLUMN IF EXISTS "is_test_listing"',
    );
  }
}
