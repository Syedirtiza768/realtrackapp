-- ============================================================================
-- Multi-Store + AI Enhancement + Demo Mode Migration
-- ListingPro Enterprise Platform
-- ============================================================================

BEGIN;

-- ─── 1. Stores table ───
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL,
  store_name VARCHAR(200) NOT NULL,
  store_url TEXT,
  external_store_id VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  metrics_cache JSONB NOT NULL DEFAULT '{}',
  listing_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_connection ON stores(connection_id);
CREATE INDEX IF NOT EXISTS idx_store_channel_name ON stores(channel, store_name);


-- ─── 2. Listing Channel Instances table ───
CREATE TABLE IF NOT EXISTS listing_channel_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listing_records(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL,
  external_id VARCHAR(200),
  external_url TEXT,
  override_price NUMERIC(10,2),
  override_quantity INTEGER,
  override_title TEXT,
  channel_specific_data JSONB NOT NULL DEFAULT '{}',
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_pushed_version INTEGER,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lci_listing ON listing_channel_instances(listing_id);
CREATE INDEX IF NOT EXISTS idx_lci_store ON listing_channel_instances(store_id);
CREATE INDEX IF NOT EXISTS idx_lci_connection ON listing_channel_instances(connection_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lci_listing_store ON listing_channel_instances(listing_id, store_id);
CREATE INDEX IF NOT EXISTS idx_lci_external ON listing_channel_instances(external_id);
CREATE INDEX IF NOT EXISTS idx_lci_sync_status ON listing_channel_instances(sync_status);


-- ─── 3. AI Enhancements table ───
CREATE TABLE IF NOT EXISTS ai_enhancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listing_records(id) ON DELETE CASCADE,
  enhancement_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'requested',
  input_data JSONB NOT NULL DEFAULT '{}',
  original_value TEXT,
  enhanced_value TEXT,
  enhanced_data JSONB,
  diff JSONB,
  provider VARCHAR(50),
  model VARCHAR(50),
  confidence_score REAL,
  tokens_used INTEGER,
  latency_ms INTEGER,
  cost_usd NUMERIC(8,6),
  version INTEGER NOT NULL DEFAULT 1,
  enhancement_version INTEGER NOT NULL DEFAULT 1,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_enh_listing ON ai_enhancements(listing_id);
CREATE INDEX IF NOT EXISTS idx_ai_enh_type ON ai_enhancements(enhancement_type);
CREATE INDEX IF NOT EXISTS idx_ai_enh_status ON ai_enhancements(status);
CREATE INDEX IF NOT EXISTS idx_ai_enh_listing_type ON ai_enhancements(listing_id, enhancement_type);


-- ─── 4. Demo Simulation Logs table ───
CREATE TABLE IF NOT EXISTS demo_simulation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type VARCHAR(50) NOT NULL,
  channel VARCHAR(30) NOT NULL,
  store_id UUID,
  listing_id UUID,
  instance_id UUID,
  simulated_external_id VARCHAR(200),
  request_payload JSONB NOT NULL DEFAULT '{}',
  response_payload JSONB NOT NULL DEFAULT '{}',
  simulated_latency_ms INTEGER NOT NULL DEFAULT 0,
  simulated_success BOOLEAN NOT NULL DEFAULT true,
  simulated_error TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_log_operation ON demo_simulation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_demo_log_channel ON demo_simulation_logs(channel);
CREATE INDEX IF NOT EXISTS idx_demo_log_listing ON demo_simulation_logs(listing_id);
CREATE INDEX IF NOT EXISTS idx_demo_log_created ON demo_simulation_logs(created_at);


-- ─── 5. Seed Demo Stores (for each existing channel connection or standalone) ───
-- Insert demo channel connections if none exist
INSERT INTO channel_connections (id, channel, user_id, account_name, status, encrypted_tokens, scope)
SELECT gen_random_uuid(), ch.channel, '00000000-0000-0000-0000-000000000001'::uuid, ch.account_name, 'active',
       '{"demo": true}', 'demo'
FROM (VALUES
  ('ebay', 'eBay Motors Pro'),
  ('shopify', 'AutoParts Shopify Store'),
  ('amazon', 'Amazon Automotive'),
  ('walmart', 'Walmart Marketplace')
) AS ch(channel, account_name)
WHERE NOT EXISTS (
  SELECT 1 FROM channel_connections WHERE channel = ch.channel AND status = 'active'
);

-- Insert demo stores for each active connection
INSERT INTO stores (connection_id, channel, store_name, store_url, is_primary, config)
SELECT
  cc.id,
  cc.channel,
  CASE cc.channel
    WHEN 'ebay' THEN name.store_name
    WHEN 'shopify' THEN name.store_name
    WHEN 'amazon' THEN name.store_name
    WHEN 'walmart' THEN name.store_name
    ELSE name.store_name
  END,
  CASE cc.channel
    WHEN 'ebay' THEN 'https://www.ebay.com/str/' || REPLACE(name.store_name, ' ', '-')
    WHEN 'shopify' THEN 'https://' || LOWER(REPLACE(name.store_name, ' ', '-')) || '.myshopify.com'
    WHEN 'amazon' THEN 'https://www.amazon.com/sp?seller=' || LOWER(REPLACE(name.store_name, ' ', ''))
    WHEN 'walmart' THEN 'https://www.walmart.com/seller/' || LOWER(REPLACE(name.store_name, ' ', '-'))
    ELSE NULL
  END,
  name.is_primary,
  jsonb_build_object('demo', true, 'pricingRule', name.pricing_rule)
FROM channel_connections cc
CROSS JOIN LATERAL (
  VALUES
    (cc.channel || ' Primary Store', true, 'standard'),
    (cc.channel || ' Outlet Store', false, 'discount_10pct'),
    (cc.channel || ' Premium Store', false, 'premium_15pct')
) AS name(store_name, is_primary, pricing_rule)
WHERE cc.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.connection_id = cc.id AND s.store_name = name.store_name
  );


COMMIT;

-- ============================================================================
-- Verification queries
-- ============================================================================
SELECT 'stores' AS "table", COUNT(*) AS "rows" FROM stores
UNION ALL
SELECT 'listing_channel_instances', COUNT(*) FROM listing_channel_instances
UNION ALL
SELECT 'ai_enhancements', COUNT(*) FROM ai_enhancements
UNION ALL
SELECT 'demo_simulation_logs', COUNT(*) FROM demo_simulation_logs
UNION ALL
SELECT 'channel_connections', COUNT(*) FROM channel_connections;
