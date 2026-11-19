-- Expected end state of the synthetic merge. Each row must say ok = t.
\set SA '30000000-0000-0000-0000-000000000001'
\set SS '20000000-0000-0000-0000-000000000001'
\set SC '10000000-0000-0000-0000-000000000001'
WITH c(check_name, got, want) AS (VALUES
  ('mirror rows total (7100 - 2500 deleted)', (SELECT count(*) FROM ebay_published_listings)::text, '4600'),
  ('mirror rows on survivor', (SELECT count(*) FROM ebay_published_listings WHERE ebay_account_id = :'SA' AND store_id = :'SS')::text, '4600'),
  ('mirror rows left on losers', (SELECT count(*) FROM ebay_published_listings WHERE ebay_account_id <> :'SA')::text, '0'),
  ('catalog links copied to survivor items 1-50', (SELECT count(*) FROM ebay_published_listings WHERE ebay_account_id = :'SA' AND ebay_item_id IN (SELECT 'I' || g FROM generate_series(1, 50) g) AND catalog_product_id IS NOT NULL)::text, '50'),
  ('items 5501-6000: one row each, fresher LA2 copy kept', (SELECT count(*) FROM ebay_published_listings WHERE ebay_item_id IN (SELECT 'I' || g FROM generate_series(5501, 6000) g) AND last_synced_at > now() - interval '36 hours')::text, '500'),
  ('linked LA2 rows 5501-5510 kept with links', (SELECT count(*) FROM ebay_published_listings WHERE ebay_item_id IN (SELECT 'I' || g FROM generate_series(5501, 5510) g) AND catalog_product_id IS NOT NULL)::text, '10'),
  ('null-item rows moved', (SELECT count(*) FROM ebay_published_listings WHERE ebay_item_id IS NULL AND ebay_account_id = :'SA')::text, '100'),
  ('moved rows carry survivor name', (SELECT count(DISTINCT account_display_name) FROM ebay_published_listings WHERE ebay_account_id = :'SA' AND ebay_item_id = 'I5001')::text || ':' || (SELECT max(account_display_name) FROM ebay_published_listings WHERE ebay_item_id = 'I5001'), '1:Survivor Store'),
  ('row pointing at deleted publish record nulled', (SELECT count(*) FROM ebay_published_listings WHERE ebay_item_id = 'I5001' AND ebay_listing_channel_id IS NULL)::text, '1'),
  ('log pointing at deleted mirror row nulled', (SELECT count(*) FROM listing_action_logs WHERE action = 'test_ref_listing' AND ebay_published_listing_id IS NULL)::text, '1'),
  ('log pointing at deleted publish record nulled', (SELECT count(*) FROM listing_action_logs WHERE action = 'test_ref_channel' AND ebay_listing_channel_id IS NULL)::text, '1'),
  ('publish records: survivor P1, LA2 P2, LA2 P3', (SELECT string_agg(id::text, ',' ORDER BY id) FROM ebay_listing_channels WHERE ebay_account_id = :'SA'), '70000000-0000-0000-0000-000000000001,70000000-0000-0000-0000-000000000004,70000000-0000-0000-0000-000000000005'),
  ('publish records left on losers', (SELECT count(*) FROM ebay_listing_channels WHERE ebay_account_id <> :'SA')::text, '0'),
  ('user assignments on survivor (U1, U2)', (SELECT count(*) FROM user_store_assignments WHERE store_id = :'SS')::text || '/' || (SELECT count(*) FROM user_store_assignments)::text, '2/2'),
  ('warehouse links', (SELECT count(*) FROM store_warehouse_links WHERE store_id = :'SS')::text || '/' || (SELECT count(*) FROM store_warehouse_links)::text, '1/1'),
  ('stock policies', (SELECT count(*) FROM store_stock_policies WHERE store_id = :'SS')::text || '/' || (SELECT count(*) FROM store_stock_policies)::text, '1/1'),
  ('stock sync state (I1 kept, I2 moved)', (SELECT count(*) FROM channel_stock_sync_state WHERE store_id = :'SS')::text || '/' || (SELECT count(*) FROM channel_stock_sync_state)::text, '2/2'),
  ('orders moved with connection', (SELECT count(*) FROM orders WHERE store_id = :'SS' AND connection_id = :'SC')::text, '3'),
  ('job targets moved', (SELECT count(*) FROM ebay_listing_job_targets WHERE ebay_account_id = :'SA')::text, '2'),
  ('hosted images (survivor url1 kept, url2 moved)', (SELECT string_agg(hosted_url, ',' ORDER BY hosted_url) FROM ebay_hosted_images WHERE store_id = :'SS'), 'https://eps/1,https://eps/2'),
  ('losers disabled, suffixed once', (SELECT string_agg(connection_status || ':' || account_display_name, ' | ' ORDER BY account_display_name) FROM connected_ebay_accounts WHERE id <> :'SA'), 'disabled:Loser One (merged into Survivor Store) | disabled:Loser Two (merged into Survivor Store)'),
  ('loser stores archived', (SELECT string_agg(status || ':' || store_name, ' | ' ORDER BY store_name) FROM stores WHERE id <> :'SS'), 'archived:Loser One (merged into Survivor Store) | archived:Loser Two (merged into Survivor Store)'),
  ('survivor untouched', (SELECT connection_status || ':' || account_display_name FROM connected_ebay_accounts WHERE id = :'SA'), 'active:Survivor Store'),
  ('loser tokens flagged', (SELECT count(*) FROM ebay_oauth_tokens WHERE reconnect_required)::text, '2'),
  ('backup: accounts (3 rows, not doubled)', (SELECT count(*) FROM merge_backup_20261118_connected_ebay_accounts)::text, '3'),
  ('backup: mirror keys (losers 4100 + survivor unlinked 3000)', (SELECT count(*) FROM merge_backup_20261118_ebay_published_listings)::text, '7100'),
  ('backup: publish records', (SELECT count(*) FROM merge_backup_20261118_ebay_listing_channels)::text, '4')
)
SELECT check_name, got, want, got IS NOT DISTINCT FROM want AS ok FROM c;
