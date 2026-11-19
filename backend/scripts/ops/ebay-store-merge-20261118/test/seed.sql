\set ON_ERROR_STOP on
-- Synthetic seller: survivor SA (store SS, conn SC), losers LA1/LA2 (stores LS1/LS2).
SET session_replication_role = replica;  -- parents we do not create (users, jobs, products) are not checked
\set ORG '00000000-0000-0000-0000-0000000000aa'
\set U1 '00000000-0000-0000-0000-0000000000b1'
\set U2 '00000000-0000-0000-0000-0000000000b2'
\set SC '10000000-0000-0000-0000-000000000001'
\set LC1 '10000000-0000-0000-0000-000000000002'
\set LC2 '10000000-0000-0000-0000-000000000003'
\set SS '20000000-0000-0000-0000-000000000001'
\set LS1 '20000000-0000-0000-0000-000000000002'
\set LS2 '20000000-0000-0000-0000-000000000003'
\set SA '30000000-0000-0000-0000-000000000001'
\set LA1 '30000000-0000-0000-0000-000000000002'
\set LA2 '30000000-0000-0000-0000-000000000003'
\set P1 '40000000-0000-0000-0000-000000000001'
\set P2 '40000000-0000-0000-0000-000000000002'
\set P3 '40000000-0000-0000-0000-000000000003'
\set W1 '50000000-0000-0000-0000-000000000001'
\set I1 '60000000-0000-0000-0000-000000000001'
\set I2 '60000000-0000-0000-0000-000000000002'
\set MP 'EBAY_MOTORS_US'

INSERT INTO organizations (id, name, slug) VALUES (:'ORG', 'Merge Test Org', 'merge-test-org');
-- Catalog products the mirror links point at (prod enforces this FK at write time).
INSERT INTO catalog_products (id, title)
  SELECT md5('p' || g)::uuid, 'p' || g FROM generate_series(1, 50) g
  UNION ALL SELECT md5('q' || g)::uuid, 'q' || g FROM generate_series(5501, 5510) g
  UNION ALL SELECT x::uuid, 'P' FROM (VALUES (:'P1'), (:'P2'), (:'P3')) v(x);
INSERT INTO channel_connections (id, channel, user_id, encrypted_tokens, organization_id) VALUES
  (:'SC', 'ebay', :'U1', 'x', :'ORG'), (:'LC1', 'ebay', :'U1', 'x', :'ORG'), (:'LC2', 'ebay', :'U1', 'x', :'ORG');
INSERT INTO stores (id, connection_id, channel, store_name, organization_id, status) VALUES
  (:'SS', :'SC', 'ebay', 'Survivor Store', :'ORG', 'active'),
  (:'LS1', :'LC1', 'ebay', 'Loser One', :'ORG', 'active'),
  (:'LS2', :'LC2', 'ebay', 'Loser Two', :'ORG', 'active');
INSERT INTO connected_ebay_accounts (id, organization_id, channel_connection_id, primary_store_id, ebay_user_id, account_display_name, environment, connection_status, connection_source) VALUES
  (:'SA', :'ORG', :'SC', :'SS', 'unknown_1', 'Survivor Store', 'production', 'active', 'native_oauth'),
  (:'LA1', :'ORG', :'LC1', :'LS1', 'unknown_2', 'Loser One', 'production', 'disabled', 'native_oauth'),
  (:'LA2', :'ORG', :'LC2', :'LS2', 'unknown_3', 'Loser Two', 'production', 'reconnect_required', 'native_oauth');
INSERT INTO ebay_oauth_tokens (ebay_account_id, access_token_encrypted, access_token_expires_at, refresh_token_encrypted) VALUES
  (:'LA1', 'x', now(), 'x'), (:'LA2', 'x', now(), 'x');

-- Publish records: LA1/P1 collides with survivor; P2 on both losers (LA2 newer wins); LA2/P3 moves.
INSERT INTO ebay_listing_channels (id, organization_id, catalog_product_id, ebay_account_id, marketplace_id, updated_at) VALUES
  ('70000000-0000-0000-0000-000000000001', :'ORG', :'P1', :'SA', :'MP', now()),
  ('70000000-0000-0000-0000-000000000002', :'ORG', :'P1', :'LA1', :'MP', now() - interval '3 day'),
  ('70000000-0000-0000-0000-000000000003', :'ORG', :'P2', :'LA1', :'MP', now() - interval '2 day'),
  ('70000000-0000-0000-0000-000000000004', :'ORG', :'P2', :'LA2', :'MP', now() - interval '1 day'),
  ('70000000-0000-0000-0000-000000000005', :'ORG', :'P3', :'LA2', :'MP', now());

-- Listing mirrors.
INSERT INTO ebay_published_listings (organization_id, ebay_account_id, store_id, marketplace_id, title, ebay_item_id, last_synced_at, listing_status)
  SELECT :'ORG', :'SA', :'SS', :'MP', 't', 'I' || g, now(), 'active' FROM generate_series(1, 3000) g;
INSERT INTO ebay_published_listings (organization_id, ebay_account_id, store_id, marketplace_id, title, ebay_item_id, last_synced_at, listing_status, catalog_product_id)
  SELECT :'ORG', :'LA1', :'LS1', :'MP', 't', 'I' || g, now() - interval '2 day', 'active',
         CASE WHEN g <= 50 THEN md5('p' || g)::uuid END FROM generate_series(1, 2000) g;
INSERT INTO ebay_published_listings (organization_id, ebay_account_id, store_id, marketplace_id, title, ebay_item_id, last_synced_at, listing_status)
  SELECT :'ORG', :'LA1', :'LS1', :'MP', 't', 'I' || g, now() - interval '2 day', 'ended' FROM generate_series(5001, 6000) g;
INSERT INTO ebay_published_listings (organization_id, ebay_account_id, store_id, marketplace_id, title, ebay_item_id, last_synced_at, listing_status, catalog_product_id)
  SELECT :'ORG', :'LA2', :'LS2', :'MP', 't', 'I' || g, now() - interval '1 day', 'ended',
         CASE WHEN g <= 5510 THEN md5('q' || g)::uuid END FROM generate_series(5501, 6500) g;
INSERT INTO ebay_published_listings (organization_id, ebay_account_id, store_id, marketplace_id, title, ebay_item_id, last_synced_at, listing_status)
  SELECT :'ORG', :'LA2', :'LS2', :'MP', 't', NULL, now(), 'draft' FROM generate_series(1, 100) g;
-- A loser mirror row pointing at LA1's P1 publish record (deleted in phase 1 -> must become NULL).
UPDATE ebay_published_listings SET ebay_listing_channel_id = '70000000-0000-0000-0000-000000000002'
WHERE ebay_account_id = :'LA1' AND ebay_item_id = 'I5001';
-- Logs pointing at a loser mirror row that phase 2 deletes, and at LA1's P1 publish record.
INSERT INTO listing_action_logs (organization_id, action, result, ebay_account_id, ebay_published_listing_id, ebay_listing_channel_id)
  SELECT :'ORG', 'test_ref_listing', 'success', :'LA1', id, NULL FROM ebay_published_listings WHERE ebay_account_id = :'LA1' AND ebay_item_id = 'I1';
INSERT INTO listing_action_logs (organization_id, action, result, ebay_account_id, ebay_listing_channel_id)
  VALUES (:'ORG', 'test_ref_channel', 'success', :'LA1', '70000000-0000-0000-0000-000000000002');

-- Store-keyed rows.
INSERT INTO user_store_assignments (user_id, store_id) VALUES (:'U1', :'SS'), (:'U1', :'LS1'), (:'U2', :'LS2');
INSERT INTO store_warehouse_links (organization_id, store_id, warehouse_id) VALUES (:'ORG', :'SS', :'W1'), (:'ORG', :'LS1', :'W1'), (:'ORG', :'LS2', :'W1');
INSERT INTO store_stock_policies (store_id, organization_id) VALUES (:'SS', :'ORG'), (:'LS1', :'ORG');
INSERT INTO channel_stock_sync_state (store_id, inventory_item_id, organization_id) VALUES (:'SS', :'I1', :'ORG'), (:'LS1', :'I1', :'ORG'), (:'LS2', :'I2', :'ORG');
INSERT INTO orders (channel, external_order_id, store_id, connection_id) VALUES
  ('ebay', 'T-ORDER-1', :'LS1', :'LC1'), ('ebay', 'T-ORDER-2', :'LS1', :'LC1'), ('ebay', 'T-ORDER-3', :'LS1', :'LC1');
INSERT INTO ebay_listing_job_targets (listing_job_id, marketplace_id, ebay_account_id) VALUES
  ('80000000-0000-0000-0000-000000000001', :'MP', :'LA2'), ('80000000-0000-0000-0000-000000000002', :'MP', :'LA2');
INSERT INTO ebay_hosted_images (store_id, source_url, hosted_url) VALUES
  (:'SS', 'https://img/1', 'https://eps/1'), (:'LS1', 'https://img/1', 'https://eps/1b'), (:'LS2', 'https://img/2', 'https://eps/2');
SELECT 'seeded' AS status, (SELECT count(*) FROM ebay_published_listings) AS mirror_rows;
