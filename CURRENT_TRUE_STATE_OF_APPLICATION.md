# Current True State of the Application

> **Generated**: 2026-06-11 via comprehensive codebase analysis.
> This document reflects the **actual implemented state** of RealTrackApp as verified against the codebase, not what documentation claims or what was originally planned. Where uncertainty exists, items are marked **🔍 Needs Verification**.

---

## Executive Summary

RealTrackApp (internal DB name: `listingpro`) is a **substantial, actively-developed full-stack automotive parts listing and operations platform**. The architecture is mature and well-structured: 23 NestJS backend modules, 82 TypeORM entities mapping to 78 database tables, 27 migrations, 14 BullMQ queues, 10 scheduled cron jobs, 38 REST controllers exposing ~200+ endpoints, 37 frontend routes with 67 React components, and a sophisticated RBAC system with 73 permissions across 8 roles.

**eBay is the only fully-implemented marketplace integration.** SellerPundit acts as an eBay connection source (not a separate channel). Shopify, Amazon, and Walmart are scaffolding only — no functional implementation exists.

The AI enrichment and model routing system is the most sophisticated subsystem, featuring a 5-lane model router with price-band-based routing, canary A/B testing, quality guards, escalation chains, and a nightly optimizer. The pipeline processes automotive parts through vision AI, text enrichment, fitment extraction, eBay taxonomy resolution, and multi-marketplace localization (US/AU/DE).

**Key risks**: Zero frontend tests, 24 backend spec files (unit only, no e2e), client-side-only JWT logout (no server revocation), inconsistent tenant isolation, DEBUG logging of JWT tokens in auth code, and two confirmed routing bugs (double `/api` prefix).

**Documentation accuracy**: The existing documentation set is **generally accurate but outdated in specific counts and details**. Migration count is 27 (docs say 21), entity count is 82 (docs say ~79), permission count is 73 (docs say ~90), and test count is 24 spec files (docs say 9). The SellerPundit integration, AI routing system, and listing-optimization pipeline are substantial features that are underdocumented relative to their complexity.

---

## Application Purpose and Business Context

**What it does**: Enables automotive parts sellers to manage their entire catalog-to-marketplace workflow:
1. Import product data via CSV/bulk upload
2. Enrich products with AI (OpenAI vision + text analysis)
3. Extract and validate vehicle fitment (YMMT — Year/Make/Model/Trim)
4. Publish listings to eBay (multi-store, multi-account, multi-marketplace)
5. Sync inventory and import orders from eBay
6. Manage pricing, compliance, and team collaboration via RBAC

**Target users**: Mid-market and enterprise automotive parts sellers, catalog managers, listing specialists, e-commerce operations teams, platform owners (super_admin white-label).

**Business name**: "RealTrackApp" (shell/frontend) vs "ListingPro" (database name, login screen). This inconsistency is a known branding issue.

---

## Current Architecture Overview

### Tech Stack (Verified)

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Frontend | React + Vite + TypeScript + Tailwind CSS | React 18, Vite 6 | ✅ Verified |
| Routing | React Router | v7 | ✅ Verified |
| Server State | TanStack Query | v5 | ✅ Verified |
| Backend | NestJS + TypeORM | NestJS 11, TypeORM 0.3 | ✅ Verified |
| Database | PostgreSQL | 16 (alpine) | ✅ Verified |
| Cache/Queues | Redis + BullMQ | Redis 7 (alpine) | ✅ Verified |
| Realtime | Socket.IO | via @nestjs/websockets | ✅ Verified |
| AI | OpenAI (via OpenRouter) | Multiple models | ✅ Verified |
| Storage | AWS S3 | + Sharp thumbnails | ✅ Verified |
| Auth | JWT + Passport | bcrypt 12 rounds | ✅ Verified |
| Infra | Docker Compose | 4 services | ✅ Verified |
| HTTP Client (FE) | Native fetch (via fetchWithAuth) | — | ✅ axios declared but unused |

### Ports (Verified)

| Service | Port | Notes |
|---------|------|-------|
| Backend (NestJS) | 4191 | Global prefix `/api`; Swagger at `/api/docs` |
| Frontend (Vite dev) | 3911 | Proxies `/api` → `localhost:4191` |
| Frontend (Docker/nginx) | 8050 | Serves built assets, reverse-proxies `/api` |
| PostgreSQL | 5432 | `DB_PORT_EXTERNAL` |
| Redis | 6379 | `REDIS_PORT_EXTERNAL` |

### Guard Architecture (Verified)

Global guards applied in order via `APP_GUARD`:
1. `ThrottlerGuard` — Rate limiting: 10/s, 100/min, 1000/hr
2. `JwtAuthGuard` — Authentication; `@Public()` opts out
3. `PermissionsGuard` — RBAC; `@RequirePermissions('module.action')` required

Global `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

---

## Frontend State

### Route Table (37 routes, verified against `src/App.tsx`)

- **4 public routes**: `/login`, `/register`, `/forgot-password`, `/channels/ebay/callback`
- **33 protected routes**: All wrapped in `<ProtectedRoute>` with permission gates
- **22 unique permission keys** used across routes
- **4 settings routes** lack specific permission gates (rely on auth only): `/settings/client`, `/settings/users`, `/settings/permissions`, `/settings/ai-routing`

### Component Inventory (67 components across 22 domain directories)

| Domain | Component Count | Key Components |
|--------|----------------|----------------|
| catalog | 10 | CatalogManager, CatalogProductDetail, EbayPublishWizardPage, BulkActionsPage |
| settings | 8 | SettingsPage, ClientSettingsPage, UsersAdminPage, PermissionsPage, AiRoutingDashboardPage |
| catalog-import | 7 | CatalogImportDashboard, CatalogMotorsFiltersPage, ColumnMapper, CompliancePanel |
| auth | 7 | LoginPage, RegisterPage, ForgotPasswordPage, ProtectedRoute, AuthContext |
| motors | 4 | MotorsDashboard, MotorsProductDetail, ReviewQueue, AIUploadWizard |
| pipeline | 4 | PipelineWizard, EnrichmentStatusPanel, ImageEnrichmentPanel, OptimizationStatusPanel |
| sku | 4 | SkuDetailPage, ChannelStorePanel, InventoryPanel, AiEnhancementsPanel |
| channels | 3 | ChannelListingPanel, EbayOAuthCallback, PublishModal |
| ui | 3 | SearchableSelect, card, badge |
| Others (13 dirs) | 17 | ListingEditor, RevisionHistory, FitmentManager, InventoryManager, OrdersPage, etc. |

### API Clients (22 files in `src/lib/`)

All use native `fetch` via `fetchWithAuth` wrapper (not axios, despite it being a dependency).

| Client | Backend Prefix | Status |
|--------|---------------|--------|
| authApi.ts | `/api/auth` | ✅ Working |
| listingsApi.ts | `/api/listings` | ✅ Working |
| catalogImportApi.ts | `/api/imports` | 🔍 Verify path match |
| catalogProductsApi.ts | `/api/catalog` | 🔍 Verify path match |
| motorsApi.ts | `/api/motors` | 🔍 Verify path match |
| ebayIntegrationsApi.ts | `/api/integrations/ebay` | ✅ Working |
| multiStoreApi.ts | `/api/multi-store` | 🔍 Verify path match |
| ordersApi.ts | `/api/orders` | ✅ Working |
| inventoryApi.ts | `/api/inventory` | ✅ Working |
| fitmentApi.ts | `/api/fitment` | ✅ Working |
| channelsApi.ts | `/api/channels` | ✅ Working |
| publishApi.ts | `/api/channels/ebay` | ✅ Working |
| pipelineApi.ts | `/api/pipeline` | ✅ Working |
| pricingApi.ts | `/api/pricing` | ✅ Working (orphaned — no route) |
| rbacApi.ts | `/api/rbac` | ✅ Working |
| clientBrandingApi.ts | `/api/branding` | 🔍 Verify path match |
| templateApi.ts | `/api/templates` | ✅ Working |
| searchApi.ts | `/api/search` | 🔍 Used internally |
| aiRoutingApi.ts | `/api/ai-routing` | 🔍 Verify path match |
| listingGenerationApi.ts | `/api/listings/generate*` | ✅ Working |
| sellerpunditIntegrationsApi.ts | `/api/integrations/ebay/sellerpundit` | ✅ Working |
| ingestionPipeline.ts | — | Pipeline helpers |

### Frontend Architecture Issues

| Issue | Severity | Details |
|-------|----------|---------|
| **Zero test files** | ⚠️ High | No `.test.*`, `.spec.*`, or `__tests__/` directories anywhere in `src/` |
| **No code splitting** | ⚠️ Medium | All 37 routes eagerly imported; no `React.lazy()` or dynamic imports |
| **axios unused** | ℹ️ Low | Listed in `package.json` but all API calls use native `fetch` |
| **Orphaned PricingDashboard** | ℹ️ Low | `src/components/pricing/PricingDashboard.tsx` exists with `pricingApi.ts` but has no route in `App.tsx` |
| **Dual listing API layers** | ℹ️ Low | Both `listingsApi.ts` (imperative) and `listingsQueryHooks.ts` (TanStack Query) coexist — in-progress migration |
| **Permission gaps on settings** | ⚠️ Medium | `/settings/client`, `/settings/users`, `/settings/permissions`, `/settings/ai-routing` have no specific permission check — any authenticated user can access |

---

## Backend State

### Module Count: **23 modules** imported in `app.module.ts` ✅ Verified

Additional modules exist transitively:
- `SellerpunditModule` — imported by `EbayIntegrationsModule`
- `AiModule` — imported by `IngestionModule`
- `ListingOptimizationModule` — imported by `IngestionModule` (re-exported)

### Controller Count: **37 files, 38 controller classes** ✅ Verified

(The `dashboard.controller.ts` exports both `DashboardController` and `AuditLogController`.)

### Key Backend Statistics

| Metric | Actual Count | Docs Claim | Discrepancy |
|--------|-------------|------------|-------------|
| Modules in app.module.ts | 23 | 23 | ✅ Match |
| Controllers | 38 classes | Not stated | — |
| Entity files | 82 | ~79 | +3 |
| Services | 95 | Not stated | — |
| Processors (BullMQ) | 15 | Not stated | — |
| Migrations | **27** | **21** | **+6 outdated** |
| BullMQ queues | 14 | ~16 | -2 (docs overcount) |
| Scheduled cron jobs | 10 | Not stated | — |
| Permissions | **73** | **~90** | **-17 (docs overcount)** |
| Roles | 8 | 8 | ✅ Match |
| Spec files | 24 | 9 | **+15 outdated** |

### Confirmed Bugs

#### Double `/api` Prefix ⚠️ CONFIRMED

Two controllers manually include `api/` in their `@Controller()` decorator, which combines with the global prefix to produce double-prefixed routes:

| Controller | Decorator | Actual Runtime Path |
|------------|-----------|-------------------|
| `feature-flag.controller.ts` | `@Controller('api/feature-flags')` | `/api/api/feature-flags` ❌ |
| `export-rule.controller.ts` | `@Controller('api/export-rules')` | `/api/api/export-rules` ❌ |

**Fix**: Remove `api/` from both decorators. All other 36 controllers are correct.

#### DEBUG Logging of JWT Tokens ⚠️ NEW FINDING

`auth.service.ts` and `jwt.strategy.ts` log JWT secret prefixes and full tokens to console with `[DEBUG]` markers. **Must be removed or gated behind a DEBUG env flag before production deployment.**

---

## Database State

### Engine Configuration

| Setting | Value | Status |
|---------|-------|--------|
| Engine | PostgreSQL 16 | ✅ |
| ORM | TypeORM 0.3 | ✅ |
| DB_SYNCHRONIZE | `false` (default) | ✅ Correct |
| DB_MIGRATIONS_RUN | `false` (default, `true` in Docker) | ✅ |
| Connection pool | max=20, min=5 | 🔍 Changed to 10/2 in .env.example for t3.medium |
| Statement timeout | 30s | ✅ |
| Transaction mode | `each` (per migration) | ✅ |

### Entity Inventory (82 entity files, 78 unique tables)

| Module Domain | Entity Count | Key Tables |
|---------------|-------------|------------|
| eBay Integration | 15 | connected_ebay_accounts, ebay_oauth_tokens, ebay_account_marketplaces, ebay_business_policies, ebay_listing_channels, ebay_listing_jobs, ebay_listing_job_targets, ebay_listing_sync_logs, ebay_api_audit_logs, ebay_api_errors, listing_action_logs, inventory_movements, listing_store_overrides, internal_stores, organization_sellerpundit_config |
| Motors Intelligence | 10 | motors_products, product_candidates, extracted_attributes, validation_results, review_tasks, listing_generations, correction_rules, motors_feedback_logs, ebay_category_mappings, ebay_aspect_requirements |
| Listings | 10 | listing_records, listing_revisions, listing_compliance, master_products, ebay_offers, ebay_categories, cross_references, competitor_prices, market_snapshots, export_rules |
| Fitment | 7 | fitment_makes, fitment_models, fitment_submodels, fitment_years, fitment_engines, part_fitments, vin_cache |
| Channels | 6 | channel_connections, channel_listings, channel_webhook_logs, stores, listing_channel_instances, demo_simulation_logs |
| Catalog Import | 4 | catalog_products, catalog_imports, catalog_import_rows, compliance_audit_logs |
| Auth | 3 | users, organizations, organization_members |
| RBAC | 4 | roles, permissions, role_permissions, user_roles |
| Inventory | 3 | inventory_ledger, inventory_events, store_inventory_allocations |
| Orders | 2 | orders, order_items |
| Dashboard/Audit | 3 | audit_logs, dashboard_metrics_cache, sales_records |
| Settings | 3 | tenant_settings, shipping_profiles, pricing_rules |
| Ingestion/Pipeline | 3 | ingestion_jobs, ai_results, pipeline_jobs |
| AI Routing | 2 | ai_run_logs, ai_routing_policy_history |
| Notifications | 1 | notifications |
| Automation | 1 | automation_rules |
| Templates | 1 | listing_templates |
| Storage | 1 | image_assets |
| Client Settings | 1 | client_settings |
| Feature Flags | 1 | feature_flags |
| AI Enhancements | 1 | ai_enhancements |

### Migration Count: **27** (not 21 as documented)

6 additional migrations beyond what docs claim:

| Migration | Purpose | Added After Doc Count |
|-----------|---------|----------------------|
| `1775500000000-AddAiEnhancementConfidenceScore.ts` | AI enhancement confidence | Yes |
| `1775600000000-SellerPunditExtensions.ts` | SellerPundit integration | Yes |
| `1775700000000-AiRunLogsAndRoutingPolicy.ts` | AI routing | Yes |
| `1775710000000-AddComplianceScoreToAiRunLogs.ts` | AI compliance | Yes |
| `1775710000001-AddListingRecordPipelineMarketplace.ts` | Pipeline marketplace | Yes |
| `1775800000000-AddOptimizationByMarketplace.ts` | Optimization marketplace | Yes |

### Seed Data

| Seed | Method | Status |
|------|--------|--------|
| `listingpro.dump` | Auto-restored on first Postgres volume init | ✅ |
| RBAC roles/permissions | `RbacSeedService.syncFromRegistry()` on boot | ✅ |
| Demo users (5) | Created when `SEED_DEMO_USERS=true` | ✅ |
| Demo eBay sandbox | `seed-demo-ebay.ts` CLI script | ✅ |

### Database Risks

| Risk | Status | Details |
|------|--------|---------|
| TEXT-typed price columns | 🟡 Partially fixed | `Phase3PriceTypesMigration` added `startPriceNum`/`quantityNum` but TEXT columns remain |
| Missing foreign keys | 🔍 Needs audit | Prior audit flagged missing FKs on listing_revisions, order_items, sales_records, inventory_events |
| Dual channel tables | 🟡 In progress | Both `channel_listings` (deprecated) and `listing_channel_instances` (new) exist |
| Tables not from migrations | 🔍 Needs verification | Prior audit noted some tables were created outside migration system |
| JSONB-heavy schema | ℹ️ Info | ~50+ JSONB columns across entities — flexible but harder to query/index |

---

## API and Integration State

### Total Endpoints: **~200+** across 38 controllers

### Swagger/OpenAPI

✅ Configured at `/api/docs` in non-production. Uses `@nestjs/swagger` decorators. Auto-generated from controller metadata.

### eBay Integration (✅ Fully Implemented)

The most mature integration, spanning two modules:

**`integrations/ebay/`** (15 entities, 3 controllers, 3 processors):
- Multi-account OAuth flow with encrypted token storage
- Multi-store management (InternalStore, StoreInventoryAllocation)
- Business policy sync (fulfillment, payment, return)
- Listing publish/revise/end/delete via BullMQ
- Order sync (scheduled every 15 min)
- Inventory sync (scheduled every 2 hours)
- API audit and error logging
- Marketplace support: EBAY_MOTORS_US, EBAY_US, EBAY_DE, EBAY_GB, EBAY_AU

**`channels/ebay/`** (1 controller):
- Publish wizard: single, batch, and by-listings endpoints
- Offer management (price/quantity updates, end listings)
- Condition mapping, image validation, title normalization
- Direct eBay Inventory API and SellerPundit paths

**SellerPundit Integration** (✅ Fully Implemented, 19 files):
- eBay store import via SellerPundit token list
- Policy sync from SellerPundit API
- Listing publish via `bulk-create-using-api`
- Token management (2-min max age, auto-refresh)
- Marketplace inference from account names
- Fallback to direct eBay API on SellerPundit platform errors
- P&A return policy compliance validation

### OpenAI / AI System (✅ Fully Implemented, 39 files)

**Architecture** (4 layers):
1. **Core Client**: OpenRouter-compatible with rate-limit retry, exponential backoff, per-lane cost tracking
2. **Routing & Optimization**: 5-lane model router with price-band routing, canary A/B, nightly optimizer
3. **Quality & Guards**: Post-AI deterministic guards (MPN normalization, title limits, fitment dedup)
4. **Pipelines** (6): enrichment, vision-enrichment, listing-generation, competitive-analysis, cross-reference, pricing-analysis

**Model Lanes**:

| Lane | Default Model | Use Case |
|------|--------------|----------|
| default | `openai/gpt-4.1-mini` | Standard enrichment |
| flagship | `google/gemini-2.5-flash` | High-value parts (≥$200) or complex types |
| bulk | `deepseek/deepseek-chat-v3-0324` | Bulk/batch processing |
| escalation | `google/gemini-2.5-flash` | Retry after failure |
| text | `openai/gpt-4o-mini` | Low-cost text-only tasks |

**AI Optimizer**: Nightly cron (`0 2 * * *`), disabled by default (`AI_OPTIMIZER_ENABLED`). Reward function considers approval rate, pass rate, compliance, cost, escalation, hard fail rate, and publish error rate.

**Blocklisted models**: `amazon/nova-lite-v1`, `anthropic/claude-3.5-haiku`, `meta-llama/llama-3.3-70b-instruct` (failed JSON at batch size 8).

### Non-eBay Channels (❌ Scaffolding Only)

Shopify, Amazon, and Walmart appear in channel abstractions and entity structures but have **no functional implementation**. The `ChannelConnection` entity supports `channel` values beyond `ebay` but no code processes them.

---

## Authentication and Permissions State

### Authentication (✅ Working)

| Component | Status | Details |
|-----------|--------|---------|
| JWT Bearer tokens | ✅ | Passport JWT strategy, 24h expiry |
| Login | ✅ | `POST /api/auth/login` → JWT + audit log |
| Register | ✅ | `POST /api/auth/register` → user + staff role + default org |
| Me | ✅ | `GET /api/auth/me` → profile + permissions + orgs |
| Logout | ✅ (client-side) | Audit log only; no server token revocation |
| Password hashing | ✅ | bcrypt, 12 rounds |
| Token extraction | ✅ | `Authorization: Bearer` header OR `?token=` query param |
| Forgot password | 🔍 | UI exists at `/forgot-password`; backend reset endpoint not found |

### RBAC (✅ Working)

| Component | Status | Count/Details |
|-----------|--------|---------------|
| System roles | ✅ | 8 roles |
| Permissions | ✅ | **73 permissions** (docs say ~90 — overcounted) |
| Permission format | ✅ | `module.action` naming |
| Permission registry | ✅ | `backend/src/rbac/permission-registry.ts` (source of truth) |
| DB sync | ✅ | `RbacSeedService.syncFromRegistry()` on module init |
| Guard enforcement | ✅ | `PermissionsGuard` checks `@RequirePermissions()` decorator |
| Legacy role bridge | ✅ | `LEGACY_USER_ROLE_TO_SLUG` maps legacy user.role to RBAC slugs |
| Admin API | ✅ | User CRUD, role management at `/api/rbac/*` |
| Frontend enforcement | ✅ | `ProtectedRoute` + `usePermissions` hook + `<Can>` component |
| Super-admin protection | ✅ | Cannot deactivate last super_admin or change super_admin role |

### Security Gaps

| Gap | Severity | Status |
|-----|----------|--------|
| No JWT revocation | ⚠️ High | Logout is client-side only; tokens valid until expiry |
| No refresh token rotation | ⚠️ Medium | Single long-lived token (24h) |
| DEBUG JWT logging | ⚠️ High | JWT secrets and full tokens logged to console |
| Default JWT secret fallback | ⚠️ High | Falls back to `dev-secret-change-in-production` |
| Weak tenant isolation | ⚠️ High | `organizationId` enforcement inconsistent across services |
| Settings permission gaps | ⚠️ Medium | 4 settings routes lack specific permission checks |
| Production secret defaults | ⚠️ Medium | `.env.example` has `DB_PASSWORD=postgres`, `JWT_SECRET=CHANGE_ME` |

---

## Core Workflows and Their Actual Status

### 1. Catalog Import → Enrichment → Publish ✅ Implemented

```
CSV Upload → /api/catalog-import/upload
  → BullMQ catalog-import processor (csv-import.processor.ts)
  → Row-by-row matching + insert into catalog_products
  → Pipeline enrichment (pipeline.processor.ts)
    → AI enrichment (model-router → OpenRouter API)
    → Quality guards (listing-guards.ts)
    → Image enrichment (vision-enrichment.pipeline.ts)
    → Localization (AU + DE)
    → Listing optimization (listing-optimization.processor.ts)
  → Review/approve (ingestion/review endpoints)
  → eBay publish (channels/ebay endpoints → ebay-listing-publish.processor.ts)
```

**Status**: ✅ End-to-end functional with extensive error handling, fallback logic, and multi-marketplace support.

### 2. eBay Multi-Store OAuth → Sync → Publish ✅ Implemented

```
OAuth Connect → /api/integrations/ebay (OAuth callback)
  → ConnectedEbayAccount + EbayOAuthToken created
  → Policy sync (ebay-policy-sync queue)
  → Store configuration (EbayAccountMarketplace)
  → Listing publish (ebay-listing-publish queue)
  → Order sync (ebay-order-sync queue, every 15 min)
  → Inventory sync (ebay-inventory-sync queue, every 2 hours)
```

**Status**: ✅ Multi-account, multi-store, multi-marketplace. Includes SellerPundit connection source, direct eBay API path, and fallback logic.

### 3. SellerPundit Store Import → Publish ✅ Implemented

```
SellerPundit Login → /api/integrations/ebay/sellerpundit
  → Store sync (get-all-tokens → ChannelConnection + Store + ConnectedEbayAccount)
  → Policy sync (get-all-policies → EbayBusinessPolicy + marketplace defaults)
  → Listing publish (bulk-create-using-api with direct eBay fallback)
```

**Status**: ✅ Full implementation with marketplace inference, token management, error recovery, and P&A compliance.

### 4. Motors Intelligence Pipeline 🟡 Partially Implemented

```
Upload → /api/motors-intelligence/upload
  → MotorsProduct created
  → AI extraction (motors-pipeline.processor.ts)
  → Product candidates ranked
  → Extracted attributes with confidence scores
  → Validation results
  → Review queue (motors-intelligence/review)
  → Listing generation
```

**Status**: 🟡 Core pipeline works. Review queue exists. AI extraction and validation functional. End-to-end verification with live data needed.

### 5. AI Listing Generation 🟡 Partially Implemented

```
POST /api/listings/generate → ListingGenerationService
  → MasterProduct lookup
  → Template rendering (optional Handlebars)
  → OpenAI generation via ListingGenerationPipeline
  → ExportRule price overrides
  → Optional: draft offer creation or live publish
```

**Status**: 🟡 Code exists and is wired. Quality and reliability of AI-generated listings unverified against production data.

### 6. Inventory Management ✅ Implemented

```
Ledger-based tracking → /api/inventory
  → Quantity adjustments with events
  → Allocations per store
  → Low-stock alerts (every 4 hours)
  → Duplicate scans (daily at 4 AM)
  → Channel inventory sync (every 2 hours)
```

**Status**: ✅ Ledger, allocations, events, and scheduled sync all functional.

### 7. Order Import and Management ✅ Implemented

```
eBay Order Sync → /api/orders
  → Scheduled import (every 15 min)
  → Order + OrderItem creation
  → Status management (ship, refund)
  → Auto-complete (daily at 2 AM)
  → Sales record aggregation
```

**Status**: ✅ eBay order import and management functional.

### 8. RBAC Admin ✅ Implemented

```
User CRUD → /api/rbac/users
  → Role assignment with super_admin protection
  → Permission management via registry sync
  → Frontend admin UI at /settings/users, /settings/permissions
```

**Status**: ✅ Full CRUD, permission sync, role protection.

### 9. Dashboard and KPIs ✅ Implemented

```
GET /api/dashboard → DashboardCache aggregation
  → BullMQ aggregation processor
  → Scheduled refresh (every 30 min)
  → Daily sales rollup (1 AM)
```

**Status**: ✅ KPI aggregation, caching, and scheduled refresh.

### 10. Forgot Password ❌ Not Implemented

```
UI: /forgot-password (ForgotPasswordPage exists)
Backend: No password reset endpoint found
```

**Status**: ❌ Frontend page exists but no backend implementation. Should be hidden or implemented.

### 11. Non-eBay Marketplace Channels ❌ Not Implemented

```
Shopify: @shopify/shopify-api dependency exists, no functional code
Amazon: ChannelConnection.channel supports 'amazon', no processing code
Walmart: ChannelConnection.channel supports 'walmart', no processing code
```

**Status**: ❌ Scaffolding only. No functional implementation for any non-eBay channel.

---

## Feature-by-Feature Implementation Status

| Feature | Status | Evidence |
|---------|--------|----------|
| **Authentication (login/register/me)** | ✅ Implemented | JWT auth, bcrypt, audit logging |
| **RBAC roles & permissions** | ✅ Implemented | 73 permissions, 8 roles, DB-synced, guard-enforced |
| **White-label branding** | ✅ Implemented | ClientSettings entity, public branding endpoint, BrandingContext |
| **Dashboard / KPIs** | ✅ Implemented | BullMQ aggregation, scheduled refresh, cache table |
| **Listing editor (create/edit)** | ✅ Implemented | AI-assisted, revision history, split preview |
| **Listing revision history** | ✅ Implemented | ListingRevision entity with JSONB snapshots |
| **Catalog manager / search** | ✅ Implemented | Faceted search, full-text tsvector, filter sidebar |
| **Catalog CSV/bulk import** | ✅ Implemented | BullMQ processor, column mapping, dedup |
| **Motors filters view** | ✅ Implemented | Catalog-specific motors facet UI |
| **eBay multi-store OAuth** | ✅ Implemented | Multi-account, encrypted tokens, callback flow |
| **eBay publish wizard** | ✅ Implemented | Single/batch/by-listings, multi-store, condition mapping |
| **eBay order sync** | ✅ Implemented | Scheduled every 15 min, BullMQ processor |
| **eBay inventory sync** | ✅ Implemented | Scheduled every 2 hours, per-store allocations |
| **SellerPundit integration** | ✅ Implemented | Store import, policy sync, publish, token management |
| **AI enrichment pipeline** | ✅ Implemented | 5-lane model router, quality guards, multi-market |
| **AI routing optimizer** | ✅ Implemented | Nightly cron, reward function, canary A/B |
| **Inventory management** | ✅ Implemented | Ledger, allocations, events, low-stock alerts |
| **Order management** | ✅ Implemented | Import, ship, refund, auto-complete |
| **Notifications (in-app + WS)** | ✅ Implemented | Socket.IO gateway, in-app UI |
| **Audit trail** | ✅ Implemented | Auth + entity audit logs, frontend UI |
| **Templates** | ✅ Implemented | Handlebars/Liquid rendering, CRUD |
| **Settings (tenant)** | ✅ Implemented | Pricing rules, shipping profiles |
| **Storage / image assets** | ✅ Implemented | S3, thumbnails, cleanup, presigned URLs |
| **Health checks** | ✅ Implemented | @Public, liveness/readiness |
| **Fitment manager (YMMT)** | ✅ Implemented | Make/model/year/submodel/engine hierarchy |
| **AI listing generation** | 🟡 Partial | Code wired, quality unverified |
| **Motors Intelligence** | 🟡 Partial | Pipeline + review queue exist, end-to-end unverified |
| **Pipeline wizard** | 🟡 Partial | Multi-stage enrichment, review queue, needs verification |
| **VIN lookup** | 🟡 Partial | VinCache entity, fitment VIN route exists |
| **Compliance audits** | 🟡 Partial | ComplianceAuditLog entity, controller exists |
| **Export rules** | 🟡 Partial | Double-prefix bug blocks frontend access |
| **Feature flags** | 🟡 Partial | Double-prefix bug blocks frontend access |
| **Bulk actions** | 🟡 Partial | Route exists, backend wired |
| **Automation rules** | 🟡 Partial | CRUD exists, rule engine depth unverified |
| **Pricing intelligence** | 🟡 Partial | Backend + orphaned frontend component (no route) |
| **AI enhancements** | 🟡 Partial | Controller exists, approval flow wired |
| **Forgot password** | ❌ Not Implemented | UI only, no backend |
| **Shopify/Amazon/Walmart** | ❌ Not Implemented | Scaffolding only |
| **JWT revocation** | ❌ Not Implemented | Client-side logout only |
| **Frontend tests** | ❌ Not Implemented | Zero test files |
| **E2E tests** | ❌ Not Implemented | No e2e test files found |

---

## Known Gaps and Incomplete Areas

### Confirmed Bugs (Fix Required)

1. **Double `/api` prefix** on `feature-flag.controller.ts` and `export-rule.controller.ts` — routes resolve at `/api/api/...` making them inaccessible from frontend
2. **DEBUG JWT logging** — auth code logs JWT secrets and full tokens to console
3. **Branding inconsistency** — "RealTrackApp" (shell) vs "ListingPro" (DB/login)

### Documentation vs Code Discrepancies

| Documentation Claim | Actual | Source of Truth |
|--------------------|--------|----------------|
| 21 migrations | **27 migrations** | `backend/src/migrations/` directory |
| ~79 entities | **82 entity files** | Glob of `**/*.entity.ts` |
| ~90 permissions | **73 permissions** | `permission-registry.ts` |
| 9 backend spec files | **24 spec files** | Glob of `**/*.spec.ts` |
| 1 e2e test | **0 e2e tests** | No `.e2e.*` files found |
| ~16 BullMQ queues | **14 queues** | Module registrations |
| "Client-side logout" | ✅ Accurate | No server revocation |

### Missing Features

| Feature | Impact | Details |
|---------|--------|---------|
| Frontend tests | High | Zero test files across entire `src/` |
| E2E tests | High | No integration/e2e test files |
| JWT revocation | High | No server-side token blacklist or versioning |
| Forgot password | Medium | UI exists, no backend reset endpoint |
| Non-eBay channels | Low | Clearly scaffolding, not misleading to users |

### Technical Debt

| Item | Severity | Details |
|------|----------|---------|
| TEXT price columns | Medium | `startPrice`/`quantity` still TEXT; `*Num` columns preferred |
| Missing FKs | Medium | Prior audit flagged several missing foreign key constraints |
| Dual channel tables | Low | `channel_listings` deprecated but not dropped |
| axios dependency | Low | Declared but unused; all API calls use native fetch |
| Orphaned PricingDashboard | Low | Component exists with API client but no route |

---

## Bugs, Risks, and Technical Debt

### Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Low test coverage** | High | High | 24 backend unit specs, 0 frontend tests, 0 e2e tests. Regressions go undetected. |
| **JWT token exposure** | High | High | DEBUG logging outputs full tokens to console. Must gate behind env flag. |
| **Tenant data leakage** | Medium | High | `organizationId` enforcement is inconsistent across services. |
| **eBay OAuth fragility** | Medium | High | Token refresh can fail on network issues. SellerPundit fallback mitigates partially. |
| **Default secrets in production** | Medium | High | `.env.example` has weak defaults. Deploy script validates JWT_SECRET only. |

### Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CSV import OOM | Medium | Medium | Mitigated with `NODE_OPTIONS=--max-old-space-size` and concurrency caps |
| Migration failure on boot | Low | High | Mitigated with `migrationsTransactionMode: 'each'` and health checks |
| Double-prefix routes | High | Low | Feature flags and export rules inaccessible from frontend |

---

## Documentation Gaps Found

### Outdated Counts in Documentation

| Document | Field | Claimed | Actual |
|----------|-------|---------|--------|
| DATABASE_SCHEMA.md | Migrations | 21 | 27 |
| DATABASE_SCHEMA.md | Entities | ~79 | 82 |
| AGENT_SYSTEM_MEMORY.md | Migrations | 21 | 27 |
| AGENT_SYSTEM_MEMORY.md | Entities | ~79 | 82 |
| AGENT_SYSTEM_MEMORY.md | Spec files | 9 | 24 |
| AUTH_RBAC.md | Permissions | ~90 | 73 |
| FEATURE_REGISTRY.md | Implemented count | ~20 | ~25 |
| FEATURE_REGISTRY.md | Partial count | ~18 | ~13 |
| CURRENT_STATE.md | Spec files | 9 | 24 |
| CURRENT_STATE.md | E2E tests | 1 | 0 |

### Underdocumented Features

| Feature | Documentation Status | Actual Complexity |
|---------|---------------------|-------------------|
| SellerPundit integration | Brief mention in INTEGRATIONS.md | 19 files, full store/policy/publish pipeline |
| AI routing optimizer | Brief mention | 39 files in common/openai/, sophisticated 5-lane system |
| Listing optimization pipeline | Not documented as standalone | 6 files, multi-marketplace optimization |
| Model comparison scripts | Not documented | 7 scripts + report in scripts/model-comparison/ |
| Enrichment cache service | Not documented | MPN-keyed cache with 7-day TTL |
| AI run logging | Not documented | Per-run audit with segment stats for optimizer |

### Missing Documentation

| Topic | Status |
|-------|--------|
| SellerPundit integration guide | ❌ No dedicated doc |
| AI routing system architecture | ❌ No dedicated doc (brief mentions only) |
| Model comparison results | ❌ Report exists in scripts/ but not in docs/ |
| Pipeline stage documentation | ❌ No stage-by-stage pipeline doc |
| Cron job schedule reference | ❌ Embedded in code, no standalone reference |

---

## Deployment and Environment State

### Docker Compose (✅ Production-Ready)

| Service | Image | Key Config |
|---------|-------|------------|
| postgres | postgres:16-alpine | shared_buffers=128MB, max_connections=50, auto-restore from dump |
| redis | redis:7-alpine | maxmemory=128mb, LRU eviction |
| backend | Custom (node:20-alpine) | Heap 1536MB, healthcheck at /api/health, 120s startup grace |
| frontend | Custom (nginx:1.27-alpine) | Vite build → nginx, reverse-proxy to backend |

### Deploy Script (`deploy.sh`)

✅ 108-line script with: prerequisite checks, `.env` auto-setup, random JWT_SECRET generation, security validation (rejects CHANGE_ME), `docker compose build --no-cache`, health check polling.

**Missing**: No rollback on health check failure, no backup step, no explicit migration step.

### Environment Variables

**Two `.env.example` files** (root for Docker, `backend/` for local dev) with 40+ variables covering:
- Infrastructure (Node options, pool sizes, pipeline concurrency)
- Database, Redis, Auth
- OpenAI/OpenRouter (5 model lanes + vision + embeddings)
- eBay (credentials, environment, redirect URI)
- SellerPundit (API base, credentials, marketplace)
- AWS S3 (bucket, prefix, region, credentials)
- Token encryption (TOKEN_ENCRYPTION_KEY, KMS)
- AI optimization (optimizer, canary, learning, taxonomy)

### Nginx Configuration

**Two versions**:
- Root `nginx.conf` — Bare-metal/VPS (mhn.realtrackapp.com), basic proxy
- `docker/nginx.conf` — Docker Compose, 7 location blocks with per-endpoint timeout tuning and WebSocket support

---

## Testing Status

| Category | Count | Coverage |
|----------|-------|----------|
| Backend unit specs | 24 files | AI optimizer, listing guards, model router, SellerPundit (marketplace registry, publish util, token expiry), eBay (7 utils), core services (orders, inventory, dashboard, stores, pricing), automation, channels webhook, app controller |
| Frontend tests | 0 | No test files exist |
| E2E tests | 0 | No e2e files found |
| Integration tests | 0 | No integration test files found |

**Framework**: Jest (standard NestJS setup). Tests focus on pure functions and utility logic. No service-level integration tests with mocked databases.

---

## Background Jobs and Scheduling

### BullMQ Queues (14)

| Queue | Concurrency | Purpose |
|-------|-------------|---------|
| openai | 3 | Central OpenAI prompt queue (priority-based) |
| ingestion | 3 | Image/data ingestion |
| pipeline | 1 | Multi-stage enrichment pipeline |
| listing-optimization | 1 | Post-enrichment optimization (2h lock) |
| catalog-import | 1 | CSV import (memory-heavy) |
| motors-pipeline | default | Motors intelligence pipeline |
| ebay-listing-publish | default | eBay listing publication |
| ebay-listing-validation | default | Pre-publish validation |
| ebay-listing-revision | default | Listing updates |
| ebay-listing-ending | default | Listing end/delete |
| ebay-policy-sync | default | Policy synchronization |
| ebay-order-sync | default | Order pull |
| ebay-inventory-sync | default | Inventory sync |
| inventory | 1 | Inventory sync/adjustments |
| fitment | 1 | Fitment import |
| orders | 1 | Order processing |
| dashboard | 1 | KPI aggregation |
| channels | 2 | Channel publish |
| storage-thumbnails | 5 | Thumbnail generation |
| storage-cleanup | 1 | Orphan cleanup |

### Scheduled Cron Jobs (10)

| Schedule | Queue/Service | Job | Purpose |
|----------|--------------|-----|---------|
| `0 0 */2 * *` | channels | refresh-stale-offers | Refresh stale channel listings |
| `0 1 * * *` | dashboard | daily-sales-rollup | Daily sales aggregation |
| `0 2 * * *` | AiOptimizerService | nightly-optimizer | AI routing optimization (opt-in) |
| `0 3 * * *` | storage-cleanup | cleanup | Storage cleanup |
| `0 4 * * *` | inventory | duplicate-scan | Inventory duplicate detection |
| `0 */2 * * *` | channels | sync-inventory | Channel inventory sync |
| `0 */4 * * *` | inventory | low-stock-alert | Low stock detection |
| `*/15 * * * *` | orders | import-from-channels | Order import from eBay |
| Every 30 min | dashboard | recompute-summary | Dashboard KPI refresh |
| `30 */4 * * *` | PriceMonitorService | pricing-collect | Competitor price collection (direct call, not queue) |

---

## Recommended Next Steps

### Critical (Do First)

1. **Fix double `/api` prefix** on `feature-flag.controller.ts` and `export-rule.controller.ts`. One-line fix per file. Verify frontend clients call the correct path.

2. **Remove DEBUG JWT logging** in `auth.service.ts` and `jwt.strategy.ts`. Gate behind `NODE_ENV=development` or remove entirely. Exposes full tokens in log output.

3. **Add basic frontend tests** for ProtectedRoute, auth flow, and permission gating. These are the highest-risk, zero-coverage areas.

### High Priority

4. **Raise backend test coverage** on auth/RBAC enforcement, eBay publish/sync paths, and catalog import pipeline. These are the most business-critical and least-tested paths.

5. **Implement or hide forgot-password**. UI exists with no backend — misleading to users.

6. **Fix permission gaps** on `/settings/client`, `/settings/users`, `/settings/permissions`, `/settings/ai-routing` — add explicit permission checks.

7. **Standardize branding** on "RealTrackApp" across all surfaces (login, shell, DB references in docs).

### Medium Priority

8. **Update documentation counts**: migrations (21→27), entities (~79→82), permissions (~90→73), specs (9→24), e2e (1→0).

9. **Document SellerPundit integration** as a standalone guide — it's a substantial feature with 19 files.

10. **Document AI routing system** architecture — the 39-file system in `common/openai/` deserves its own architecture doc.

11. **Audit missing foreign keys** and add constraints via migration.

12. **Complete or remove dual channel table** migration (`channel_listings` → `listing_channel_instances`).

### Low Priority

13. Add `React.lazy()` code splitting for routes to reduce initial bundle size.
14. Remove unused `axios` dependency from `package.json`.
15. Wire `PricingDashboard` component to a route or remove the orphaned code.
16. JWT refresh token rotation and server-side revocation.
17. PostgreSQL partitioning for high-volume tables.
18. Performance testing and optimization.

---

## Priority Roadmap for Stabilization and Improvement

### Phase 1: Critical Fixes (Immediate)
- [ ] Fix double `/api` prefix on 2 controllers
- [ ] Remove/gate DEBUG JWT logging
- [ ] Add permission checks to 4 unprotected settings routes
- [ ] Implement or hide forgot-password flow

### Phase 2: Test Foundation (Short-term)
- [ ] Add frontend tests for auth flow and route protection
- [ ] Add backend tests for RBAC enforcement paths
- [ ] Add backend tests for eBay publish/sync
- [ ] Add integration test for catalog import pipeline

### Phase 3: Documentation Alignment (Short-term)
- [ ] Update all documentation counts to match reality
- [ ] Create SellerPundit integration guide
- [ ] Create AI routing architecture document
- [ ] Create pipeline stage-by-stage documentation
- [ ] Document cron job schedule as standalone reference

### Phase 4: Technical Debt (Medium-term)
- [ ] Audit and fix missing foreign keys
- [ ] Complete channel_listings deprecation
- [ ] Migrate all code to use `*Num` price/quantity columns
- [ ] Add code splitting to frontend routes
- [ ] Remove unused dependencies (axios)

### Phase 5: Security Hardening (Medium-term)
- [ ] Implement JWT refresh token rotation
- [ ] Add server-side token blacklist (Redis)
- [ ] Audit tenant isolation across all services
- [ ] Add pre-deploy secret validation

### Phase 6: Feature Completion (Long-term)
- [ ] Flesh out or remove non-eBay channel scaffolding
- [ ] Verify Motors Intelligence end-to-end with production data
- [ ] Verify AI listing generation quality
- [ ] Performance testing and optimization
- [ ] PostgreSQL partitioning for high-volume tables

---

## Appendix: File Inventory Summary

| Category | Count |
|----------|-------|
| Backend modules (in app.module.ts) | 23 |
| Backend controllers | 38 classes in 37 files |
| Backend services | 95 |
| Backend entities | 82 |
| Backend processors | 15 |
| Backend migrations | 27 |
| Backend spec files | 24 |
| Frontend routes | 37 (+ 1 catch-all 404) |
| Frontend components | 67 |
| Frontend API clients | 22 |
| Frontend test files | 0 |
| BullMQ queues | 14 |
| Scheduled cron jobs | 10 |
| RBAC permissions | 73 |
| RBAC roles | 8 |
| Environment variables | 40+ |
| Docker services | 4 |
| Utility scripts | 47 |

---

*Generated: 2026-06-11. This document should be regenerated periodically to maintain accuracy.*
