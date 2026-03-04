# ListingPro → MergeKart: Full System Audit & Implementation Roadmap

**Date:** 2026-02-28  
**Audited By:** Principal Architect  
**System:** ListingPro (NestJS + React + PostgreSQL + Redis/BullMQ)

---

## TABLE OF CONTENTS

1. [Full Audit Report](#1-full-audit-report)
2. [Gap Matrix](#2-gap-matrix)
3. [Risk Assessment](#3-risk-assessment)
4. [Phase-Based Roadmap](#4-phase-based-roadmap)
5. [DB Migration Plan](#5-db-migration-plan)
6. [API Impact Analysis](#6-api-impact-analysis)
7. [Rollback Plan](#7-rollback-plan)
8. [Test Plan](#8-test-plan)

---

## 1. FULL AUDIT REPORT

### 1.1 Backend Architecture

| Component | Count | Details |
|-----------|-------|---------|
| NestJS Modules | 13 | auth, channels, fitment, health, ingestion, inventory, listings, notifications, orders, settings, storage, dashboard, common |
| Controllers | 14 | ~100+ REST endpoints total |
| Services | 19 | Business logic layer |
| Entities | 29 | 26 tables across PostgreSQL |
| BullMQ Queues | 8 | ingestion, channels, storage-thumbnails, storage-cleanup, fitment, inventory, orders, dashboard |
| WebSocket Gateways | 1 | Socket.IO `/notifications` namespace |
| Event Handlers | 12 | EventEmitter2-based (only 1 actively emitting) |

**External Integrations:**
- eBay Inventory API (OAuth2, listing create/update/end, order pull)
- Shopify Admin API (REST, product CRUD, order pull)
- OpenAI GPT-4o Vision (AI image classification)
- AWS S3/CloudFront (image storage + CDN)

**Auth System:** JWT + bcrypt + AES-256-GCM token encryption + RBAC guards

### 1.2 Database Summary

| Metric | Value |
|--------|-------|
| Tables | 26 |
| Total Indexes | 70+ (55 B-tree, 5 GIN, 1 expression, 4 partial) |
| Foreign Keys Defined | 19 |
| Foreign Keys Missing | ~8 critical |
| TypeORM Migrations | 1 (monolithic) |
| Raw SQL Scripts | 14 |
| Tables NOT in Migrations | 4 (`stores`, `listing_channel_instances`, `ai_enhancements`, `demo_simulation_logs`) |

**Critical Schema Issues:**
- `startPrice`, `quantity`, and cost fields stored as TEXT (not numeric)
- `listing_records` base table NOT created by TypeORM migration
- Dual channel mapping tables (`channel_listings` + `listing_channel_instances`)
- Missing FKs on `listing_revisions`, `order_items`, `sales_records`, `inventory_events`
- No DB-level CHECK constraints or ENUMs for status fields

### 1.3 Frontend Summary

| Metric | Value |
|--------|-------|
| Active Files | 46 |
| Active Code Lines | ~11,800 |
| Dead Code Files | 6 (catalogSearch, fitmentSearch, channelAdapters, inventorySync, inventory data ×2) |
| Dead Generated Data | ~73K lines (generatedInventory.ts) |
| API Modules | 11 |
| Components | ~40 |
| UI Library | shadcn/ui + Tailwind CSS + Recharts |

**Critical Frontend Issues:**
- **NO authentication** — no login page, no token management, no auth headers
- **XSS vulnerability** — `dangerouslySetInnerHTML` in SkuDetailPage without sanitization
- **72,834-line dead file** (`generatedInventory.ts`) ships in production bundle
- **No state management library** — pure React hooks with no cache layer
- **FitmentManager entirely mock data** — no backend integration
- **Settings "Add" buttons are no-ops** — wired to nothing
- **Shell header search is non-functional**
- **Theme inconsistency** — SkuDetailPage uses light theme vs. dark everywhere else

### 1.4 Background Jobs Assessment

| Queue | Status | Issues |
|-------|--------|--------|
| `ingestion` | **ACTIVE** | Dual retry logic conflict, no idempotency on AI results |
| `storage-thumbnails` | **ACTIVE** | Working correctly, idempotent |
| `storage-cleanup` | **DEAD CODE** | Processor exists, no producer, no scheduler |
| `channels` | **PARTIALLY BROKEN** | Only handles `publish` — `sync-inventory` and `update` jobs misrouted |
| `fitment` | **ACTIVE** | No checkpoint/resume, N+1 query pattern |
| `inventory` | **DEAD CODE** | 3 job types, zero producers |
| `orders` | **DEAD CODE** | 2 job types, zero producers |
| `dashboard` | **DEAD CODE** | 2 job types, zero producers |

**Event System:** 12 `@OnEvent` handlers registered, **only 1 event actually emitted** (`notification.created`). The other 11 are dead code.

**Scheduled Tasks:** **NONE.** `@nestjs/schedule` not installed. Multiple processors describe themselves as "scheduled" with no scheduling mechanism.

---

## 2. GAP MATRIX

### Feature Coverage Table

| # | MergeKart Feature | Backend | Frontend | Status | Risk | Notes |
|---|-------------------|---------|----------|--------|------|-------|
| **1** | **Centralized Multi-Channel Listing** | ✅ Exists | ✅ Exists | **Partial** | Medium | Backend has multi-store publishing. Frontend has ChannelStorePanel. Missing: Amazon/Walmart adapters are stubs, only eBay/Shopify actually connect. |
| **2** | **Automated Cross-Listing** | ✅ Exists | ✅ Exists | **Partial** | Medium | `publishToMultipleStores` works for demo mode. Real eBay/Shopify adapters exist. Missing: automatic push on listing create/update (manual trigger only). No title/description/image sync per-channel. |
| **3** | **Inventory Sync & Management** | ⚠️ Partial | ✅ Exists | **Partial** | High | `inventory_ledger` + `inventory_events` tables exist. Frontend shows inventory panel. **But:** `inventory` queue is dead code, no real-time sync, `reconcile` never called, `low-stock-alert` never triggered, no webhook-based stock updates from channels. |
| **4** | **Order Management** | ⚠️ Partial | ✅ Exists | **Partial** | High | `orders` table + `OrdersService` exist. Frontend has order list/detail views. **But:** `orders` queue is dead code, `import-from-channels` never runs, `auto-complete` never runs. Orders exist only if manually created or from demo simulation. No real-time order pull. |
| **5** | **Smart Pricing Controls** | ⚠️ Partial | ⚠️ Partial | **Partial** | Medium | `pricing_rules` table exists with rule types (markup, markdown, round, min_margin, competitive). Backend calculates effective prices. Frontend shows pricing rules UI. **But:** no automated price pushing to channels, no competitive price monitoring, no scheduled re-pricing. |
| **6** | **Bulk Actions Support** | ✅ Exists | ⚠️ Partial | **Partial** | Low | Backend has bulk status transitions, bulk publish, bulk ingestion. Frontend has batch selection in listings table. **But:** no bulk price edit, no bulk category change, no bulk image operations in frontend. |
| **7** | **Customizable Templates** | ❌ Missing | ❌ Missing | **Missing** | Low | No template system exists. Listing descriptions are raw HTML from eBay imports. No template designer, no brand-consistent formatting. |
| **8** | **Unified Dashboard & Analytics** | ⚠️ Partial | ✅ Exists | **Partial** | Medium | Dashboard module with summary/KPIs/charts exists in both frontend and backend. `sales_records` + `dashboard_metrics_cache` tables exist. **But:** `dashboard` queue is dead code (aggregation never runs), `daily-sales-rollup` is placeholder, analytics limited to basic counts. |
| **9** | **Marketplace Integrations** | ⚠️ Partial | ✅ Exists | **Partial** | High | eBay + Shopify have real adapters. Amazon + Walmart are **stub/placeholder only** — no actual API integration. Frontend UI shows all 4 channels. Etsy not present at all. |
| **10** | **Custom Automation** | ⚠️ Partial | ❌ Missing | **Mostly Missing** | Medium | `pricing_rules` provides rule-based pricing. Event system infrastructure exists but is disconnected (11/12 events dead). No automation rules engine, no workflow builder, no user-configurable triggers. |
| **11** | **Support & Scalability** | ⚠️ Partial | ❌ Missing | **Partial** | Medium | Multi-store architecture exists. JWT auth + RBAC guards in place. **But:** single-tenant only, no team/org management, no role assignment UI, no audit trail UI (audit_logs table exists but no frontend). |

### Feature Readiness Summary

| Status | Count | Features |
|--------|-------|----------|
| **Fully Implemented** | 0 | — |
| **Partial (>50% done)** | 5 | Multi-Channel Listing, Cross-Listing, Bulk Actions, Dashboard, Pricing |
| **Partial (<50% done)** | 4 | Inventory Sync, Order Management, Integrations, Scalability |
| **Mostly Missing** | 1 | Custom Automation |
| **Fully Missing** | 1 | Customizable Templates |

---

## 3. RISK ASSESSMENT

### A. Stability Assessment

**Critical Systems (DO NOT TOUCH without regression tests):**
| System | Risk Level | Reason |
|--------|-----------|--------|
| Ingestion Pipeline | 🔴 Critical | Core data import flow; touches S3, AI, DB in sequence |
| Listing CRUD + Revisions | 🔴 Critical | Central data model; 86 columns, optimistic locking |
| Channel Publishing (eBay/Shopify) | 🔴 Critical | External API calls with OAuth tokens; money-adjacent |
| Auth + JWT | 🔴 Critical | Guards protect all endpoints |
| Inventory Ledger | 🟡 High | SERIALIZABLE transactions, optimistic locking |
| Image Storage/CDN | 🟡 High | S3 operations, CDN purge |

**Sensitive Modules:**
| Module | Sensitivity | Notes |
|--------|------------|-------|
| `auth/` | 🔴 | Token encryption, password hashing, JWT strategy |
| `channels/` | 🔴 | OAuth tokens (AES-256-GCM encrypted), external API calls |
| `inventory/` | 🟡 | Ledger accuracy affects overselling risk |
| `orders/` | 🟡 | Financial data, order state machine |
| `ingestion/` | 🟡 | AI token costs, S3 operations |

**High-Risk Modification Zones:**
| Zone | Risk | Why |
|------|------|-----|
| `listing_records` schema | 🔴 | 86 columns, FTS trigger, expression indexes, 10+ FKs point to it |
| `data-source.ts` | 🔴 | All DB connectivity flows through here |
| `app.module.ts` | 🟡 | Global module registration, BullMQ config, Redis config |
| `channel-connection.entity.ts` | 🟡 | OAuth token encryption/decryption |
| Pricing calculation logic | 🟡 | `pricing_rules` → effective price → channel publish |

### B. Technical Debt Identification

| Category | Items |
|----------|-------|
| **Duplicate Logic** | `channel_listings` vs `listing_channel_instances` (dual channel mapping); mock data in frontend duplicates DB data; `catalogSearch.ts` + `fitmentSearch.ts` duplicate search API logic |
| **Tight Coupling** | Frontend components directly import API functions (no abstraction layer); eBay column names hardcoded into `listing_records` (eBay-specific schema) |
| **Inconsistent Naming** | Backend: camelCase (`listingId`) vs snake_case (`connection_id`) mixed in entities; Frontend: some components use `interface` vs `type` inconsistently |
| **Non-scalable Design** | Single-tenant architecture (no org/team model); `listing_records` monolithic table (86 cols); no DB connection pooling config; no API rate limiting |
| **Dead Code** | 6 frontend files (~73K lines) never imported; 4 BullMQ queues with processors but no producers; 11 event handlers with no emitters; `storage-cleanup` processor unreachable |

---

## 4. PHASE-BASED ROADMAP

### Phase 1 — Safe Foundations (Estimated: 2-3 weeks)

**Goal:** Fix critical infrastructure gaps without changing any existing behavior.

| # | Task | Complexity | Risk | Rollback |
|---|------|-----------|------|----------|
| 1.1 | Create TypeORM migration for `stores`, `listing_channel_instances`, `ai_enhancements`, `demo_simulation_logs` | Medium | Low | Drop tables + revert migration row |
| 1.2 | Create TypeORM migration for `searchVector`, `extractedMake`, `extractedModel` columns | Low | Low | Drop columns |
| 1.3 | Add missing FK constraints (with `NO ACTION` initially) | Low | Low | Drop constraints |
| 1.4 | Add missing indexes (`status`, `ebayListingId`, `shopifyProductId`, `deletedAt`, `updatedAt`) | Low | Low | Drop indexes |
| 1.5 | Install `@nestjs/schedule` and wire up cron jobs for dead queues | Medium | Low | Remove cron decorators |
| 1.6 | Wire EventEmitter2 emits into existing processors | Medium | Low | Remove emit calls |
| 1.7 | Fix `channels` queue processor to route by `job.name` | Low | Medium | Revert to current behavior |
| 1.8 | Add feature flag service (simple DB-backed or env-based) | Low | Low | Remove service |
| 1.9 | Remove dead frontend code (`generatedInventory.ts`, dead lib files) | Low | Low | Restore files from git |
| 1.10 | Add DOMPurify for XSS protection on `dangerouslySetInnerHTML` | Low | Low | Revert to current |

**Testing Plan:** Unit tests for each new migration; integration tests for queue routing fix; build verification for dead code removal.

---

### Phase 2 — Parallel Implementation (Estimated: 4-6 weeks)

**Goal:** Build missing features as new isolated modules alongside existing ones.

| # | Task | Complexity | Risk | Rollback |
|---|------|-----------|------|----------|
| 2.1 | **Automation Rules Engine** — New `automation/` module with rule evaluation, trigger conditions, action executors | High | Low | Remove module |
| 2.2 | **Template System** — New `templates/` module with CRUD for listing templates, Handlebars/Liquid rendering | High | Low | Remove module |
| 2.3 | **Amazon Adapter** — Real Amazon SP-API integration in channels module (parallel to existing stubs) | High | Low | Revert to stubs |
| 2.4 | **Walmart Adapter** — Real Walmart Marketplace API integration | High | Low | Revert to stubs |
| 2.5 | **Inventory Real-Time Sync** — Wire up `inventory` queue producers, webhook receivers for eBay/Shopify stock changes | Medium | Medium | Disable producers |
| 2.6 | **Order Auto-Import** — Wire up `orders` queue with cron schedule (every 15 min) | Medium | Medium | Disable cron |
| 2.7 | **Dashboard Aggregation** — Wire up `dashboard` queue, build real `daily-sales-rollup` | Medium | Low | Disable cron |
| 2.8 | **Bulk Actions UI** — Frontend bulk edit for price, category, images | Medium | Low | Remove components |
| 2.9 | **Auth UI** — Login page, registration, password reset, token refresh | Medium | Medium | — |
| 2.10 | **Pricing Push to Channels** — On pricing rule evaluation, auto-push new prices via existing channel adapters | Medium | Medium | Feature flag off |
| 2.11 | **Audit Trail UI** — Frontend for `audit_logs` table | Low | Low | Remove component |
| 2.12 | **Settings Completion** — Wire "Add" buttons for shipping profiles, pricing rules, tenant config | Low | Low | Revert UI |

**Testing Plan:** Each new module gets unit + integration tests. Feature flags gate all new behavior. API versioning where response shapes change.

---

### Phase 3 — Migration & Optimization (Estimated: 3-4 weeks)

**Goal:** Consolidate, optimize, and remove deprecated code.

| # | Task | Complexity | Risk | Rollback |
|---|------|-----------|------|----------|
| 3.1 | Migrate `startPrice`/`quantity`/cost from TEXT → NUMERIC | High | High | Rollback migration restores TEXT columns |
| 3.2 | Deprecate `channel_listings` table in favor of `listing_channel_instances` | Medium | Medium | Re-enable queries against old table |
| 3.3 | Extract compliance columns from `listing_records` to satellite table | High | Medium | Rollback migration |
| 3.4 | Add PostgreSQL partitioning to `inventory_events`, `audit_logs`, `channel_webhook_logs` | Medium | Medium | Detach partitions |
| 3.5 | Implement API v2 for modified response shapes | Medium | Low | Keep v1 running |
| 3.6 | Add React Query / TanStack Query for frontend API caching | Medium | Low | Remove wrapper |
| 3.7 | Add multi-tenant/org model for enterprise scalability | High | High | Feature flag off |
| 3.8 | Performance tuning: connection pool, query optimization, Redis caching | Medium | Low | Revert config |
| 3.9 | Remove all dead code and deprecated modules | Low | Low | Restore from git |

**Testing Plan:** Full regression suite before each optimization. Load testing for performance changes. Data integrity validation for schema migrations.

---

## 5. DB MIGRATION PLAN

### Migration 1: Schema Consolidation (Phase 1)

```sql
-- Migration: AddMissingSchemaObjects
-- Safe: Additive only, no modifications to existing structures

-- 1. Create tables that exist only in raw SQL
CREATE TABLE IF NOT EXISTS stores ( ... );            -- From multi_store_migration.sql
CREATE TABLE IF NOT EXISTS listing_channel_instances ( ... );
CREATE TABLE IF NOT EXISTS ai_enhancements ( ... );
CREATE TABLE IF NOT EXISTS demo_simulation_logs ( ... );

-- 2. Add columns that exist only in raw SQL
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS "extractedMake" varchar(100);
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS "extractedModel" varchar(100);
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- 3. Add missing FKs (NO ACTION to avoid cascade surprises)
ALTER TABLE listing_revisions 
  ADD CONSTRAINT fk_revision_listing 
  FOREIGN KEY ("listingId") REFERENCES listing_records(id) ON DELETE NO ACTION;

ALTER TABLE order_items 
  ADD CONSTRAINT fk_order_item_listing 
  FOREIGN KEY (listing_id) REFERENCES listing_records(id) ON DELETE SET NULL;

ALTER TABLE sales_records 
  ADD CONSTRAINT fk_sales_listing 
  FOREIGN KEY ("listingId") REFERENCES listing_records(id) ON DELETE SET NULL;

ALTER TABLE sales_records 
  ADD CONSTRAINT fk_sales_order 
  FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE inventory_events 
  ADD CONSTRAINT fk_inv_event_listing 
  FOREIGN KEY (listing_id) REFERENCES listing_records(id) ON DELETE CASCADE;

-- 4. Add missing indexes
CREATE INDEX IF NOT EXISTS idx_listing_status ON listing_records(status);
CREATE INDEX IF NOT EXISTS idx_listing_ebay_id ON listing_records("ebayListingId");
CREATE INDEX IF NOT EXISTS idx_listing_shopify_id ON listing_records("shopifyProductId");
CREATE INDEX IF NOT EXISTS idx_listing_deleted_at ON listing_records("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS idx_listing_updated_at ON listing_records("updatedAt");
CREATE INDEX IF NOT EXISTS idx_lci_sync_updated ON listing_channel_instances(sync_status, updated_at);
```

**Rollback Script:**
```sql
DROP INDEX IF EXISTS idx_lci_sync_updated;
DROP INDEX IF EXISTS idx_listing_updated_at;
DROP INDEX IF EXISTS idx_listing_deleted_at;
DROP INDEX IF EXISTS idx_listing_shopify_id;
DROP INDEX IF EXISTS idx_listing_ebay_id;
DROP INDEX IF EXISTS idx_listing_status;
ALTER TABLE inventory_events DROP CONSTRAINT IF EXISTS fk_inv_event_listing;
ALTER TABLE sales_records DROP CONSTRAINT IF EXISTS fk_sales_order;
ALTER TABLE sales_records DROP CONSTRAINT IF EXISTS fk_sales_listing;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_item_listing;
ALTER TABLE listing_revisions DROP CONSTRAINT IF EXISTS fk_revision_listing;
-- Note: Do NOT drop tables/columns that may have been populated
```

### Migration 2: Feature Flag Table (Phase 1)

```sql
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('automation_rules', false, 'Enable automation rules engine'),
  ('template_system', false, 'Enable listing templates'),
  ('amazon_integration', false, 'Enable Amazon SP-API integration'),
  ('walmart_integration', false, 'Enable Walmart API integration'),
  ('inventory_real_time_sync', false, 'Enable real-time inventory sync from channels'),
  ('order_auto_import', false, 'Enable scheduled order import from channels'),
  ('pricing_auto_push', false, 'Enable automatic price pushing to channels')
ON CONFLICT (key) DO NOTHING;
```

### Migration 3: Price Type Migration (Phase 3)

```sql
-- Step 1: Add new numeric columns alongside text ones
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS start_price_num NUMERIC(12,2);
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS quantity_num INTEGER;
ALTER TABLE listing_records ADD COLUMN IF NOT EXISTS buy_it_now_price_num NUMERIC(12,2);

-- Step 2: Backfill (safe, non-blocking)
UPDATE listing_records SET
  start_price_num = NULLIF(REPLACE(REPLACE("startPrice", ',', '.'), ' ', ''), '')::NUMERIC,
  quantity_num = NULLIF(REPLACE("quantity", ' ', ''), '')::INTEGER,
  buy_it_now_price_num = NULLIF(REPLACE(REPLACE("buyItNowPrice", ',', '.'), ' ', ''), '')::NUMERIC
WHERE start_price_num IS NULL AND "startPrice" IS NOT NULL;

-- Step 3: Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_listing_price_num ON listing_records(start_price_num);
CREATE INDEX IF NOT EXISTS idx_listing_qty_num ON listing_records(quantity_num);

-- Step 4: (Later, after application code migrated) Drop old text columns
-- ALTER TABLE listing_records DROP COLUMN "startPrice";
-- This is Phase 3 cleanup, not automated
```

**Rollback:**
```sql
DROP INDEX IF EXISTS idx_listing_qty_num;
DROP INDEX IF EXISTS idx_listing_price_num;
ALTER TABLE listing_records DROP COLUMN IF EXISTS buy_it_now_price_num;
ALTER TABLE listing_records DROP COLUMN IF EXISTS quantity_num;
ALTER TABLE listing_records DROP COLUMN IF EXISTS start_price_num;
```

### Migration 4: Automation Rules (Phase 2)

```sql
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL,  -- 'schedule', 'event', 'condition'
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type VARCHAR(50) NOT NULL,   -- 'update_price', 'sync_inventory', 'publish', 'notify'
  action_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auto_rules_trigger ON automation_rules(trigger_type, enabled);
CREATE INDEX idx_auto_rules_enabled ON automation_rules(enabled) WHERE enabled = true;
```

### Migration 5: Listing Templates (Phase 2)

```sql
CREATE TABLE IF NOT EXISTS listing_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  channel VARCHAR(30),           -- NULL = all channels
  category VARCHAR(100),
  template_type VARCHAR(30) NOT NULL DEFAULT 'description', -- 'description', 'title', 'full'
  content TEXT NOT NULL,          -- Handlebars/Liquid template
  css TEXT,                       -- Optional custom CSS
  preview_image TEXT,             -- S3 URL for template preview
  variables JSONB DEFAULT '[]',   -- Expected variables
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_channel ON listing_templates(channel, active);
CREATE INDEX idx_template_type ON listing_templates(template_type);
```

---

## 6. API IMPACT ANALYSIS

### Existing APIs — NO CHANGES Required

All existing API endpoints continue to function as-is. No response shapes are modified.

| Module | Endpoints | Impact |
|--------|-----------|--------|
| `/api/listings/*` | 12 endpoints | None — additive only |
| `/api/channels/*` | 15 endpoints | None — new endpoints added alongside |
| `/api/ingestion/*` | 8 endpoints | None |
| `/api/orders/*` | 6 endpoints | None — import enhancement is backend-only |
| `/api/inventory/*` | 10 endpoints | None — sync is backend-only |
| `/api/dashboard/*` | 5 endpoints | None — aggregation is backend-only |
| `/api/settings/*` | 6 endpoints | None |
| `/api/auth/*` | 3 endpoints | None |

### New API Endpoints (Phase 2)

| Method | Route | Purpose | Module |
|--------|-------|---------|--------|
| GET | `/api/automation-rules` | List automation rules | automation |
| POST | `/api/automation-rules` | Create rule | automation |
| PATCH | `/api/automation-rules/:id` | Update rule | automation |
| DELETE | `/api/automation-rules/:id` | Delete rule | automation |
| POST | `/api/automation-rules/:id/execute` | Manual trigger | automation |
| GET | `/api/templates` | List templates | templates |
| POST | `/api/templates` | Create template | templates |
| PATCH | `/api/templates/:id` | Update template | templates |
| DELETE | `/api/templates/:id` | Delete template | templates |
| POST | `/api/templates/:id/preview` | Render preview | templates |
| GET | `/api/feature-flags` | List feature flags | common |
| PATCH | `/api/feature-flags/:key` | Toggle flag | common |
| GET | `/api/audit-logs` | List audit logs (paginated) | dashboard |
| GET | `/api/v2/listings` | Enhanced listing response | listings |

### Versioning Strategy

- **v1 (current):** Maintained indefinitely. No changes.
- **v2 (Phase 3):** Only introduced when response shapes change (e.g., numeric prices instead of string). Both versions served simultaneously.

---

## 7. ROLLBACK PLAN

### Per-Phase Rollback Strategy

| Phase | Rollback Mechanism | Time to Rollback | Data Loss Risk |
|-------|-------------------|-------------------|----------------|
| Phase 1 | Git revert + rollback migration SQL | < 15 min | None (additive only) |
| Phase 2 | Feature flags → disable + git revert | < 5 min (flags) / < 15 min (full) | None (new modules are isolated) |
| Phase 3 | Rollback migration SQL + git revert | < 30 min | Low (dual columns during transition) |

### Emergency Rollback Procedures

**If Phase 1 migration fails:**
1. Run rollback SQL script (drops new constraints/indexes only)
2. `git revert` the migration file
3. Restart application — old behavior restored

**If Phase 2 new module causes issues:**
1. Set feature flag to `false` — immediate disable without deploy
2. If persistent, `git revert` the module directory
3. Restart — new routes return 404, frontend gracefully degrades

**If Phase 3 schema migration corrupts data:**
1. Stop application
2. Run rollback SQL (drops new numeric columns, restores to Phase 2 state)
3. Restore from backup if needed (text columns are untouched during transition)
4. Restart on Phase 2 codebase

### Backup Requirements

| Phase | Backup Before | Type |
|-------|--------------|------|
| Phase 1 | Each migration | DB snapshot (pg_dump) |
| Phase 2 | Module activation | DB snapshot + Redis snapshot |
| Phase 3 | Schema changes | Full DB backup + application state |

---

## 8. TEST PLAN

### Phase 1 Testing

| Test Type | Scope | Tool |
|-----------|-------|------|
| **Unit** | New migration up/down scripts | Jest + TypeORM test connection |
| **Unit** | Channel processor job name routing | Jest mock |
| **Unit** | Feature flag service get/set/toggle | Jest |
| **Integration** | Event emission from processors → notification triggers | NestJS testing module |
| **Integration** | Cron scheduler firing → queue job enqueue | BullMQ test utilities |
| **Smoke** | All existing API endpoints return same responses | Supertest snapshot tests |
| **Build** | Frontend builds without dead code | Vite build check |

### Phase 2 Testing

| Test Type | Scope | Tool |
|-----------|-------|------|
| **Unit** | Automation rule evaluation engine | Jest |
| **Unit** | Template rendering (Handlebars) | Jest |
| **Unit** | Amazon/Walmart adapter request building | Jest mock |
| **Integration** | Automation rule trigger → action executor → DB state | NestJS testing module |
| **Integration** | Order import pipeline (mock external API) | Nock + Jest |
| **Integration** | Inventory sync webhook → ledger update | Supertest |
| **E2E** | Auth flow: register → login → token → protected route | Supertest |
| **E2E** | Bulk edit: select 10 listings → change price → verify | Playwright |
| **Regression** | All Phase 1 tests still pass | CI/CD gate |

### Phase 3 Testing

| Test Type | Scope | Tool |
|-----------|-------|------|
| **Data Integrity** | TEXT → NUMERIC migration: verify all values convert correctly | SQL validation query |
| **Data Integrity** | No orphaned records after FK addition | SQL count checks |
| **Performance** | Query execution plans with new indexes | EXPLAIN ANALYZE |
| **Performance** | Listing API response time < 200ms (p95) | Artillery load test |
| **Performance** | 10K concurrent inventory updates without deadlocks | Custom load script |
| **Regression** | Full suite: all Phase 1 + Phase 2 tests | CI/CD gate |
| **API Contract** | v1 responses unchanged, v2 responses valid | JSON Schema validation |

### Continuous Regression Tests (Run on Every Deploy)

```
1. Health check: GET /api/health → 200
2. Listing CRUD: Create → Read → Update → Delete cycle
3. Channel connection list: GET /api/channels/connections → valid array
4. Inventory ledger read: GET /api/inventory/ledger/:id → valid object
5. Order list: GET /api/orders → valid paginated response
6. Dashboard summary: GET /api/dashboard/summary → valid metrics
7. Ingestion job create: POST /api/ingestion/jobs → valid job ID
8. Image upload: POST /api/storage/upload → presigned URL returned
9. Auth: POST /api/auth/login → valid JWT
10. WebSocket: Connect to /notifications → handshake succeeds
```

---

## APPENDIX A: Dead Code Inventory

### Frontend Dead Files (Safe to Remove)

| File | Size | Reason |
|------|------|--------|
| `src/data/generatedInventory.ts` | 72,834 lines | Never imported; massively inflates bundle |
| `src/data/inventory.ts` | ~200 lines | Never imported; superseded by API |
| `src/lib/catalogSearch.ts` | ~100 lines | Never imported; search uses `searchApi.ts` |
| `src/lib/fitmentSearch.ts` | ~100 lines | Never imported |
| `src/lib/channelAdapters.ts` | ~150 lines | Never imported; channels use `channelsApi.ts` |
| `src/lib/inventorySync.ts` | ~100 lines | Never imported |

### Backend Dead Processors

| Processor | Queue | Issue |
|-----------|-------|-------|
| `CleanupProcessor` | `storage-cleanup` | No producer |
| `InventorySyncProcessor` | `inventory` | No producer for any of 3 job types |
| `OrderImportProcessor` | `orders` | No producer for either job type |
| `AggregationProcessor` | `dashboard` | No producer for either job type |

### Backend Dead Event Handlers

| Handler | Event | Issue |
|---------|-------|-------|
| `onIngestionComplete` | `ingestion.completed` | Never emitted |
| `onIngestionFailed` | `ingestion.failed` | Never emitted |
| `onReviewNeeded` | `ingestion.review_needed` | Never emitted |
| `onChannelConnected` | `channel.connected` | Never emitted |
| `onChannelError` | `channel.error` | Never emitted |
| `onListingPublished` | `listing.published` | Never emitted |
| `onLowStock` | `inventory.low_stock` | Never emitted |
| `onOutOfStock` | `inventory.out_of_stock` | Never emitted |
| `onNewOrder` | `order.new` | Never emitted |
| `onOrderShipped` | `order.shipped` | Never emitted |
| `onSystemAlert` | `system.alert` | Never emitted |

---

## APPENDIX B: Environment Variables Catalog

| Variable | Required | Used By | Notes |
|----------|----------|---------|-------|
| `DB_HOST` | Yes | data-source.ts | PostgreSQL host |
| `DB_PORT` | Yes | data-source.ts | Default: 5432 |
| `DB_USERNAME` | Yes | data-source.ts | |
| `DB_PASSWORD` | Yes | data-source.ts | |
| `DB_DATABASE` | Yes | data-source.ts | |
| `REDIS_HOST` | Yes | app.module.ts | BullMQ connection |
| `REDIS_PORT` | Yes | app.module.ts | Default: 6379 |
| `REDIS_PASSWORD` | No | app.module.ts | |
| `JWT_SECRET` | Yes | auth.module.ts | Token signing |
| `JWT_EXPIRATION` | No | auth.module.ts | Default: '7d' |
| `ENCRYPTION_KEY` | Yes | channels.service.ts | AES-256-GCM for OAuth tokens |
| `AWS_ACCESS_KEY_ID` | Yes | storage.service.ts | S3 access |
| `AWS_SECRET_ACCESS_KEY` | Yes | storage.service.ts | |
| `AWS_REGION` | Yes | storage.service.ts | |
| `S3_BUCKET` | Yes | storage.service.ts | |
| `CDN_URL` | No | storage.service.ts | CloudFront distribution URL |
| `OPENAI_API_KEY` | Yes | ingestion | GPT-4o Vision |
| `EBAY_APP_ID` | Yes | channels | eBay OAuth |
| `EBAY_CERT_ID` | Yes | channels | |
| `EBAY_REDIRECT_URI` | Yes | channels | |
| `SHOPIFY_API_KEY` | Yes | channels | |
| `SHOPIFY_API_SECRET` | Yes | channels | |
| `CORS_ORIGINS` | No | main.ts | Comma-separated list |
| `PORT` | No | main.ts | Default: 3000 |
| `NODE_ENV` | No | Various | 'production', 'development' |

---

*End of audit report. Proceed to Phase 1 implementation upon approval.*
