# ListingPro Backend — Comprehensive Production Audit Report

**Generated:** 2025  
**Scope:** `backend/src/` — all modules, controllers, services, entities, processors, adapters, guards, gateways  
**Framework:** NestJS (TypeScript) on Node.js  
**Database:** PostgreSQL via TypeORM  
**Queue:** Redis via BullMQ  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Configuration](#2-core-configuration)
3. [Module Inventory](#3-module-inventory)
4. [Entity / Database Schema Catalog](#4-entity--database-schema-catalog)
5. [Controller & Endpoint Map](#5-controller--endpoint-map)
6. [Service Method Inventory](#6-service-method-inventory)
7. [Background Job Queues (BullMQ)](#7-background-job-queues-bullmq)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [External Integrations](#9-external-integrations)
10. [Real-time & Event System](#10-real-time--event-system)
11. [Database Relations & Constraints](#11-database-relations--constraints)
12. [Error Handling & Resilience](#12-error-handling--resilience)
13. [Migrations](#13-migrations)
14. [Scripts & Utilities](#14-scripts--utilities)
15. [Observations & Recommendations](#15-observations--recommendations)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    NestJS Server                     │
│                   (port 4191)                        │
│                                                     │
│  ┌───────────┐  ┌───────────┐  ┌────────────────┐  │
│  │  Auth      │  │ Listings  │  │  Channels      │  │
│  │  (JWT)     │  │ (CRUD+FTS)│  │  (eBay/Shopify)│  │
│  ├───────────┤  ├───────────┤  ├────────────────┤  │
│  │ Ingestion │  │ Fitment   │  │  Inventory     │  │
│  │ (AI Vision│  │ (ACES)    │  │  (Ledger+Event)│  │
│  ├───────────┤  ├───────────┤  ├────────────────┤  │
│  │  Orders   │  │ Dashboard │  │  Notifications │  │
│  │  (FSM)    │  │ (KPIs)    │  │  (WebSocket)   │  │
│  ├───────────┤  ├───────────┤  ├────────────────┤  │
│  │  Storage  │  │ Settings  │  │  Health        │  │
│  │ (S3+Sharp)│  │ (Tenancy) │  │  (Terminus)    │  │
│  └───────────┘  └───────────┘  └────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │      BullMQ Queues (8 queues via Redis)      │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │    EventEmitter2 (cross-module events)       │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────┘
                   │
       ┌───────────┼───────────────┐
       ▼           ▼               ▼
  PostgreSQL    Redis          AWS S3 / CloudFront
                               OpenAI GPT-4o Vision
```

**Tech Stack Summary:**

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + NestJS |
| Language | TypeScript (strict) |
| ORM | TypeORM (repository pattern) |
| Database | PostgreSQL (timestamptz, jsonb, tsvector, inet) |
| Cache/Queue | Redis via BullMQ |
| Auth | Passport JWT + bcrypt (12 rounds) |
| API Docs | Swagger/OpenAPI (non-production) |
| Storage | AWS S3 + CloudFront CDN |
| AI | OpenAI GPT-4o Vision API |
| Image Processing | Sharp (WebP, thumbnails, blurhash) |
| WebSockets | Socket.IO (`/notifications` namespace) |
| Events | NestJS EventEmitter2 |
| Rate Limiting | @nestjs/throttler (3 tiers) |
| Health | @nestjs/terminus (DB + memory) |
| Compression | gzip (level 6, threshold 1024 bytes) |
| File Parsing | XLSX (Excel import) |

---

## 2. Core Configuration

### `main.ts`
- **Port:** `4191`
- **Global Prefix:** `/api`
- **CORS:** Origin from `CORS_ORIGIN` env var (default `http://localhost:5173`)
- **Validation:** Global `ValidationPipe` — `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **Swagger:** Enabled when `NODE_ENV !== 'production'` at `/api/docs`
- **Raw Body:** Enabled for webhook HMAC verification
- **Compression:** gzip, level 6, threshold 1024 bytes

### `app.module.ts`
- **ConfigModule:** Global, `.env` loaded
- **EventEmitterModule:** Global event bus
- **ThrottlerModule:** 3 tiers:
  - `short`: 10 requests / 1 second
  - `medium`: 100 requests / 60 seconds
  - `long`: 1000 requests / 3600 seconds
- **TypeOrmModule:** PostgreSQL, `autoLoadEntities: true`, `synchronize: false`, migrations table `typeorm_migrations`
- **BullModule:** Redis connection from env vars, default job options: 3 attempts, exponential backoff (1s)
- **APP_GUARD:** `ThrottlerGuard` applied globally

### `data-source.ts`
- TypeORM DataSource for CLI migrations
- Entities loaded via glob: `**/*.entity{.ts,.js}`
- Migrations from: `src/migrations/*`
- Env vars: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`

---

## 3. Module Inventory

| # | Module | Directory | Purpose |
|---|--------|-----------|---------|
| 1 | **AuthModule** | `src/auth/` | JWT authentication, user registration, role-based access |
| 2 | **HealthModule** | `src/health/` | Liveness/readiness probes (DB + memory) |
| 3 | **ListingsModule** | `src/listings/` | Core listing CRUD, Excel import, full-text search, revisions |
| 4 | **ChannelsModule** | `src/channels/` | Multi-channel marketplace integration (eBay, Shopify), OAuth, stores, AI enhancements, demo mode |
| 5 | **IngestionModule** | `src/ingestion/` | AI-powered image-to-listing pipeline, review workflow |
| 6 | **FitmentModule** | `src/fitment/` | Vehicle fitment data (ACES standard), year/make/model matching |
| 7 | **InventoryModule** | `src/inventory/` | Event-sourced inventory ledger, reservations, reconciliation |
| 8 | **OrdersModule** | `src/orders/` | Multi-channel order management, state machine, import |
| 9 | **DashboardModule** | `src/dashboard/` | Analytics, KPIs, audit logs, sales tracking, cache |
| 10 | **SettingsModule** | `src/settings/` | Tenant configuration, shipping profiles, pricing rules |
| 11 | **StorageModule** | `src/storage/` | S3 uploads, CDN delivery, image processing (Sharp), cleanup |
| 12 | **NotificationsModule** | `src/notifications/` | Persistent notifications, WebSocket real-time push, event triggers |
| 13 | **CommonModule** | `src/common/` | Shared guards (`RolesGuard`), decorators |

---

## 4. Entity / Database Schema Catalog

### 4.1 Auth

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | auto-generated |
| `email` | varchar(200) | **UNIQUE**, NOT NULL |
| `passwordHash` | text | `select: false` (excluded from queries) |
| `name` | varchar(200) | nullable |
| `role` | varchar(20) | `'admin' \| 'manager' \| 'user' \| 'viewer'`, default `'user'` |
| `active` | boolean | default `true` |
| `lastLoginAt` | timestamptz | nullable |
| `createdAt` | timestamptz | auto |

---

### 4.2 Listings

#### `listing_records`
76+ columns mapping to eBay's bulk upload template. Key columns:

| Column Group | Notable Columns |
|-------------|----------------|
| **Identity** | `id` (uuid PK), `customLabelSku`, `categoryId` |
| **Source Metadata** | `sourceFileName`, `filePath`, `sheetName`, `sourceRowNumber` |
| **Core eBay Fields** | `action`, `title`, `conditionId`, `conditionDescription`, `startPrice`, `quantity`, `description` |
| **Item Specifics** | `cBrand`, `cManufacturerPartNumber`, `cOeOemPartNumber`, `cType`, `cPlacement`, `cFitmentType`, `cWarranty`, etc. |
| **Shipping** | `shippingType`, `shippingService1Option/Cost/Priority`, `shippingService2Option/Cost/Priority` |
| **Compliance** | `productSafetyPictograms/Statements/Component`, `regulatoryDocumentIds` |
| **Manufacturer** | `manufacturerName/AddressLine1/City/Country/Phone/Email/ContactUrl` |
| **Responsible Person** | `responsiblePerson1`/Type/AddressLine1/City/Country/Phone/Email/ContactUrl |
| **Lifecycle** | `status` (draft/ready/published/sold/delisted/archived), `version` (VersionColumn), `deletedAt` (soft delete), `updatedAt`, `publishedAt` |
| **Extracted** | `extractedMake`, `extractedModel` |
| **External IDs** | `ebayListingId`, `shopifyProductId` |
| **Search** | `searchVector` (tsvector, `select: false`) |

**Indexes:** `customLabelSku`, `categoryId`, `title`, `cBrand`, `conditionId`, `cType`, `sourceFileName`+`sheetName`, `extractedMake`, `extractedModel`  
**Unique Constraint:** `(sourceFileName, sheetName, sourceRowNumber)`

#### `listing_revisions`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `listingId` | uuid | FK → `listing_records`, indexed |
| `version` | integer | |
| `statusBefore` | varchar(20) | nullable |
| `statusAfter` | varchar(20) | NOT NULL |
| `snapshot` | jsonb | Full listing state at revision time |
| `changeReason` | text | nullable |
| `changedBy` | uuid | nullable |
| `createdAt` | timestamptz | auto |

**Unique:** `(listingId, version)`

---

### 4.3 Channels

#### `channel_connections`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `channel` | varchar(30) | `'ebay' \| 'shopify'` |
| `user_id` | uuid | indexed |
| `account_name` | varchar(200) | nullable |
| `external_account_id` | varchar(200) | nullable |
| `encrypted_tokens` | text | AES-256-GCM encrypted |
| `token_expires_at` | timestamptz | nullable |
| `scope` | varchar(500) | nullable |
| `status` | varchar(20) | `'active' \| 'expired' \| 'revoked' \| 'error'`, default `'active'` |
| `last_sync_at` | timestamptz | nullable |
| `last_error` | text | nullable |
| `created_at` / `updated_at` | timestamptz | auto |

#### `channel_listings`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `connection_id` | uuid | FK → `channel_connections` CASCADE |
| `listing_id` | uuid | indexed |
| `external_id` | varchar(200) | |
| `external_url` | varchar(500) | nullable |
| `sync_status` | varchar(20) | `'synced' \| 'pending' \| 'error' \| 'ended'` |
| `last_pushed_version` | integer | default 0 |
| `last_synced_at` | timestamptz | nullable |
| `last_error` | text | nullable |

**Unique:** `(connection_id, external_id)`

#### `stores`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `connection_id` | uuid | FK → `channel_connections` CASCADE |
| `channel` | varchar(30) | |
| `store_name` | varchar(200) | |
| `store_url` | text | nullable |
| `external_store_id` | varchar(200) | nullable |
| `status` | varchar(20) | `'active' \| 'paused' \| 'suspended' \| 'archived'` |
| `is_primary` | boolean | default `false` |
| `config` | jsonb | default `{}` |
| `metrics_cache` | jsonb | default `{}` |
| `listing_count` | integer | default 0 |

**Indexes:** `(connection_id)`, `(channel, store_name)`

#### `listing_channel_instances`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `listing_id` | uuid | FK → `listing_records` CASCADE |
| `connection_id` | uuid | FK → `channel_connections` CASCADE |
| `store_id` | uuid | FK → `stores` CASCADE |
| `channel` | varchar(30) | |
| `external_id` | varchar(200) | nullable |
| `external_url` | text | nullable |
| `override_price` | numeric(10,2) | nullable (per-store override) |
| `override_quantity` | integer | nullable (per-store override) |
| `override_title` | text | nullable (per-store override) |
| `channel_specific_data` | jsonb | default `{}` |
| `sync_status` | varchar(20) | `'synced' \| 'pending' \| 'publishing' \| 'error' \| 'ended' \| 'draft'` |
| `last_pushed_version` | integer | nullable |
| `last_error` | text | nullable |
| `retry_count` | integer | default 0 |
| `is_demo` | boolean | default `false` |

**Unique:** `(listing_id, store_id)`  
**Indexes:** `listing_id`, `store_id`, `connection_id`, `external_id`, `sync_status`

#### `ai_enhancements`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `listing_id` | uuid | FK → `listing_records` CASCADE |
| `enhancementType` | varchar(50) | `'title_optimization' \| 'description_generation' \| 'item_specifics' \| 'fitment_detection' \| 'image_enhancement'` |
| `status` | varchar(20) | `'requested' \| 'processing' \| 'generated' \| 'approved' \| 'rejected'` |
| `inputData` | jsonb | nullable |
| `originalValue` | text | nullable |
| `enhancedValue` | text | nullable |
| `enhancedData` | jsonb | nullable |
| `diff` | jsonb | nullable |
| `provider` / `model` | varchar | nullable |
| `confidenceScore` | real | nullable |
| `tokensUsed` | integer | nullable |
| `costUsd` | numeric(8,4) | nullable |
| `approvedBy` | uuid | nullable |
| `rejectionReason` | text | nullable |

#### `channel_webhook_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `channel` | varchar(30) | indexed |
| `event_type` | varchar(100) | |
| `external_id` | varchar(200) | nullable |
| `payload` | jsonb | default `{}` |
| `processing_status` | varchar(20) | `'received' \| 'processed' \| 'failed' \| 'ignored'` |
| `processing_error` | text | nullable |
| `processed_at` | timestamptz | nullable |

#### `demo_simulation_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `operation_type` | varchar(50) | publish/update/end_listing/sync_inventory/order_received/webhook_simulated/auth_simulated/token_refresh |
| `channel` | varchar(30) | |
| `store_id` / `listing_id` / `instance_id` | uuid | nullable |
| `simulated_external_id` | varchar(200) | nullable |
| `request_payload` / `response_payload` | jsonb | |
| `simulated_latency_ms` | integer | |
| `simulated_success` | boolean | |
| `simulated_error` | text | nullable |
| `notes` | text | nullable |

**Indexes:** `operation_type`, `channel`, `listing_id`, `created_at`

---

### 4.4 Ingestion

#### `ingestion_jobs`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `status` | varchar(20) | `'pending' \| 'uploading' \| 'processing' \| 'ai_complete' \| 'review_required' \| 'approved' \| 'rejected' \| 'failed' \| 'cancelled'` |
| `mode` | varchar(20) | `'single' \| 'bulk' \| 'bundle'` |
| `source_type` | varchar(20) | `'upload' \| 'camera' \| 'url' \| 'api'` |
| `image_count` | integer | |
| `ai_provider` / `ai_model` | varchar | nullable |
| `ai_started_at` / `ai_completed_at` | timestamptz | nullable |
| `ai_cost_usd` | numeric(8,4) | nullable |
| `review_status` | varchar(20) | default `'pending'` |
| `reviewed_by` | uuid | nullable |
| `listing_id` | uuid | FK → `listing_records` SET NULL |
| `attempt_count` | integer | default 0, `max_attempts` default 3 |
| `last_error` | text | nullable |
| `next_retry_at` | timestamptz | nullable |

**Indexes:** `status`, partial index on `review_status='needs_review'`

#### `ai_results`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `job_id` | uuid | FK → `ingestion_jobs` CASCADE, indexed |
| `raw_response` | jsonb | |
| `provider` / `model` | varchar | |
| `tokens_used` / `latency_ms` | integer | |
| Extracted fields | `title`, `brand`, `mpn`, `oem_number`, `part_type`, `condition`, `price_estimate`, `description`, `features` (text[]), `fitment_raw` (jsonb) |
| Confidence scores | `title`, `brand`, `mpn`, `part_type`, `overall` (all real) |
| `matched_existing_id` | uuid | nullable |
| `match_confidence` | real | nullable |

**Index:** `confidence_overall`

---

### 4.5 Fitment

#### `fitment_makes`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | serial (PK) | |
| `name` | varchar(100) | |
| `slug` | varchar(100) | **UNIQUE**, indexed |
| `aces_id` | integer | **UNIQUE**, nullable |

#### `fitment_models`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | serial (PK) | |
| `make_id` | integer | FK → `fitment_makes` CASCADE, indexed |
| `name` | varchar(100) | |
| `slug` | varchar(100) | |
| `aces_id` | integer | **UNIQUE**, nullable |

**Unique:** `(make_id, slug)`

#### `fitment_submodels`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | serial (PK) | |
| `model_id` | integer | FK → `fitment_models` CASCADE |
| `name` | varchar(100) | |
| `aces_id` | integer | **UNIQUE**, nullable |

**Unique:** `(model_id, name)`

#### `fitment_years`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | serial (PK) | |
| `year` | smallint | **UNIQUE** |

#### `fitment_engines`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | serial (PK) | |
| `code` | varchar(50) | **UNIQUE** |
| `displacement_l` | numeric(4,1) | nullable |
| `cylinders` | smallint | nullable |
| `fuel_type` | varchar(30) | nullable |
| `aspiration` | varchar(30) | nullable |
| `aces_id` | integer | **UNIQUE**, nullable |

#### `part_fitments`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `listing_id` | uuid | FK → `listing_records` CASCADE |
| `make_id` | integer | FK → `fitment_makes` NO ACTION |
| `model_id` | integer | FK → `fitment_models` NO ACTION |
| `submodel_id` | integer | FK → `fitment_submodels` NO ACTION, nullable |
| `year_start` / `year_end` | smallint | |
| `engine_id` | integer | FK → `fitment_engines` NO ACTION, nullable |
| `source` | varchar(20) | `'manual' \| 'aces_import' \| 'ai_detected' \| 'bulk_import'` |
| `confidence` | real | nullable |
| `verified` | boolean | default `false` |
| `verified_by` | uuid | nullable |

**Unique:** `(listing_id, make_id, model_id, year_start, year_end, engine_id)`  
**Index:** `(make_id, model_id, year_start, year_end)`

---

### 4.6 Inventory

#### `inventory_ledger`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `listing_id` | uuid | FK → `listing_records` CASCADE, **UNIQUE** |
| `quantity_total` | integer | default 0 |
| `quantity_reserved` | integer | default 0 |
| `quantity_available` | integer | computed |
| `quantity_listed_ebay` / `quantity_listed_shopify` | integer | default 0 |
| `low_stock_threshold` | integer | default 2 |
| `reorder_point` | integer | default 0 |
| `version` | integer | **VersionColumn** (optimistic locking) |
| `last_reconciled_at` | timestamptz | nullable |

**Partial Index:** `quantity_total WHERE quantity_total - quantity_reserved <= low_stock_threshold`

#### `inventory_events`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `listing_id` | uuid | |
| `event_type` | varchar(30) | `'initial_stock' \| 'manual_adjust' \| 'sale' \| 'return' \| 'reserve' \| 'release_reserve' \| 'sync_correction' \| 'bulk_import' \| 'damage_writeoff'` |
| `quantity_change` | integer | |
| `quantity_before` / `quantity_after` | integer | |
| `source_channel` | varchar(30) | nullable |
| `source_order_id` | varchar(100) | nullable |
| `idempotency_key` | varchar(200) | **UNIQUE** |
| `reason` | text | nullable |
| `created_by` | uuid | nullable |

**Indexes:** `(source_channel, source_order_id)`, `(event_type, created_at)`, `(listing_id, created_at)`

---

### 4.7 Orders

#### `orders`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `channel` | varchar(30) | |
| `connection_id` | uuid | FK → `channel_connections` SET NULL |
| `external_order_id` | varchar(100) | |
| `external_url` | text | nullable |
| `status` | varchar(30) | FSM-controlled (see §6.8) |
| **Buyer** | `buyer_username`, `buyer_email`, `buyer_name` | varchar |
| **Shipping** | `shipping_name/address_1/address_2/city/state/zip/country/method` | |
| **Tracking** | `tracking_number`, `tracking_carrier` | |
| **Timestamps** | `shipped_at`, `delivered_at`, `cancelled_at`, `ordered_at`, `paid_at`, `refunded_at` | |
| **Financials** | `subtotal`, `shipping_cost`, `tax_amount`, `total_amount` (numeric 10,2), `currency` (char 3), `marketplace_fee`, `net_revenue`, `refund_amount` | |
| `refund_reason` | text | nullable |

**Unique:** `(channel, external_order_id)`  
**Indexes:** `buyer_email`, `ordered_at`, `(channel, ordered_at)`, `status`

#### `order_items`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `order_id` | uuid | FK → `orders` CASCADE, indexed |
| `listing_id` | uuid | nullable, indexed |
| `external_item_id` | varchar(100) | nullable |
| `sku` | varchar(100) | nullable |
| `title` | text | |
| `quantity` | integer | default 1 |
| `unit_price` / `total_price` | numeric(10,2) | |
| `fulfilled` | boolean | default `false` |

---

### 4.8 Dashboard

#### `audit_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `entityType` | varchar(50) | indexed |
| `entityId` | uuid | |
| `action` | varchar(30) | indexed |
| `actorId` | uuid | nullable, indexed |
| `actorType` | varchar(20) | default `'user'` |
| `changes` | jsonb | nullable |
| `metadata` | jsonb | default `{}` |
| `ipAddress` | inet | |
| `createdAt` | timestamptz | indexed |

#### `dashboard_metrics_cache`
| Column | Type | Constraints |
|--------|------|-------------|
| `metricKey` | varchar(100) | **PK** |
| `metricValue` | jsonb | |
| `computedAt` | timestamptz | |

#### `sales_records`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `orderId` | uuid | nullable |
| `listingId` | uuid | indexed |
| `channel` | varchar(30) | indexed |
| `quantitySold` | integer | default 1 |
| `salePrice` | numeric(10,2) | |
| `currency` | char(3) | default `'USD'` |
| `marketplaceFee` | numeric(10,2) | nullable |
| `netRevenue` | numeric(10,2) | nullable |
| `soldAt` | timestamptz | indexed |

---

### 4.9 Settings

#### `tenant_settings`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `category` | varchar(50) | |
| `key` | varchar(100) | |
| `value` | jsonb | |
| `description` | text | nullable |
| `updatedBy` | uuid | nullable |

**Unique:** `(category, key)`

#### `shipping_profiles`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `name` | varchar(100) | |
| `carrier` | varchar(50) | |
| `service` | varchar(100) | |
| `handlingTime` | integer | default 1 |
| `costType` | varchar(20) | `'flat' \| 'calculated' \| 'free'` |
| `flatCost` | numeric(8,2) | nullable |
| `weightBased` | boolean | default `false` |
| `domesticOnly` | boolean | default `true` |
| `isDefault` | boolean | default `false` |
| `active` | boolean | default `true` |

#### `pricing_rules`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `name` | varchar(100) | |
| `ruleType` | varchar(30) | `'markup' \| 'markdown' \| 'round' \| 'min_margin' \| 'competitive'` |
| `channel` | varchar(30) | nullable |
| `categoryId` | varchar(20) | nullable |
| `brand` | varchar(100) | nullable |
| `parameters` | jsonb | |
| `priority` | integer | default 0 |
| `active` | boolean | default `true` |

---

### 4.10 Storage

#### `image_assets`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `listing_id` | uuid | FK → `listing_records` SET NULL, partial index (where `deleted_at IS NULL`) |
| `job_id` | uuid | indexed |
| `s3_bucket` | varchar(100) | |
| `s3_key` | varchar(500) | |
| `s3_key_thumb` | varchar(500) | nullable |
| `cdn_url` | text | nullable |
| `original_filename` | text | nullable |
| `mime_type` | varchar(50) | |
| `file_size_bytes` | bigint | |
| `width` / `height` | integer | nullable |
| `blurhash` | varchar(50) | nullable |
| `sort_order` | integer | default 0 |
| `is_primary` | boolean | default `false` |
| `uploaded_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |

**Unique:** `(s3_bucket, s3_key)`

---

### 4.11 Notifications

#### `notifications`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid (PK) | |
| `recipientId` | uuid | nullable, indexed |
| `type` | varchar(50) | indexed |
| `title` | varchar(200) | |
| `body` | text | nullable |
| `icon` | varchar(30) | nullable |
| `severity` | varchar(10) | `'info' \| 'success' \| 'warning' \| 'error'`, default `'info'` |
| `entityType` | varchar(50) | nullable |
| `entityId` | uuid | nullable |
| `actionUrl` | text | nullable |
| `read` | boolean | default `false` |
| `readAt` | timestamptz | nullable |
| `dismissed` | boolean | default `false` |

---

## 5. Controller & Endpoint Map

### 5.1 Auth (`/api/auth`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/login` | Public | Validate credentials, return JWT |
| POST | `/auth/register` | Public | Create user account |

### 5.2 Health (`/api/health`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | Public | DB ping + memory heap check (300MB limit) |

### 5.3 Listings (`/api/listings`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/listings/search` | JWT | Full-text search with filters, pagination |
| GET | `/listings/search/suggest` | JWT | Autocomplete suggestions |
| GET | `/listings/search/facets` | JWT | Dynamic facet counts for search |
| GET | `/listings` | JWT | Paginated listing with filters |
| GET | `/listings/summary` | JWT | Aggregate stats |
| GET | `/listings/facets` | JWT | Category/brand facets |
| GET | `/listings/:id` | JWT | Single listing detail |
| GET | `/listings/:id/revisions` | JWT | Version history |
| POST | `/listings` | JWT | Create single listing |
| POST | `/listings/bulk` | JWT | Bulk update listings |
| POST | `/listings/import` | JWT | Excel file import |
| POST | `/listings/:id/restore` | JWT | Restore soft-deleted |
| PUT | `/listings/:id` | JWT | Full update (with optimistic lock) |
| PATCH | `/listings/:id/status` | JWT | Change status |
| DELETE | `/listings/:id` | JWT | Soft delete |

### 5.4 Channels (`/api/channels`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/channels` | JWT | List connections |
| GET | `/channels/:channel/auth-url` | JWT | Get OAuth URL for marketplace |
| GET | `/channels/:channel/callback` | JWT | OAuth callback handler |
| DELETE | `/channels/:connectionId` | JWT | Remove connection |
| POST | `/channels/:connectionId/test` | JWT | Test connection health |
| POST | `/channels/publish` | JWT | Publish listing to channel |
| POST | `/channels/sync` | JWT | Sync listing from channel |
| GET | `/channels/:connectionId/listings` | JWT | Listings for connection |
| GET | `/channels/listings/:listingId/channels` | JWT | Channel status per listing |
| POST | `/channels/publish-multi` | JWT | Publish to multiple channels |
| POST | `/channels/listings/:listingId/channel/:channel/update` | JWT | Update channel listing |
| POST | `/channels/listings/:listingId/channel/:channel/end` | JWT | End channel listing |
| POST | `/channels/bulk-publish` | JWT | Bulk publish multiple listings |
| POST | `/channels/webhooks/ebay` | Public | eBay webhook receiver |
| POST | `/channels/webhooks/shopify` | Public | Shopify webhook receiver (HMAC) |

### 5.5 Stores (`/api/stores`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/stores` | JWT | List all stores |
| GET | `/stores/by-channel/:channel` | JWT | Stores by channel |
| GET | `/stores/:storeId` | JWT | Single store |
| POST | `/stores` | JWT | Create store |
| PUT | `/stores/:storeId` | JWT | Update store |
| DELETE | `/stores/:storeId` | JWT | Delete store |
| GET | `/stores/instances/list` | JWT | List channel instances |
| GET | `/stores/instances/:instanceId` | JWT | Single instance |
| POST | `/stores/instances` | JWT | Create instance |
| POST | `/stores/instances/publish` | JWT | Publish instance |
| POST | `/stores/instances/bulk-publish` | JWT | Bulk publish instances |
| POST | `/stores/instances/:instanceId/end` | JWT | End instance listing |
| POST | `/stores/publish-multi-store` | JWT | Publish across stores |
| GET | `/stores/listing/:listingId/overview` | JWT | All-store overview for listing |
| GET | `/stores/demo/logs` | JWT | Demo simulation audit logs |
| POST | `/stores/demo/simulate-order/:instanceId` | JWT | Simulate incoming order |

### 5.6 AI Enhancements (`/api/ai-enhancements`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/ai-enhancements` | JWT | List enhancements |
| GET | `/ai-enhancements/stats` | JWT | Aggregate stats |
| GET | `/ai-enhancements/:id` | JWT | Single enhancement |
| GET | `/ai-enhancements/listing/:listingId` | JWT | Enhancements for listing |
| POST | `/ai-enhancements/request` | JWT | Request new enhancement |
| POST | `/ai-enhancements/bulk-request` | JWT | Bulk request |
| POST | `/ai-enhancements/:id/approve` | JWT | Approve enhancement |
| POST | `/ai-enhancements/:id/apply` | JWT | Apply to listing |
| POST | `/ai-enhancements/:id/reject` | JWT | Reject with reason |

### 5.7 Ingestion (`/api/ingestion`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/ingestion/jobs` | JWT | Create ingestion job |
| GET | `/ingestion/jobs` | JWT | List jobs |
| GET | `/ingestion/jobs/:id` | JWT | Job detail |
| POST | `/ingestion/jobs/:id/retry` | JWT | Retry failed job |
| POST | `/ingestion/jobs/:id/cancel` | JWT | Cancel job |
| GET | `/ingestion/stats` | JWT | Aggregate stats |
| GET | `/ingestion/review` | JWT | Jobs needing review |
| POST | `/ingestion/review/:id/approve` | JWT | Approve with corrections |
| POST | `/ingestion/review/:id/reject` | JWT | Reject job |

### 5.8 Fitment (`/api/fitment`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/fitment/makes` | JWT | List makes (fuzzy search) |
| GET | `/fitment/makes/:makeId/models` | JWT | Models for make |
| GET | `/fitment/models/:modelId/submodels` | JWT | Submodels for model |
| GET | `/fitment/engines` | JWT | List engines |
| GET | `/fitment/search` | JWT | Search by vehicle (year/make/model) |
| GET | `/fitment/listing/:listingId` | JWT | Fitments for listing |
| POST | `/fitment/listing/:listingId` | JWT | Add fitment |
| DELETE | `/fitment/:fitmentId` | JWT | Remove fitment |
| PATCH | `/fitment/:fitmentId/verify` | JWT | Mark verified |
| POST | `/fitment/detect` | JWT | AI fitment detection from text |
| POST | `/fitment/bulk-import` | JWT | ACES XML/CSV import |

### 5.9 Inventory (`/api/inventory`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/inventory/:listingId` | JWT | Ledger for listing |
| POST | `/inventory/:listingId/adjust` | JWT | Manual quantity adjustment |
| POST | `/inventory/:listingId/reserve` | JWT | Reserve for order |
| POST | `/inventory/:listingId/release` | JWT | Release reservation |
| GET | `/inventory/alerts/low-stock` | JWT | Low stock items |
| POST | `/inventory/reconcile` | JWT | Reconcile ledger vs events |
| GET | `/inventory/events/log` | JWT | Event audit log |
| GET | `/inventory/duplicates/scan` | JWT | Duplicate detection |

### 5.10 Orders (`/api/orders`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/orders` | JWT | Paginated list with filters |
| GET | `/orders/stats` | JWT | Order statistics |
| GET | `/orders/:id` | JWT | Order detail with items |
| PATCH | `/orders/:id/status` | JWT | FSM status transition |
| PATCH | `/orders/:id/shipping` | JWT | Update shipping/tracking |
| POST | `/orders/:id/refund` | JWT | Process refund |

**Order State Machine:**
```
pending → confirmed → processing → shipped → delivered → completed
     ↓         ↓           ↓
  cancelled  cancelled  cancelled
                              shipped → delivered → refund_requested → refunded
                                           ↓              ↓
                                        disputed       disputed
```

### 5.11 Dashboard (`/api/dashboard`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/dashboard/summary` | JWT | Cached overview (60s TTL) |
| GET | `/dashboard/sales` | JWT | Sales by day/channel/top items |
| GET | `/dashboard/activity` | JWT | Recent audit log entries |
| GET | `/dashboard/channel-health` | JWT | Channel connection status |
| GET | `/dashboard/kpis` | JWT | Catalog size, published, sold, avg days to sell |
| GET | `/dashboard/inventory-alerts` | JWT | Low/out of stock counts |
| GET | `/dashboard/multi-store` | JWT | Multi-store & AI metrics |
| GET | `/audit-logs` | JWT | Query audit log |

### 5.12 Settings (`/api/settings`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/settings` | JWT | All settings |
| GET | `/settings/:category` | JWT | Settings by category |
| PUT | `/settings/:category/:key` | JWT | Upsert setting |
| GET | `/settings/shipping-profiles` | JWT | List shipping profiles |
| POST | `/settings/shipping-profiles` | JWT | Create profile |
| PUT | `/settings/shipping-profiles/:id` | JWT | Update profile |
| DELETE | `/settings/shipping-profiles/:id` | JWT | Delete profile |
| GET | `/settings/pricing-rules` | JWT | List pricing rules |
| POST | `/settings/pricing-rules` | JWT | Create rule |
| PUT | `/settings/pricing-rules/:id` | JWT | Update rule |
| DELETE | `/settings/pricing-rules/:id` | JWT | Delete rule |

### 5.13 Storage (`/api/storage`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/storage/upload-url` | JWT | Get pre-signed S3 PUT URL |
| POST | `/storage/confirm` | JWT | Confirm upload, move temp→permanent |
| GET | `/storage/listing/:listingId` | JWT | Images for listing |
| PATCH | `/storage/:assetId` | JWT | Update asset metadata |
| DELETE | `/storage/:assetId` | JWT | Soft delete image |
| POST | `/storage/bulk-upload-urls` | JWT | Batch pre-signed URLs |

### 5.14 Notifications (`/api/notifications`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/notifications` | JWT | Paginated notifications |
| GET | `/notifications/unread-count` | JWT | Unread count |
| PATCH | `/notifications/:id/read` | JWT | Mark read |
| POST | `/notifications/mark-all-read` | JWT | Mark all read |
| DELETE | `/notifications/:id` | JWT | Dismiss notification |

**Total Endpoints: ~100+**

---

## 6. Service Method Inventory

### 6.1 AuthService
| Method | Description |
|--------|-------------|
| `validateAndSign(email, password)` | bcrypt compare → JWT sign (`sub`, `email`, `role`), updates `lastLoginAt` |
| `register(email, password, name)` | Normalize email, bcrypt hash (12 rounds), check duplicates (ConflictException) |

### 6.2 ListingsService
| Method | Description |
|--------|-------------|
| `create(dto, userId)` | Transactional create + initial revision |
| `findOne(id)` | Find with soft-delete filter |
| `update(id, dto, userId)` | Optimistic lock (version check), transactional update + revision |
| `updateStatus(id, status, userId)` | Status transition + revision |
| `softDelete(id, userId)` | Soft delete + revision |
| `restore(id, userId)` | Restore + revision |
| `bulkUpdate(ids, dto, userId)` | Batch update |
| `findAll(filters)` | Paginated query with brand/category/status filters |
| `getSummary()` | Aggregate counts by status |
| `getFacets()` | Distinct brands, categories with counts |
| `getRevisions(listingId)` | Version history ordered desc |
| `importFromFolder()` | Scan folder for XLSX files, parse headers → 76 entity columns, upsert via `ON CONFLICT` |

### 6.3 SearchService
| Method | Description |
|--------|-------------|
| `search(query, filters, page)` | PostgreSQL FTS (`websearch_to_tsquery` + prefix), `ts_rank_cd` scoring, `ts_headline` highlighting, fuzzy fallback via `similarity()` |
| `suggest(query)` | Autocomplete based on title prefix |
| `getFacets(query)` | Dynamic facet counts for search results |

**In-memory cache:** `MemCache` class, 200 entries max, used for search result caching.

### 6.4 ChannelsService
| Method | Description |
|--------|-------------|
| `getConnections()` | List active connections |
| `getAuthUrl(channel)` | Generate OAuth authorization URL |
| `handleOAuthCallback(channel, code)` | Exchange code → encrypt tokens → save connection |
| `disconnect(connectionId)` | Remove connection |
| `testConnection(connectionId)` | Decrypt tokens, test API call |
| `publishListing(connectionId, listingId)` | Enqueue publish job |
| `syncListing(connectionId, listingId)` | Enqueue sync job |
| `getChannelListings(connectionId)` | Listings for connection |
| `getListingChannelStatuses(listingId)` | Per-SKU channel status |
| `publishMulti(listingId, channels)` | Multi-channel publish |
| `updateChannelListing(listingId, channel)` | Update existing channel listing |
| `endChannelListing(listingId, channel)` | End/delist from channel |
| `bulkPublish(listingIds, channel)` | Batch publish |
| `logWebhook(channel, payload)` | Persist webhook payload |
| `refreshTokensIfNeeded(connection)` | Auto-refresh with 5-min expiry buffer |

### 6.5 StoresService
| Method | Description |
|--------|-------------|
| `findAll()` / `findByChannel(channel)` / `findOne(id)` | Store queries |
| `create(dto)` | Create store (demo: auto-generate externalStoreId) |
| `update(id, dto)` | Update store |
| `remove(id)` | Delete store |
| `createInstance(dto)` | Create listing-channel-instance |
| `publishInstance(instanceId)` | Publish (demo mode: simulate) |
| `bulkPublish(instanceIds)` | Batch publish |
| `endInstance(instanceId)` | End listing on channel |
| `publishMultiStore(listingId, storeIds, overrides)` | Publish to multiple stores |
| `getListingOverview(listingId)` | All-store status for listing |
| `getDemoLogs(filters)` | Query demo simulation logs |
| `simulateOrder(instanceId)` | Simulate incoming order (demo) |

### 6.6 AiEnhancementService
| Method | Description |
|--------|-------------|
| `findAll(filters)` | Paginated list |
| `findOne(id)` | Single enhancement |
| `findByListing(listingId)` | Enhancements per listing |
| `getStats()` | Aggregate stats by type/status |
| `requestEnhancement(dto)` | Create + process (demo: simulated AI) |
| `processEnhancement(enhancement)` | AI processing for 5 enhancement types |
| `bulkRequest(listingId, types)` | Batch request |
| `approve(id, userId)` | Mark approved |
| `apply(id)` | Write enhanced value back to listing |
| `reject(id, reason)` | Reject with reason |

### 6.7 IngestionService
| Method | Description |
|--------|-------------|
| `createJob(dto)` | Validate image assets, create job, enqueue |
| `findAll(page, status)` | Paginated job list |
| `findOne(id)` | Job with AI results |
| `retry(id)` | Reset and re-enqueue |
| `cancel(id)` | Cancel pending/processing job |
| `getStats()` | Aggregate by status/mode |

### 6.8 ReviewService (Ingestion)
| Method | Description |
|--------|-------------|
| `findNeedingReview(page)` | Jobs with `review_status = 'needs_review'` |
| `approve(id, corrections)` | Create draft `ListingRecord` from AI results + corrections |
| `reject(id, notes)` | Mark rejected with notes |

### 6.9 FitmentService
| Method | Description |
|--------|-------------|
| `getMakes(search)` | Fuzzy make search via `ILIKE` |
| `getModelsByMake(makeId)` | Models for make |
| `getSubmodels(modelId)` | Submodels for model |
| `getEngines()` | All engines |
| `search(year, makeId, modelId)` | Parts by vehicle (year range overlap) |
| `getForListing(listingId)` | Fitments with relations |
| `addFitment(listingId, dto)` | Create part_fitment |
| `removeFitment(fitmentId)` | Delete |
| `verifyFitment(fitmentId, userId)` | Mark verified |
| `detectFitment(text)` | Regex + DB fuzzy match |

### 6.10 FitmentMatcherService
| Method | Description |
|--------|-------------|
| `detectFromText(text)` | Regex extraction: year ranges (`\\d{4}[-–]\\d{4}`), makes, models, submodels, engine codes |
| `matchToDatabase(parsed)` | Fuzzy match against fitment reference tables |

### 6.11 FitmentImportService
| Method | Description |
|--------|-------------|
| `processImportBatch(rows)` | Upsert makes/models/submodels/years/engines from ACES data |

### 6.12 InventoryService
| Method | Description |
|--------|-------------|
| `getOrCreateLedger(listingId)` | Auto-create ledger on first access |
| `adjust(listingId, dto)` | **SERIALIZABLE** transaction, pessimistic write lock, idempotency key |
| `reserve(listingId, quantity, orderId)` | Reserve stock for order (SERIALIZABLE) |
| `release(listingId, quantity, orderId)` | Release reservation (SERIALIZABLE) |
| `getLowStock(limit, threshold)` | Below-threshold items |
| `reconcile(listingIds)` | Sum events vs ledger, apply corrections |
| `getEventLog(listingId, page)` | Paginated event history |
| `findDuplicates(threshold)` | `similarity()` + SKU/MPN matching |

### 6.13 OrdersService
| Method | Description |
|--------|-------------|
| `findAll(filters)` | Paginated with channel/status/date filters |
| `findOne(id)` | Order + items eager load |
| `getStats()` | Counts by status, total revenue |
| `transitionStatus(id, newStatus)` | FSM-enforced transition |
| `updateShipping(id, dto)` | Auto-set `shipped` status when tracking added |
| `processRefund(id, amount, reason)` | Validate amount ≤ total, record refund |
| `importOrder(data)` | Idempotent import (upsert by channel+externalOrderId) |

### 6.14 DashboardService
| Method | Description |
|--------|-------------|
| `getSummary()` | Total listings/channels/orders/revenue, cached 60s |
| `getSales(period, channel)` | Sales by day, by channel, top items |
| `getActivity(limit)` | Recent audit log |
| `getChannelHealth()` | Raw SQL: connection status, last sync, error counts |
| `getKpis()` | Catalog size, published %, sold, avg days to sell |
| `getInventoryAlerts()` | Low stock and out-of-stock counts |
| `getMultiStoreMetrics()` | Store count, instance count, AI enhancement stats |
| `writeAuditLog(data)` | Create audit_log entry |

### 6.15 SettingsService
| Method | Description |
|--------|-------------|
| `getAllSettings()` | All settings (in-memory cache) |
| `getByCategory(category)` | Filter by category |
| `upsert(category, key, value, userId)` | Insert or update setting |
| `getShippingProfiles()` | List profiles |
| `createShippingProfile(dto)` | Create (handle default flag) |
| `updateShippingProfile(id, dto)` | Update |
| `deleteShippingProfile(id)` | Delete |
| `getPricingRules()` | List rules (ordered by priority) |
| `createPricingRule(dto)` / `update` / `delete` | Rule CRUD |

### 6.16 StorageService
| Method | Description |
|--------|-------------|
| `getUploadUrl(filename, mimeType)` | Pre-signed S3 PUT URL (temp path) |
| `getBulkUploadUrls(files)` | Batch pre-signed URLs |
| `confirmUpload(assetId)` | Move S3 object temp→permanent, create asset record |
| `getListingImages(listingId)` | Active images (sort order) |
| `updateAsset(assetId, dto)` | Update sort order, primary flag |
| `deleteAsset(assetId)` | Soft delete |
| `getCdnUrl(s3Key)` | CloudFront URL (or S3 direct fallback) |

### 6.17 ImageProcessorService
| Method | Description |
|--------|-------------|
| `processImage(buffer)` | Resize max 2048px, convert to WebP |
| `generateThumbnail(buffer)` | 200x200 cover crop, WebP |
| `generateMedium(buffer)` | 800x800 inside fit, WebP |
| `generateBlurhash(buffer)` | Blurhash string for placeholder |
| `validateMagicBytes(buffer)` | JPEG/PNG/WebP/HEIC header validation |

### 6.18 NotificationsService
| Method | Description |
|--------|-------------|
| `create(dto)` | Save + emit `notification.created` event |
| `findAll(recipientId, page)` | Paginated list |
| `getUnreadCount(recipientId)` | Count where `read = false` |
| `markRead(id)` | Set read + readAt |
| `markAllRead(recipientId)` | Bulk mark read |
| `dismiss(id)` | Set dismissed |
| `cleanupOld()` | Delete notifications > 90 days |

### 6.19 TokenEncryptionService
| Method | Description |
|--------|-------------|
| `encrypt(plaintext)` | AES-256-GCM, output: `base64(iv):base64(authTag):base64(ciphertext)` |
| `decrypt(ciphertext)` | Reverse AES-256-GCM decryption |

**Key:** `CHANNEL_ENCRYPTION_KEY` env var (64-char hex = 32 bytes)

---

## 7. Background Job Queues (BullMQ)

| Queue | Processor | Concurrency | Job Types |
|-------|-----------|-------------|-----------|
| `channels` | `ChannelPublishProcessor` | 2 | `publish` — fetch listing + call adapter |
| `ingestion` | `IngestionProcessor` | 3 | Image → Vision API → normalize → save AiResult → auto-approve if ≥0.85 confidence |
| `fitment` | `FitmentImportProcessor` | 1 | ACES XML/CSV batch import (1000 rows/batch with progress tracking) |
| `inventory` | `InventorySyncProcessor` | 1 | `reconcile`, `low-stock-alert`, `duplicate-scan` |
| `orders` | `OrderImportProcessor` | 1 | `import-from-channels` (eBay+Shopify, last 24h), `auto-complete` (delivered >14d) |
| `dashboard` | `AggregationProcessor` | 1 | `recompute-summary`, `daily-sales-rollup` |
| `storage-thumbnails` | `ThumbnailProcessor` | 5 | Download S3 image → Sharp resize → upload thumb → update asset |
| `storage-cleanup` | `CleanupProcessor` | 1 | Delete soft-deleted >7 days + orphaned temp uploads >24h |

**Default Job Options (global):** 3 attempts, exponential backoff starting at 1 second.

**Ingestion Retry Schedule:** 30s → 120s → 600s (exponential backoff per attempt).

---

## 8. Authentication & Authorization

### JWT Flow
1. `POST /api/auth/login` → bcrypt compare password → sign JWT with `{ sub: userId, email, role }`
2. JWT secret: `JWT_SECRET` env var
3. JWT expiry: `JWT_EXPIRY_SECONDS` (default 86400 = 24h)
4. `JwtStrategy` (Passport): Extract Bearer token → validate user exists + `active: true` → attach to request

### Role-Based Access Control
- **Roles:** `admin`, `manager`, `user`, `viewer`
- **Guard:** `RolesGuard` (Reflector-based) — applied per route via `@Roles()` decorator
- **Global Guard:** `ThrottlerGuard` — rate limiting on all endpoints

### Token Storage for Channels
- OAuth tokens encrypted at rest with **AES-256-GCM**
- Key: `CHANNEL_ENCRYPTION_KEY` (64-char hex)
- Format: `base64(iv):base64(authTag):base64(ciphertext)`
- Auto-refresh: Tokens refreshed when within 5 minutes of expiry

---

## 9. External Integrations

### 9.1 eBay (via `EbayAdapter`)
- **API:** eBay Inventory API v1
- **Auth:** OAuth2 Authorization Code Grant
- **Sandbox:** Supported via `EBAY_SANDBOX` env var
- **Flow:** Create Inventory Item → Create Offer → Publish Offer
- **Sync:** `getRecentOrders()` fetches last 24h orders
- **Config:** `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI`, `EBAY_MARKETPLACE_ID`

### 9.2 Shopify (via `ShopifyAdapter`)
- **API:** Shopify Admin REST API 2024-01
- **Auth:** OAuth2 with scope `read_products,write_products,read_orders`
- **Endpoints:** Product CRUD, Order retrieval
- **Webhooks:** HMAC-SHA256 verification (`X-Shopify-Hmac-Sha256` header)
- **Config:** `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`

### 9.3 OpenAI Vision (via `OpenAiVisionProvider`)
- **Model:** GPT-4o
- **Use:** Motor parts identification from images
- **Prompt:** Structured JSON extraction (title, brand, MPN, OEM number, part type, condition, price estimate, description, features, fitment)
- **Cost Estimation:** Input tokens × $5/1M + Output tokens × $15/1M
- **Config:** `OPENAI_API_KEY`
- **Fallback:** `AiService` supports provider routing with fallback

### 9.4 AWS S3 + CloudFront
- **Uploads:** Pre-signed PUT URLs (client → S3 direct)
- **Path Schema:** `temp/{uuid}/{filename}` → `listings/{listingId}/{uuid}.webp`
- **CDN:** CloudFront distribution (optional, falls back to S3 direct URL)
- **Config:** `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `CDN_DOMAIN`

---

## 10. Real-time & Event System

### WebSocket Gateway
- **Namespace:** `/notifications`
- **Library:** Socket.IO
- **CORS:** Same as HTTP CORS config
- **Room Model:** `user:{userId}` rooms
- **Events Emitted to Client:** `notification` (full notification payload)

### EventEmitter2 Triggers
The `NotificationTriggers` service listens to cross-module events and creates notifications:

| Event | Source | Notification |
|-------|--------|-------------|
| `ingestion.completed` | Ingestion Processor | "Ingestion job completed" |
| `ingestion.failed` | Ingestion Processor | "Ingestion job failed" (error severity) |
| `ingestion.review_needed` | Ingestion Processor | "Job needs review" (warning) |
| `channel.connected` | Channels Service | "Channel connected" (success) |
| `channel.error` | Channels Service | "Channel error" (error) |
| `listing.published` | Channels Service | "Listing published" (success) |
| `inventory.low_stock` | Inventory Service | "Low stock alert" (warning) |
| `inventory.out_of_stock` | Inventory Service | "Out of stock" (error) |
| `order.new` | Orders Service | "New order received" (success) |
| `order.shipped` | Orders Service | "Order shipped" (info) |
| `system.alert` | Any module | System alert (configurable severity) |

---

## 11. Database Relations & Constraints

### Foreign Key Map

```
listing_records (PK: id)
  ├── listing_revisions.listingId         (no cascade specified)
  ├── image_assets.listing_id             → ON DELETE SET NULL
  ├── inventory_ledger.listing_id         → ON DELETE CASCADE (1:1)
  ├── part_fitments.listing_id            → ON DELETE CASCADE
  ├── listing_channel_instances.listing_id → ON DELETE CASCADE
  ├── ai_enhancements.listing_id          → ON DELETE CASCADE
  └── ingestion_jobs.listing_id           → ON DELETE SET NULL

channel_connections (PK: id)
  ├── channel_listings.connection_id      → ON DELETE CASCADE
  ├── stores.connection_id                → ON DELETE CASCADE
  ├── listing_channel_instances.connection_id → ON DELETE CASCADE
  └── orders.connection_id                → ON DELETE SET NULL

stores (PK: id)
  └── listing_channel_instances.store_id  → ON DELETE CASCADE

orders (PK: id)
  └── order_items.order_id                → ON DELETE CASCADE

ingestion_jobs (PK: id)
  └── ai_results.job_id                   → ON DELETE CASCADE

fitment_makes (PK: id)
  ├── fitment_models.make_id              → ON DELETE CASCADE
  └── part_fitments.make_id               → ON DELETE NO ACTION

fitment_models (PK: id)
  ├── fitment_submodels.model_id          → ON DELETE CASCADE
  └── part_fitments.model_id              → ON DELETE NO ACTION

fitment_submodels (PK: id)
  └── part_fitments.submodel_id           → ON DELETE NO ACTION

fitment_engines (PK: id)
  └── part_fitments.engine_id             → ON DELETE NO ACTION
```

### Unique Constraints Summary

| Table | Unique Columns |
|-------|---------------|
| `users` | `email` |
| `listing_records` | `(sourceFileName, sheetName, sourceRowNumber)` |
| `listing_revisions` | `(listingId, version)` |
| `channel_listings` | `(connection_id, external_id)` |
| `listing_channel_instances` | `(listing_id, store_id)` |
| `orders` | `(channel, external_order_id)` |
| `inventory_ledger` | `listing_id` (1:1) |
| `inventory_events` | `idempotency_key` |
| `image_assets` | `(s3_bucket, s3_key)` |
| `tenant_settings` | `(category, key)` |
| `fitment_makes` | `slug`, `aces_id` |
| `fitment_models` | `(make_id, slug)`, `aces_id` |
| `fitment_submodels` | `(model_id, name)`, `aces_id` |
| `fitment_engines` | `code`, `aces_id` |
| `fitment_years` | `year` |
| `part_fitments` | `(listing_id, make_id, model_id, year_start, year_end, engine_id)` |

### Notable Indexes

| Index | Type | Purpose |
|-------|------|---------|
| `listing_records.searchVector` | tsvector | Full-text search |
| `inventory_ledger` partial | WHERE `qty_total - qty_reserved <= threshold` | Low-stock detection |
| `image_assets` partial | WHERE `deleted_at IS NULL` | Active images only |
| `ingestion_jobs` partial | WHERE `review_status = 'needs_review'` | Review queue |
| `part_fitments` composite | `(make_id, model_id, year_start, year_end)` | Vehicle compatibility search |

---

## 12. Error Handling & Resilience

### NestJS Exception Layer
- `ConflictException` — duplicate registration, optimistic lock failures
- `NotFoundException` — missing entities
- `BadRequestException` — invalid status transitions, validation failures
- `UnauthorizedException` — JWT failures, inactive users

### Optimistic Locking
- `ListingRecord.version` — `@VersionColumn()` prevents concurrent update conflicts
- `InventoryLedger.version` — `@VersionColumn()` for inventory consistency

### Transaction Isolation
- **Inventory operations:** `SERIALIZABLE` isolation level + pessimistic `FOR UPDATE` locks
- **Listing CRUD:** Standard transactional (default isolation)

### Idempotency
- `inventory_events.idempotency_key` — prevents duplicate event creation
- `orders` unique on `(channel, external_order_id)` — prevents duplicate order imports
- `listing_records` unique on `(sourceFileName, sheetName, sourceRowNumber)` — prevents duplicate imports

### Job Retry Strategy
- **Global BullMQ default:** 3 attempts, exponential backoff (1s base)
- **Ingestion:** Custom backoff: 30s → 120s → 600s
- **Ingestion auto-approve:** Confidence ≥ 0.85 auto-approved, else → `needs_review`

### Rate Limiting
- 3-tier throttler prevents API abuse (10/s, 100/min, 1000/hr)

---

## 13. Migrations

**Migration file:** `src/migrations/1772145877171-Migration.ts` (185 lines)

Creates all tables with full schema including:
- All 25+ tables with columns, types, constraints
- All foreign key relationships
- All indexes (standard + partial)
- Adds lifecycle columns to `listing_records` (`status`, `version`, `deletedAt`, `updatedAt`, `publishedAt`, etc.)

**Migration table:** `typeorm_migrations`  
**Synchronize:** `false` (migrations only, no auto-sync)

---

## 14. Scripts & Utilities

| Script | Location | Purpose |
|--------|----------|---------|
| `extract-fitment.ts` | `src/scripts/` | Extract fitment data from listing titles |
| `import-listings.ts` | `src/scripts/` | Batch import listings from files |

---

## 15. Observations & Recommendations

### Architecture Strengths
1. **Clean module separation** — Each domain has its own module with isolated controller/service/entity
2. **Event-sourced inventory** — Full audit trail via `inventory_events` with idempotency
3. **Multi-channel abstraction** — `ChannelAdapter` interface allows new marketplaces without core changes
4. **AI pipeline** — Complete ingestion → AI analysis → review → listing creation workflow
5. **Demo mode** — Full simulation layer for development/demo without real API calls
6. **Multi-store support** — Per-store price/quantity overrides via `listing_channel_instances`
7. **Real-time notifications** — WebSocket + persistent storage with event-driven triggers
8. **ACES standard fitment** — Industry-standard vehicle compatibility data model

### Potential Concerns

1. **No DTOs found for most modules** — Controllers appear to accept raw objects or use inline validation. Consider adding explicit DTO classes with `class-validator` decorators for input validation and Swagger documentation.

2. **Search cache is in-memory (MemCache)** — The 200-entry in-memory search cache won't survive restarts and isn't shared across instances. Consider Redis caching if horizontal scaling is planned.

3. **Settings cache is in-memory** — Same concern as search cache for multi-instance deployments.

4. **`synchronize: false` is correct** — Good practice for production. Only migrations are used.

5. **Webhook endpoints are public** — eBay/Shopify webhooks bypass JWT (correct behavior), but rely on HMAC verification. Ensure `SHOPIFY_API_SECRET` and eBay signature validation are always active.

6. **Token encryption key management** — `CHANNEL_ENCRYPTION_KEY` is critical. Consider rotating strategy and secure storage (e.g., AWS Secrets Manager).

7. **Missing `@Roles()` usage** — `RolesGuard` exists but actual role-restricted endpoints aren't visible in most controllers. Consider adding role restrictions to sensitive operations (delete, settings, admin dashboard).

8. **Single migration file** — All schema changes are in one 185-line migration. Future changes should use incremental migrations.

9. **Order state machine** — Well-designed FSM but implemented as hardcoded maps. Consider extracting to a dedicated state machine library for extensibility.

10. **No pagination on some list endpoints** — Verify all list endpoints have pagination to prevent large result set issues.

11. **Dashboard raw SQL** — `getChannelHealth()` uses raw SQL queries. Consider using QueryBuilder for type safety.

12. **Image cleanup interval** — CleanupProcessor runs on-demand via queue. Consider scheduling via cron for consistent cleanup.

---

## Appendix: Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | TypeORM | PostgreSQL connection |
| `REDIS_HOST` / `REDIS_PORT` | BullMQ | Redis connection |
| `JWT_SECRET` | Auth | JWT signing key |
| `JWT_EXPIRY_SECONDS` | Auth | Token lifetime (default 86400) |
| `CORS_ORIGIN` | Main | CORS allowed origin (default `http://localhost:5173`) |
| `NODE_ENV` | Main | Environment (`production` disables Swagger) |
| `CHANNEL_ENCRYPTION_KEY` | Channels | AES-256-GCM key (64-char hex) |
| `CHANNEL_DEMO_MODE` | Channels/Stores | Enable demo simulation |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` / `EBAY_REDIRECT_URI` / `EBAY_MARKETPLACE_ID` / `EBAY_SANDBOX` | eBay Adapter | eBay API config |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` / `SHOPIFY_SCOPES` | Shopify Adapter | Shopify API config |
| `OPENAI_API_KEY` | Ingestion AI | OpenAI Vision API |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET` / `CDN_DOMAIN` | Storage | AWS S3 + CloudFront |

---

*End of audit report.*
