import { MigrationInterface, QueryRunner } from 'typeorm';

/** Sequence numbers are assigned by a serialized promoter AFTER source transactions commit. */
export class PrimemotiveOrderedChanges1791600000000 implements MigrationInterface {
  name = 'PrimemotiveOrderedChanges1791600000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE ebay_published_listings ADD COLUMN revision bigint NOT NULL DEFAULT 1`,
    );
    await q.query(`CREATE SEQUENCE primemotive_change_sequence`);
    await q.query(
      `ALTER TABLE ebay_published_listing_changes ADD COLUMN sequence bigint`,
    );
    await q.query(
      `CREATE UNIQUE INDEX uq_epl_change_sequence ON ebay_published_listing_changes(sequence) WHERE sequence IS NOT NULL`,
    );
    await q.query(
      `CREATE INDEX idx_epl_change_scope_sequence ON ebay_published_listing_changes(organization_id,store_id,sequence) WHERE sequence IS NOT NULL`,
    );
    await q.query(
      `CREATE INDEX idx_epl_change_pending_listing ON ebay_published_listing_changes(organization_id,store_id,listing_id,sequence) WHERE delivered_at IS NULL AND sequence IS NOT NULL`,
    );
    await q.query(
      `CREATE INDEX idx_epl_change_unsequenced ON ebay_published_listing_changes(occurred_at,id) WHERE sequence IS NULL`,
    );
    // Retain the exact previous trigger for migration rollback without rewriting history.
    await q.query(
      `ALTER FUNCTION capture_primemotive_listing_change() RENAME TO capture_primemotive_listing_change_legacy`,
    );
    await q.query(
      `DROP TRIGGER trg_capture_primemotive_listing_change ON ebay_published_listings`,
    );
    await q.query(`CREATE FUNCTION increment_published_listing_revision() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.revision := OLD.revision + 1; RETURN NEW; END $$`);
    await q.query(
      `CREATE TRIGGER trg_published_listing_revision BEFORE UPDATE ON ebay_published_listings FOR EACH ROW EXECUTE FUNCTION increment_published_listing_revision()`,
    );
    await q.query(`CREATE FUNCTION primemotive_listing_snapshot(r ebay_published_listings) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
      SELECT jsonb_build_object('id',r.id,'ebayItemId',r.ebay_item_id,'sku',r.sku,'title',r.title,
        'description',r.description,'price',r.price::text,'currency',r.currency,'quantityAvailable',r.quantity_available,
        'quantitySold',r.quantity_sold,'listingStatus',r.listing_status,'listingFormat',r.listing_format,
        'condition',r.condition,'categoryId',r.category_id,'categoryName',r.category_name,'listingUrl',r.listing_url,
        'imageUrls',r.image_urls,'itemSpecifics',r.item_specifics,'marketplaceId',r.marketplace_id,'isTestListing',r.is_test_listing,
        'revision',r.revision::text) $$`);
    await q.query(`CREATE FUNCTION capture_primemotive_listing_change() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE old_ok boolean := false; new_ok boolean := false; snap jsonb; old_snap jsonb; kind text; row_org uuid; row_store uuid; row_id uuid;
      BEGIN
        IF TG_OP <> 'INSERT' THEN
          SELECT EXISTS(SELECT 1 FROM stores s WHERE s.id=OLD.store_id AND s.channel='ebay' AND lower(btrim(s.store_name))='primemotive')
            AND OLD.listing_status='active' AND COALESCE(btrim(OLD.ebay_item_id),'')<>'' INTO old_ok;
          old_snap := primemotive_listing_snapshot(OLD);
        END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT EXISTS(SELECT 1 FROM stores s WHERE s.id=NEW.store_id AND s.channel='ebay' AND lower(btrim(s.store_name))='primemotive')
            AND NEW.listing_status='active' AND COALESCE(btrim(NEW.ebay_item_id),'')<>'' INTO new_ok;
          snap := primemotive_listing_snapshot(NEW);
        END IF;
        IF NOT old_ok AND NOT new_ok THEN
          IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
        END IF;
        IF old_ok AND new_ok AND (OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.store_id IS DISTINCT FROM NEW.store_id) THEN
          INSERT INTO ebay_published_listing_changes(organization_id,store_id,listing_id,event_type,listing_snapshot)
            VALUES(OLD.organization_id,OLD.store_id,OLD.id,'listing.removed',old_snap || jsonb_build_object('revision',NEW.revision::text,'listingStatus','removed'));
          old_ok:=false;
        END IF;
        IF old_ok AND NOT new_ok THEN
          kind := 'listing.removed'; row_id:=OLD.id; row_org:=OLD.organization_id; row_store:=OLD.store_id;
          IF TG_OP='DELETE' THEN snap:=old_snap || jsonb_build_object('revision',(OLD.revision+1)::text,'listingStatus','removed'); END IF;
          IF TG_OP='UPDATE' AND (OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.store_id IS DISTINCT FROM NEW.store_id) THEN
            snap:=old_snap || jsonb_build_object('revision',NEW.revision::text,'listingStatus','removed');
          END IF;
        ELSE
          row_id:=NEW.id; row_org:=NEW.organization_id; row_store:=NEW.store_id;
          IF NOT old_ok THEN kind:='listing.added';
          ELSIF (snap-'revision') IS DISTINCT FROM (old_snap-'revision') THEN kind:='listing.updated';
          ELSE RETURN NEW; END IF;
        END IF;
        INSERT INTO ebay_published_listing_changes(organization_id,store_id,listing_id,event_type,listing_snapshot)
          VALUES(row_org,row_store,row_id,kind,snap);
        IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END $$`);
    await q.query(
      `CREATE TRIGGER trg_capture_primemotive_listing_change AFTER INSERT OR UPDATE OR DELETE ON ebay_published_listings FOR EACH ROW EXECUTE FUNCTION capture_primemotive_listing_change()`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DROP TRIGGER trg_capture_primemotive_listing_change ON ebay_published_listings`,
    );
    await q.query(`DROP FUNCTION capture_primemotive_listing_change()`);
    await q.query(
      `DROP FUNCTION primemotive_listing_snapshot(ebay_published_listings)`,
    );
    await q.query(
      `ALTER FUNCTION capture_primemotive_listing_change_legacy() RENAME TO capture_primemotive_listing_change`,
    );
    await q.query(
      `CREATE TRIGGER trg_capture_primemotive_listing_change AFTER INSERT OR UPDATE OR DELETE ON ebay_published_listings FOR EACH ROW EXECUTE FUNCTION capture_primemotive_listing_change()`,
    );
    await q.query(
      `DROP TRIGGER trg_published_listing_revision ON ebay_published_listings`,
    );
    await q.query(`DROP FUNCTION increment_published_listing_revision()`);
    await q.query(`ALTER TABLE ebay_published_listings DROP COLUMN revision`);
    await q.query(
      `ALTER TABLE ebay_published_listing_changes DROP COLUMN sequence`,
    );
    await q.query(`DROP SEQUENCE primemotive_change_sequence`);
  }
}
