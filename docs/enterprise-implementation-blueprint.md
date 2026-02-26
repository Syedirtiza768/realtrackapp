# RealTrackApp — Enterprise Implementation Blueprint

> **Version:** 1.0  
> **Date:** 2026-02-26  
> **Author:** Senior Full-Stack Marketplace Architect  
> **Stack:** React 18 + Vite / NestJS 11 / TypeORM 0.3 / PostgreSQL 16 / Redis + BullMQ / AWS S3  
> **Domain:** `mhn.realtrackapp.com` — Port 4191 backend, Nginx reverse proxy  
> **Current State:** Strong catalog search (FTS + trigram + facets + 76-col entity) with mock ingestion  
> **Target State:** End-to-end AI-powered, multi-marketplace, inventory-synced production commerce platform

---

## Table of Contents

1. [Module 1 — Listing CRUD](#module-1--listing-crud)
2. [Module 2 — Real AI Ingestion Pipeline](#module-2--real-ai-ingestion-pipeline)
3. [Module 3 — Vehicle Fitment System (ACES)](#module-3--vehicle-fitment-system-aces)
4. [Module 4 — Marketplace Integrations (eBay + Shopify)](#module-4--marketplace-integrations-ebay--shopify)
5. [Module 5 — Unified Inventory & Sync Engine](#module-5--unified-inventory--sync-engine)
6. [Module 6 — Real Dashboard (API-driven)](#module-6--real-dashboard-api-driven)
7. [Module 7 — Image Storage Architecture](#module-7--image-storage-architecture)
8. [Module 8 — Orders Module](#module-8--orders-module)
9. [Module 9 — Settings Module](#module-9--settings-module)
10. [Module 10 — Notification System](#module-10--notification-system)
11. [Execution Roadmap](#execution-roadmap)
12. [Dependency Graph](#dependency-graph)
13. [Risk Register](#risk-register)
14. [Technical Debt Cleanup](#technical-debt-cleanup)

---

## Module 1 — Listing CRUD

**Priority:** 🔴 Critical  
**Estimated Complexity:** Medium  
**Estimated Duration:** 2 weeks  

### Backend Architecture

```
backend/src/listings/
├── listing-record.entity.ts        ← ADD: status, version, deletedAt, updatedBy columns
├── listing-revision.entity.ts      ← NEW: revision history entity
├── listings.controller.ts          ← ADD: POST, PUT, PATCH, DELETE, bulk endpoints
├── listings.service.ts             ← ADD: create, update, softDelete, bulkUpdate methods
├── dto/
│   ├── create-listing.dto.ts       ← NEW
│   ├── update-listing.dto.ts       ← NEW
│   ├── patch-status.dto.ts         ← NEW
│   └── bulk-update.dto.ts          ← NEW
└── guards/
    └── optimistic-lock.guard.ts    ← NEW
```

**Key Design Decisions:**
- Extend existing `ListingRecord` entity with lifecycle columns (NO separate table — preserves the 76-column eBay structure)
- Revision stored in separate `listing_revisions` table (full JSON snapshots, not column diffs)
- Soft delete via TypeORM `@DeleteDateColumn`
- Optimistic locking via `@VersionColumn`

### Database Schema

```sql
-- ═══ ALTER existing listing_records table ═══

ALTER TABLE listing_records
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','published','sold','delisted','archived')),
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN updated_by UUID NULL,
  ADD COLUMN published_at TIMESTAMPTZ NULL,
  ADD COLUMN ebay_listing_id VARCHAR(64) NULL,
  ADD COLUMN shopify_product_id VARCHAR(64) NULL;

CREATE INDEX idx_listing_status ON listing_records (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_listing_deleted ON listing_records (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_listing_updated ON listing_records (updated_at DESC);

-- ═══ listing_revisions ═══

CREATE TABLE listing_revisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    UUID NOT NULL REFERENCES listing_records(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  status_before VARCHAR(20),
  status_after  VARCHAR(20) NOT NULL,
  snapshot      JSONB NOT NULL,            -- full column snapshot at this version
  change_reason TEXT,                       -- "manual_edit" | "ai_update" | "bulk_edit" | "marketplace_sync"
  changed_by    UUID,                       -- user ID (future auth)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, version)
);

CREATE INDEX idx_revision_listing ON listing_revisions (listing_id, version DESC);
```

### Entity Changes (TypeORM)

```typescript
// ADD to ListingRecord entity:

@Column({ type: 'varchar', length: 20, default: 'draft' })
status: 'draft' | 'ready' | 'published' | 'sold' | 'delisted' | 'archived';

@VersionColumn()
version: number;

@DeleteDateColumn({ type: 'timestamptz', nullable: true })
deletedAt: Date | null;

@Column({ type: 'timestamptz', nullable: true })
updatedAt: Date;

@Column({ type: 'uuid', nullable: true })
updatedBy: string | null;

@Column({ type: 'timestamptz', nullable: true })
publishedAt: Date | null;

@Column({ type: 'varchar', length: 64, nullable: true })
ebayListingId: string | null;

@Column({ type: 'varchar', length: 64, nullable: true })
shopifyProductId: string | null;
```

```typescript
// NEW: listing-revision.entity.ts

@Entity({ name: 'listing_revisions' })
@Unique('uq_revision_version', ['listingId', 'version'])
export class ListingRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  listingId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  statusBefore: string | null;

  @Column({ type: 'varchar', length: 20 })
  statusAfter: string;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  changeReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  changedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
```

### API Endpoints

| Method  | Endpoint                          | Body / Query                         | Response                | Auth   |
|---------|-----------------------------------|--------------------------------------|-------------------------|--------|
| `POST`  | `/api/listings`                   | `CreateListingDto`                   | `{ listing, revision }` | Bearer |
| `PUT`   | `/api/listings/:id`               | `UpdateListingDto` + `version` header| `{ listing, revision }` | Bearer |
| `PATCH` | `/api/listings/:id/status`        | `{ status, reason? }`               | `{ listing, revision }` | Bearer |
| `DELETE`| `/api/listings/:id`               | —                                    | `{ success: true }`     | Bearer |
| `POST`  | `/api/listings/bulk`              | `BulkUpdateDto`                      | `{ updated, failed[] }` | Bearer |
| `GET`   | `/api/listings/:id/revisions`     | `?limit=20&offset=0`                | `{ revisions[] }`       | Bearer |
| `POST`  | `/api/listings/:id/restore`       | —                                    | `{ listing }`           | Bearer |

**Validation Strategy (class-validator):**

```typescript
// create-listing.dto.ts
export class CreateListingDto {
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsString() customLabelSku?: string;
  @IsOptional() @IsString() cBrand?: string;
  @IsOptional() @IsString() cManufacturerPartNumber?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() conditionId?: string;
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,2})?$/) startPrice?: string;
  @IsOptional() @IsString() quantity?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() itemPhotoUrl?: string;
  // ... all 76 eBay columns as optional
  @IsOptional() @IsEnum(['draft','ready']) status?: string;
}

// update-listing.dto.ts
export class UpdateListingDto extends PartialType(CreateListingDto) {
  @IsInt() @Min(1) version: number; // optimistic lock
}

// patch-status.dto.ts
export class PatchStatusDto {
  @IsEnum(['draft','ready','published','sold','delisted','archived'])
  status: string;
  @IsOptional() @IsString() reason?: string;
}

// bulk-update.dto.ts
export class BulkUpdateDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  ids: string[];
  @IsObject() changes: Partial<CreateListingDto>;
}
```

### Frontend Changes

**ListingEditor.tsx — Wire Save:**
```typescript
// Replace no-op "Save & Publish" with:
const handleSave = async (asDraft = true) => {
  const status = asDraft ? 'draft' : 'ready';
  const method = listingId ? 'PUT' : 'POST';
  const url = listingId ? `/api/listings/${listingId}` : '/api/listings';
  const body = { ...formState, status, version: currentVersion };
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    // Optimistic lock conflict — show merge UI
    showConflictModal(await res.json());
    return;
  }
  // Navigate to listing detail or back to catalog
};
```

**CatalogManager.tsx — Add Edit/Delete Actions:**
- Add "Edit" button on `ListingCard` → navigates to `/listings/:id/edit`
- Add "Delete" icon with confirmation modal
- Add bulk selection checkboxes + toolbar (status change, bulk delete)

**New Routes:**
- `/listings/new` → `ListingEditor` (create mode)
- `/listings/:id/edit` → `ListingEditor` (edit mode, fetches existing)
- `/listings/:id/history` → revision timeline view

### Background Jobs

None required for core CRUD. Revision writing is synchronous (same transaction).

### Security & Compliance

- **Optimistic Locking:** `@VersionColumn()` — TypeORM auto-increments; PUT requires `version` match, returns `409 Conflict` on mismatch
- **Soft Delete:** `@DeleteDateColumn()` — all queries auto-exclude with `withDeleted: false` (TypeORM default)
- **Input Validation:** `class-validator` + `class-transformer` global pipe
- **SQL Injection:** Parameterized queries via TypeORM QueryBuilder (already in use)
- **Rate Limiting:** POST/PUT/DELETE: 60 req/min per IP (throttle guard)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Optimistic lock conflicts on popular listings | Medium | Low | Show 3-way merge UI, auto-retry once |
| Bulk update touching 500 rows blocks DB | Low | Medium | Chunk into 50-row batches in transaction |
| Search vector out of sync after direct UPDATE | Medium | Medium | Existing DB trigger handles tsvector refresh |

---

## Module 2 — Real AI Ingestion Pipeline

**Priority:** 🔴 Critical  
**Estimated Complexity:** High  
**Estimated Duration:** 4 weeks  

### Backend Architecture

```
backend/src/ingestion/
├── ingestion.module.ts
├── ingestion.controller.ts          ← Upload + job endpoints
├── ingestion.service.ts             ← Orchestrator
├── ai/
│   ├── ai.module.ts
│   ├── ai.service.ts               ← Provider abstraction
│   ├── openai-vision.provider.ts   ← OpenAI GPT-4o Vision
│   ├── google-vision.provider.ts   ← Google Cloud Vision (fallback)
│   └── ai-normalizer.service.ts    ← Normalize AI responses → ListingRecord shape
├── storage/
│   ├── storage.module.ts
│   ├── storage.service.ts          ← S3 upload, signed URLs, thumbnails
│   └── image-processor.service.ts  ← Sharp resize/compress/thumbnail
├── review/
│   ├── review.controller.ts        ← Human review endpoints
│   └── review.service.ts
├── entities/
│   ├── ingestion-job.entity.ts
│   ├── ai-result.entity.ts
│   └── image-asset.entity.ts       ← (shared with Module 7)
├── dto/
│   ├── create-job.dto.ts
│   ├── review-decision.dto.ts
│   └── upload-url.dto.ts
├── processors/
│   └── ingestion.processor.ts      ← BullMQ worker
└── queues/
    └── ingestion.queue.ts          ← Queue definitions
```

### Database Schema

```sql
-- ═══ ingestion_jobs ═══

CREATE TABLE ingestion_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','uploading','processing','ai_complete',
                      'review_required','approved','rejected','failed','cancelled')),
  mode          VARCHAR(20) NOT NULL CHECK (mode IN ('single','bulk','bundle')),
  
  -- Source tracking
  source_type   VARCHAR(20) NOT NULL DEFAULT 'upload'
    CHECK (source_type IN ('upload','camera','url','api')),
  image_count   INTEGER NOT NULL DEFAULT 0,
  
  -- AI processing
  ai_provider   VARCHAR(30),                -- 'openai_vision' | 'google_vision'
  ai_model      VARCHAR(50),                -- 'gpt-4o' | 'gemini-1.5-pro'
  ai_started_at TIMESTAMPTZ,
  ai_completed_at TIMESTAMPTZ,
  ai_cost_usd   NUMERIC(8,4),              -- API cost tracking
  
  -- Review
  review_status  VARCHAR(20) DEFAULT 'pending'
    CHECK (review_status IN ('pending','auto_approved','needs_review','approved','rejected')),
  reviewed_by    UUID,
  reviewed_at    TIMESTAMPTZ,
  review_notes   TEXT,
  
  -- Result
  listing_id     UUID REFERENCES listing_records(id),  -- linked after approval
  
  -- Retry
  attempt_count  INTEGER NOT NULL DEFAULT 0,
  max_attempts   INTEGER NOT NULL DEFAULT 3,
  last_error     TEXT,
  next_retry_at  TIMESTAMPTZ,
  
  -- Metadata
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_status ON ingestion_jobs (status);
CREATE INDEX idx_job_review ON ingestion_jobs (review_status) WHERE review_status = 'needs_review';
CREATE INDEX idx_job_retry  ON ingestion_jobs (next_retry_at) WHERE status = 'failed' AND attempt_count < max_attempts;

-- ═══ ai_results ═══

CREATE TABLE ai_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  
  -- Raw AI response
  raw_response    JSONB NOT NULL,
  provider        VARCHAR(30) NOT NULL,
  model           VARCHAR(50) NOT NULL,
  tokens_used     INTEGER,
  latency_ms      INTEGER,
  
  -- Normalized fields (extracted by normalizer)
  extracted_title             TEXT,
  extracted_brand             TEXT,
  extracted_mpn               TEXT,
  extracted_oem_number        TEXT,
  extracted_part_type         TEXT,
  extracted_condition         TEXT,
  extracted_price_estimate    NUMERIC(10,2),
  extracted_description       TEXT,
  extracted_features          TEXT[],
  extracted_fitment_raw       JSONB,          -- raw "fits: 2015-2020 Toyota Camry" from AI
  
  -- Confidence scores (0.0 – 1.0)
  confidence_title            REAL,
  confidence_brand            REAL,
  confidence_mpn              REAL,
  confidence_part_type        REAL,
  confidence_overall          REAL NOT NULL,
  
  -- Matching
  matched_existing_id         UUID,            -- matched to existing listing
  match_confidence            REAL,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_result_job ON ai_results (job_id);
CREATE INDEX idx_ai_result_confidence ON ai_results (confidence_overall);

-- ═══ image_assets ═══ (shared with Module 7)

CREATE TABLE image_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES listing_records(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
  
  -- Storage
  s3_bucket       VARCHAR(100) NOT NULL,
  s3_key          VARCHAR(500) NOT NULL,     -- "images/{listing_id}/{uuid}.webp"
  s3_key_thumb    VARCHAR(500),              -- "images/{listing_id}/{uuid}_thumb.webp"
  cdn_url         TEXT,
  
  -- Metadata
  original_filename TEXT,
  mime_type       VARCHAR(50) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  width           INTEGER,
  height          INTEGER,
  blurhash        VARCHAR(50),               -- placeholder blur
  
  -- Ordering
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  
  -- Lifecycle
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_image_listing ON image_assets (listing_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_image_job     ON image_assets (job_id);
CREATE UNIQUE INDEX idx_image_s3 ON image_assets (s3_bucket, s3_key);
```

### API Endpoints

| Method  | Endpoint                                | Body                          | Response                          |
|---------|-----------------------------------------|-------------------------------|-----------------------------------|
| `POST`  | `/api/ingestion/upload-url`             | `{ filename, mimeType }`      | `{ uploadUrl, s3Key, assetId }`   |
| `POST`  | `/api/ingestion/jobs`                   | `{ mode, assetIds[], source }` | `{ job }`                        |
| `GET`   | `/api/ingestion/jobs`                   | `?status=&limit=&offset=`     | `{ jobs[], total }`              |
| `GET`   | `/api/ingestion/jobs/:id`               | —                             | `{ job, aiResult, images[] }`    |
| `POST`  | `/api/ingestion/jobs/:id/retry`         | —                             | `{ job }`                        |
| `POST`  | `/api/ingestion/jobs/:id/cancel`        | —                             | `{ job }`                        |
| `GET`   | `/api/ingestion/review`                 | `?limit=20`                   | `{ jobs[] }` needing review      |
| `POST`  | `/api/ingestion/review/:id/approve`     | `{ corrections?: {...} }`     | `{ job, listing }`               |
| `POST`  | `/api/ingestion/review/:id/reject`      | `{ reason }`                  | `{ job }`                        |
| `GET`   | `/api/ingestion/stats`                  | —                             | `{ pending, processing, ... }`   |

### Queue Design (BullMQ)

```typescript
// Queue: 'ingestion'
// Concurrency: 3 (to respect API rate limits)
// Rate limit: 10 jobs/minute for Vision APIs

interface IngestionJobData {
  jobId: string;
  assetIds: string[];
  mode: 'single' | 'bulk' | 'bundle';
  preferredProvider: 'openai' | 'google';
}

// Processor steps:
// 1. Fetch images from S3 (signed URL or buffer)
// 2. Call Vision API with structured prompt
// 3. Parse & normalize response → ai_results row
// 4. Run confidence scoring
// 5. If confidence_overall >= 0.85 → auto_approved → create listing draft
// 6. If confidence_overall < 0.85 → needs_review
// 7. On failure → increment attempt_count, schedule retry with exponential backoff

// Retry: 3 attempts, backoff: 30s, 120s, 600s
// Dead letter: after max_attempts, status = 'failed', alert notification
```

### AI Provider Abstraction

```typescript
// ai.service.ts
interface AiVisionProvider {
  name: string;
  analyzeImage(imageUrls: string[], prompt: string): Promise<AiRawResponse>;
  estimateCost(imageCount: number): number;
}

// Structured prompt template:
const MOTOR_PARTS_PROMPT = `
Analyze this motor part image and extract:
1. Part title (max 80 chars, eBay-optimized)
2. Brand name
3. Manufacturer Part Number (MPN)
4. OE/OEM Part Number
5. Part type/category
6. Condition (New/Used/Refurbished)
7. Estimated market value (USD)
8. Description (250 chars)
9. Key features (array)
10. Vehicle fitment (make, model, year range, engine if visible)
11. Dimensions if measurable
12. Any visible defects or wear

Return JSON only. Include confidence 0.0-1.0 for each field.
`;
```

### Frontend Changes

**IngestionManager.tsx refactor:**
- Replace `createIngestionService(runtimeConfig)` mock with real API calls
- Upload flow: `POST /ingestion/upload-url` → `PUT` to S3 signed URL → `POST /ingestion/jobs`
- Job queue reads from API, not localStorage
- Add review tab: list of `needs_review` jobs with approve/reject + inline editing
- Real-time progress: poll `/ingestion/jobs/:id` every 2s while processing, or use SSE

### Background Jobs

| Queue | Job Type | Concurrency | Rate Limit | Retry |
|-------|----------|-------------|------------|-------|
| `ingestion` | `process-image` | 3 | 10/min | 3x exponential |
| `ingestion` | `generate-thumbnail` | 5 | — | 2x |
| `ingestion` | `cleanup-orphan-images` | 1 | — | cron daily |

### External Integrations

| Service | Purpose | Cost Model |
|---------|---------|------------|
| OpenAI GPT-4o Vision | Primary image analysis | ~$0.01-0.04/image |
| Google Cloud Vision | Fallback provider | ~$1.50/1000 images |
| AWS S3 | Image storage | ~$0.023/GB/month |
| CloudFront | CDN delivery | ~$0.085/GB transfer |
| Sharp (local) | Image resize/compress | Free (npm) |

### Security & Compliance

- **Upload Security:** Signed S3 URLs expire in 5 minutes; accepted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- **File Size Limit:** 20MB per image, 100MB per batch (configurable)
- **Rate Limits:** 30 uploads/min per user, 100 AI jobs/hour per tenant
- **Image Scanning:** Validate magic bytes server-side (not just MIME header)
- **Data Retention:** Orphaned images cleaned after 7 days via cron job
- **Cost Control:** Daily AI spend cap per tenant (`max_daily_ai_spend` in settings)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI hallucinating MPN/brand | High | High | Confidence scoring + mandatory human review below 0.85 |
| S3 costs spike from large uploads | Medium | Medium | Aggressive WebP compression, max 2048px resize |
| Vision API downtime | Low | High | Dual-provider fallback (OpenAI → Google) |
| Prompt injection via image text | Low | Medium | Sanitize AI output, never execute returned content |

---

## Module 3 — Vehicle Fitment System (ACES-compatible)

**Priority:** 🔴 Critical  
**Estimated Complexity:** High  
**Estimated Duration:** 3 weeks  

### Backend Architecture

```
backend/src/fitment/
├── fitment.module.ts
├── fitment.controller.ts
├── fitment.service.ts
├── fitment-import.service.ts         ← ACES XML/CSV bulk import
├── fitment-matcher.service.ts        ← AI output → fitment records
├── entities/
│   ├── fitment-make.entity.ts
│   ├── fitment-model.entity.ts
│   ├── fitment-year.entity.ts
│   ├── fitment-engine.entity.ts
│   ├── fitment-submodel.entity.ts
│   └── part-fitment.entity.ts        ← join table: listing ↔ vehicle
├── dto/
│   ├── search-fitment.dto.ts
│   ├── create-fitment.dto.ts
│   ├── bulk-import-fitment.dto.ts
│   └── fitment-detection.dto.ts
└── processors/
    └── fitment-import.processor.ts   ← BullMQ worker for ACES imports
```

### Database Schema

```sql
-- ═══ ACES-compatible vehicle reference tables ═══

CREATE TABLE fitment_makes (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  aces_id     INTEGER UNIQUE,              -- ACES MakeID
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slug)
);

CREATE TABLE fitment_models (
  id          SERIAL PRIMARY KEY,
  make_id     INTEGER NOT NULL REFERENCES fitment_makes(id),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  aces_id     INTEGER UNIQUE,              -- ACES BaseVehicleID component
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(make_id, slug)
);

CREATE TABLE fitment_submodels (
  id          SERIAL PRIMARY KEY,
  model_id    INTEGER NOT NULL REFERENCES fitment_models(id),
  name        VARCHAR(100) NOT NULL,       -- "LE", "SE", "XLE", "TRD"
  aces_id     INTEGER UNIQUE,
  UNIQUE(model_id, name)
);

CREATE TABLE fitment_years (
  id          SERIAL PRIMARY KEY,
  year        SMALLINT NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  UNIQUE(year)
);

CREATE TABLE fitment_engines (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50) NOT NULL,         -- "2.5L I4", "3.5L V6"
  displacement_l  NUMERIC(4,1),
  cylinders   SMALLINT,
  fuel_type   VARCHAR(30),                  -- "Gas", "Diesel", "Hybrid", "EV"
  aspiration  VARCHAR(30),                  -- "NA", "Turbo", "Supercharged"
  aces_id     INTEGER UNIQUE,
  UNIQUE(code)
);

-- ═══ Part-to-Vehicle join table ═══

CREATE TABLE part_fitments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES listing_records(id) ON DELETE CASCADE,
  make_id     INTEGER NOT NULL REFERENCES fitment_makes(id),
  model_id    INTEGER NOT NULL REFERENCES fitment_models(id),
  submodel_id INTEGER REFERENCES fitment_submodels(id),
  year_start  SMALLINT NOT NULL,
  year_end    SMALLINT NOT NULL,
  engine_id   INTEGER REFERENCES fitment_engines(id),
  
  -- Source tracking
  source      VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','aces_import','ai_detected','bulk_import')),
  confidence  REAL,                         -- for AI-detected fitments
  verified    BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent exact duplicates
  UNIQUE(listing_id, make_id, model_id, year_start, year_end, engine_id)
);

CREATE INDEX idx_fitment_listing ON part_fitments (listing_id);
CREATE INDEX idx_fitment_vehicle ON part_fitments (make_id, model_id, year_start, year_end);
CREATE INDEX idx_fitment_unverified ON part_fitments (verified) WHERE verified = false;

-- ═══ Seed data (top 40 makes) ═══
-- INSERT INTO fitment_makes (name, slug) VALUES
--   ('Toyota', 'toyota'), ('Honda', 'honda'), ('Ford', 'ford'),
--   ('Chevrolet', 'chevrolet'), ('BMW', 'bmw'), ('Mercedes-Benz', 'mercedes-benz'),
--   ('Nissan', 'nissan'), ('Hyundai', 'hyundai'), ('Kia', 'kia'),
--   ('Volkswagen', 'volkswagen'), ('Audi', 'audi'), ('Subaru', 'subaru'), ...;

-- INSERT INTO fitment_years (year) SELECT generate_series(1960, 2027);
```

### API Endpoints

| Method  | Endpoint                                  | Body / Query                        | Response                        |
|---------|-------------------------------------------|-------------------------------------|---------------------------------|
| `GET`   | `/api/fitment/makes`                      | `?q=toy`                           | `{ makes[] }`                   |
| `GET`   | `/api/fitment/makes/:id/models`           | —                                   | `{ models[] }`                  |
| `GET`   | `/api/fitment/models/:id/submodels`       | —                                   | `{ submodels[] }`               |
| `GET`   | `/api/fitment/engines`                    | `?q=2.5L`                          | `{ engines[] }`                 |
| `GET`   | `/api/fitment/search`                     | `?make=&model=&yearStart=&yearEnd=` | `{ listings[] }`               |
| `GET`   | `/api/fitment/listing/:listingId`         | —                                   | `{ fitments[] }`                |
| `POST`  | `/api/fitment/listing/:listingId`         | `CreateFitmentDto`                  | `{ fitment }`                   |
| `DELETE` | `/api/fitment/:fitmentId`                | —                                   | `{ success }`                   |
| `POST`  | `/api/fitment/bulk-import`                | `multipart/form-data` (ACES XML/CSV)| `{ jobId }`                    |
| `POST`  | `/api/fitment/detect`                     | `{ listingId }` or `{ text }`      | `{ detectedFitments[] }`       |
| `PATCH` | `/api/fitment/:fitmentId/verify`          | `{ verified: true }`               | `{ fitment }`                   |

### Fitment Detection from AI

```typescript
// fitment-matcher.service.ts
// Takes raw AI output like "Fits 2015-2020 Toyota Camry LE 2.5L"
// and resolves to structured fitment records:

interface DetectedFitment {
  makeSlug: string;       // resolved from "Toyota" → "toyota"
  modelSlug: string;      // resolved from "Camry" → "camry"
  submodel?: string;      // "LE"
  yearStart: number;      // 2015
  yearEnd: number;        // 2020
  engineCode?: string;    // "2.5L I4"
  confidence: number;     // 0.92
}

// Resolution process:
// 1. NLP parse the raw fitment string
// 2. Fuzzy match make name → fitment_makes (pg_trgm)
// 3. Fuzzy match model name → fitment_models
// 4. Parse year range (handles "2015-2020", "2015+", "2015,2016,2017")
// 5. Optional: match engine spec
// 6. Return candidates with confidence scores
```

### Frontend Changes

**FitmentManager.tsx — Full Rewrite:**
- Replace 7 hardcoded Toyota rows with API-driven data
- **Make → Model → Year cascade dropdowns** (each loads from API on parent selection)
- Add fitment to listing: search by vehicle → link
- Bulk import tab: ACES XML/CSV file upload → progress bar
- Verification queue: list unverified AI-detected fitments → approve/reject
- Search by vehicle: "Find all parts for 2018 Toyota Camry" → results grid

**CatalogManager.tsx — Add Fitment Filter:**
- New filter dimension: "Vehicle" with make/model/year cascade
- Backend: extend `SearchQueryDto` with `fitmentMake`, `fitmentModel`, `fitmentYearStart`, `fitmentYearEnd`

### Background Jobs

| Queue | Job Type | Concurrency | Purpose |
|-------|----------|-------------|---------|
| `fitment` | `aces-import` | 1 | Parse ACES XML (can be 100k+ rows), batch insert |
| `fitment` | `ai-detect-batch` | 3 | Run fitment detection on newly AI-processed listings |

### Security & Compliance

- **ACES Import Validation:** Validate XML against ACES 4.2 XSD schema before processing
- **Year Range Sanity:** Reject fitments with year_start > year_end or range > 50 years
- **Duplicate Prevention:** DB unique constraint + application-level dedup before insert
- **Verification Audit:** All verify/reject actions logged with `verified_by` + `verified_at`

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ACES data licensing issues | Medium | High | Use AAIA open data or customer's own ACES files |
| AI fitment detection wrong year range | High | Medium | Always flag as unverified, require human verification |
| Massive ACES imports blocking DB | Low | High | Background job with batch inserts (1000/batch) |

---

## Module 4 — Marketplace Integrations (eBay + Shopify)

**Priority:** 🔴 Critical  
**Estimated Complexity:** High  
**Estimated Duration:** 5 weeks  

### Backend Architecture

```
backend/src/channels/
├── channels.module.ts
├── channels.controller.ts           ← OAuth + webhook endpoints
├── channels.service.ts              ← Orchestrator
├── channel-adapter.interface.ts     ← Contract
├── adapters/
│   ├── ebay/
│   │   ├── ebay.adapter.ts
│   │   ├── ebay-auth.service.ts     ← OAuth 2.0 PKCE flow
│   │   ├── ebay-api.service.ts      ← eBay REST API client
│   │   ├── ebay-mapper.service.ts   ← ListingRecord → eBay Inventory Item
│   │   └── ebay-webhook.handler.ts
│   └── shopify/
│       ├── shopify.adapter.ts
│       ├── shopify-auth.service.ts  ← OAuth 2.0 flow
│       ├── shopify-api.service.ts   ← Shopify Admin API (GraphQL)
│       ├── shopify-mapper.service.ts
│       └── shopify-webhook.handler.ts
├── entities/
│   ├── channel-connection.entity.ts
│   ├── channel-listing.entity.ts    ← Maps internal listing → marketplace listing
│   └── channel-webhook-log.entity.ts
├── dto/
│   ├── connect-channel.dto.ts
│   ├── publish-listing.dto.ts
│   └── webhook-payload.dto.ts
├── processors/
│   ├── publish.processor.ts         ← BullMQ: publish to marketplace
│   ├── sync.processor.ts            ← BullMQ: periodic inventory sync
│   └── order-import.processor.ts    ← BullMQ: fetch orders from marketplace
└── guards/
    └── webhook-signature.guard.ts   ← HMAC validation for incoming webhooks
```

### Database Schema

```sql
-- ═══ channel_connections ═══
-- Stores OAuth tokens per marketplace per tenant

CREATE TABLE channel_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         VARCHAR(30) NOT NULL CHECK (channel IN ('ebay','shopify','amazon','walmart')),
  
  -- OAuth tokens (encrypted at rest)
  access_token    TEXT NOT NULL,              -- AES-256 encrypted
  refresh_token   TEXT,                       -- AES-256 encrypted
  token_expires_at TIMESTAMPTZ,
  scope           TEXT,
  
  -- Marketplace account info
  marketplace_account_id   VARCHAR(100),     -- eBay seller ID, Shopify store domain
  marketplace_account_name VARCHAR(200),
  marketplace_site_id      VARCHAR(20),      -- eBay: EBAY_US, EBAY_UK, etc.
  
  -- Status
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','revoked','error')),
  last_sync_at    TIMESTAMPTZ,
  last_error      TEXT,
  
  -- Metadata
  settings        JSONB DEFAULT '{}',        -- channel-specific config
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_channel_conn ON channel_connections (channel, marketplace_account_id);

-- ═══ channel_listings ═══
-- Maps internal listing_records to marketplace listings

CREATE TABLE channel_listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       UUID NOT NULL REFERENCES listing_records(id) ON DELETE CASCADE,
  connection_id    UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  
  -- Marketplace identifiers
  external_id      VARCHAR(100),             -- eBay ItemID, Shopify ProductID
  external_url     TEXT,
  
  -- Sync state
  sync_status      VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending','publishing','active','ended','error','out_of_sync')),
  last_synced_at   TIMESTAMPTZ,
  last_sync_error  TEXT,
  
  -- Version tracking for change detection
  local_version    INTEGER NOT NULL DEFAULT 0,
  remote_version   INTEGER NOT NULL DEFAULT 0,
  
  -- Marketplace-specific data cache
  external_data    JSONB DEFAULT '{}',
  
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(listing_id, connection_id)
);

CREATE INDEX idx_channel_listing_ext ON channel_listings (connection_id, external_id);
CREATE INDEX idx_channel_listing_sync ON channel_listings (sync_status) WHERE sync_status != 'active';

-- ═══ channel_webhook_logs ═══

CREATE TABLE channel_webhook_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       VARCHAR(30) NOT NULL,
  event_type    VARCHAR(100) NOT NULL,       -- 'ITEM_SOLD', 'orders/create'
  payload       JSONB NOT NULL,
  signature     TEXT,
  processed     BOOLEAN NOT NULL DEFAULT false,
  process_error TEXT,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);

CREATE INDEX idx_webhook_unprocessed ON channel_webhook_logs (received_at) WHERE processed = false;
```

### ChannelAdapter Interface

```typescript
// channel-adapter.interface.ts

export interface ChannelAdapter {
  readonly channel: 'ebay' | 'shopify' | 'amazon' | 'walmart';
  
  // Connection lifecycle
  getAuthUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(connection: ChannelConnection): Promise<TokenSet>;
  
  // Listing operations
  createListing(connection: ChannelConnection, listing: ListingRecord, images: ImageAsset[]): Promise<ExternalListingResult>;
  updateListing(connection: ChannelConnection, channelListing: ChannelListing, listing: ListingRecord): Promise<ExternalListingResult>;
  endListing(connection: ChannelConnection, channelListing: ChannelListing): Promise<void>;
  
  // Inventory
  syncInventory(connection: ChannelConnection, items: InventorySyncItem[]): Promise<SyncResult>;
  getInventoryStatus(connection: ChannelConnection, externalIds: string[]): Promise<InventoryStatus[]>;
  
  // Orders
  fetchOrders(connection: ChannelConnection, since: Date): Promise<ExternalOrder[]>;
  acknowledgeOrder(connection: ChannelConnection, orderId: string): Promise<void>;
  
  // Health
  testConnection(connection: ChannelConnection): Promise<boolean>;
}
```

### API Endpoints

| Method  | Endpoint                                      | Purpose                               |
|---------|-----------------------------------------------|---------------------------------------|
| `GET`   | `/api/channels`                               | List connected channels               |
| `GET`   | `/api/channels/:channel/auth-url`             | Get OAuth redirect URL                |
| `GET`   | `/api/channels/:channel/callback`             | OAuth callback (exchanges code)       |
| `DELETE`| `/api/channels/:connectionId`                 | Disconnect channel                    |
| `POST`  | `/api/channels/:connectionId/test`            | Test connection health                |
| `POST`  | `/api/channels/publish`                       | `{ listingIds[], connectionId }`      |
| `POST`  | `/api/channels/sync`                          | Trigger manual inventory sync         |
| `GET`   | `/api/channels/:connectionId/listings`        | List all channel listings for conn    |
| `POST`  | `/api/channels/webhooks/ebay`                 | eBay notification webhook receiver    |
| `POST`  | `/api/channels/webhooks/shopify`              | Shopify webhook receiver              |

### eBay Integration Specifics

```typescript
// ebay-mapper.service.ts
// Maps ListingRecord (76 eBay columns) → eBay Inventory API format

// eBay APIs used:
// 1. Sell > Inventory API — createOrReplaceInventoryItem, createOffer, publishOffer
// 2. Sell > Account API — shipping policies, return policies
// 3. Buy > Browse API — for competitive analysis (future)
// 4. Sell > Fulfillment API — order management
// 5. Commerce > Notification API — webhook subscriptions

// Rate limits: 5000 calls/day (standard), need to handle 429s
// OAuth: Authorization Code Grant (user consent) + Client Credentials (app-level)
```

### Shopify Integration Specifics

```typescript
// shopify-api.service.ts
// Uses Shopify Admin API (GraphQL preferred for efficiency)

// Operations:
// 1. productCreate / productUpdate mutations
// 2. inventorySetQuantities mutation
// 3. orders query
// 4. webhooks: orders/create, orders/updated, inventory_levels/update

// Rate limits: 2 requests/second (REST) or 1000 cost points/second (GraphQL)
// Auth: Custom App or OAuth 2.0 with offline access tokens
```

### Frontend Changes

**New: ChannelManager.tsx**
- Channel connection cards (eBay with green/red status, Shopify with status)
- "Connect eBay" button → OAuth popup → callback → success card
- Per-listing publish button: select channels → confirm → publish
- Bulk publish from CatalogManager (select listings → "Publish to eBay")
- Sync status dashboard: last sync time, errors, out-of-sync count

**ListingEditor.tsx additions:**
- "Channels" tab showing where the listing is published
- Per-channel status badges
- "Publish" dropdown: eBay / Shopify / All

**Shell.tsx — Add "Channels" route**

### Background Jobs

| Queue | Job Type | Concurrency | Schedule | Purpose |
|-------|----------|-------------|----------|---------|
| `channels` | `publish-listing` | 2 | On-demand | Push listing to marketplace |
| `channels` | `sync-inventory` | 1 | Every 15min | Sync qty/price to all channels |
| `channels` | `fetch-orders` | 1 | Every 10min | Pull new orders from marketplaces |
| `channels` | `refresh-tokens` | 1 | Every 30min | Refresh expiring OAuth tokens |
| `channels` | `process-webhook` | 3 | On-demand | Process incoming webhook payloads |

### Security & Compliance

- **Token Encryption:** All OAuth tokens AES-256-GCM encrypted at rest using `CHANNEL_ENCRYPTION_KEY` env var
- **Webhook Validation:** eBay: verify X-EBAY-SIGNATURE header (digital signature); Shopify: HMAC-SHA256 of body with app secret
- **Token Rotation:** Cron job refreshes tokens 1 hour before expiry
- **Audit Log:** All publish/sync/order operations logged with timestamp, result, and any errors
- **Rate Limiting:** Respect marketplace rate limits with token bucket algorithm; queue delay on 429 response

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| eBay API deprecation/changes | Medium | High | Abstract behind adapter; version-pin API; monitor eBay developer blog |
| OAuth token expiry during bulk operation | Medium | Medium | Pre-check token before batch; auto-refresh inline |
| Webhook replay attacks | Low | Medium | Idempotency via webhook_logs table; deduplicate by event ID |
| Shopify GraphQL cost limits exceeded | Medium | Medium | Batch mutations, use bulk operations API for large syncs |

---

## Module 5 — Unified Inventory & Sync Engine

**Priority:** 🔴 Critical  
**Estimated Complexity:** High  
**Estimated Duration:** 3 weeks  

### Backend Architecture

```
backend/src/inventory/
├── inventory.module.ts
├── inventory.controller.ts
├── inventory.service.ts              ← Core ledger operations
├── inventory-sync.service.ts         ← Cross-channel synchronization
├── inventory-reconciler.service.ts   ← Conflict resolution
├── duplicate-detector.service.ts     ← SKU/title/image dedup
├── entities/
│   ├── inventory-event.entity.ts
│   └── inventory-ledger.entity.ts
├── dto/
│   ├── adjust-inventory.dto.ts
│   ├── reserve-inventory.dto.ts
│   └── reconcile.dto.ts
└── processors/
    ├── sync.processor.ts             ← BullMQ: cross-channel sync
    └── reconcile.processor.ts        ← BullMQ: periodic reconciliation
```

### Database Schema

```sql
-- ═══ inventory_ledger ═══
-- Single source of truth for inventory quantities

CREATE TABLE inventory_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       UUID NOT NULL REFERENCES listing_records(id) ON DELETE CASCADE,
  
  quantity_total   INTEGER NOT NULL DEFAULT 0 CHECK (quantity_total >= 0),
  quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_available INTEGER GENERATED ALWAYS AS (quantity_total - quantity_reserved) STORED,
  
  -- Computed from channel_listings
  quantity_listed_ebay    INTEGER NOT NULL DEFAULT 0,
  quantity_listed_shopify INTEGER NOT NULL DEFAULT 0,
  
  -- Safety
  low_stock_threshold     INTEGER DEFAULT 2,
  reorder_point           INTEGER DEFAULT 0,
  
  -- Optimistic lock
  version          INTEGER NOT NULL DEFAULT 1,
  
  last_reconciled_at TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(listing_id),
  CHECK (quantity_reserved <= quantity_total)
);

CREATE INDEX idx_ledger_low_stock ON inventory_ledger (quantity_available)
  WHERE quantity_available <= low_stock_threshold;

-- ═══ inventory_events ═══
-- Append-only event log (event sourcing pattern)

CREATE TABLE inventory_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID NOT NULL REFERENCES listing_records(id),
  
  event_type      VARCHAR(30) NOT NULL
    CHECK (event_type IN (
      'initial_stock',     -- from import/creation
      'manual_adjust',     -- user adjusts quantity
      'sale',              -- item sold on any channel
      'return',            -- item returned
      'reserve',           -- hold for pending order
      'release_reserve',   -- release held inventory
      'sync_correction',   -- automated reconciliation fix
      'bulk_import',       -- from spreadsheet import
      'damage_writeoff'    -- damaged goods removal
    )),
  
  quantity_change  INTEGER NOT NULL,          -- positive=add, negative=subtract
  quantity_before  INTEGER NOT NULL,
  quantity_after   INTEGER NOT NULL,
  
  -- Source tracking
  source_channel   VARCHAR(30),              -- 'ebay', 'shopify', 'manual', 'system'
  source_order_id  VARCHAR(100),             -- external order ID if from sale
  source_reference TEXT,                     -- any other reference
  
  -- Idempotency
  idempotency_key  VARCHAR(200) UNIQUE,      -- prevents duplicate events
  
  -- Metadata
  reason           TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_listing ON inventory_events (listing_id, created_at DESC);
CREATE INDEX idx_event_type    ON inventory_events (event_type, created_at DESC);
CREATE INDEX idx_event_source  ON inventory_events (source_channel, source_order_id);
```

### API Endpoints

| Method  | Endpoint                                   | Body                               | Response                       |
|---------|--------------------------------------------|------------------------------------|---------------------------------|
| `GET`   | `/api/inventory/:listingId`                | —                                  | `{ ledger, recentEvents[] }`   |
| `POST`  | `/api/inventory/:listingId/adjust`         | `{ change, reason, idempotencyKey }`| `{ ledger, event }`           |
| `POST`  | `/api/inventory/:listingId/reserve`        | `{ quantity, orderId }`            | `{ ledger, event }`            |
| `POST`  | `/api/inventory/:listingId/release`        | `{ quantity, orderId }`            | `{ ledger, event }`            |
| `GET`   | `/api/inventory/low-stock`                 | `?threshold=5&limit=50`           | `{ items[] }`                  |
| `POST`  | `/api/inventory/reconcile`                 | `{ listingIds[] }`                | `{ results[] }`                |
| `GET`   | `/api/inventory/events`                    | `?listingId=&type=&since=`        | `{ events[], total }`          |
| `GET`   | `/api/inventory/duplicates`                | `?confidence=0.8`                 | `{ duplicatePairs[] }`          |

### Concurrency-Safe Quantity Updates

```typescript
// inventory.service.ts

async adjustQuantity(
  listingId: string,
  change: number,
  reason: string,
  idempotencyKey: string,
  source: string,
): Promise<{ ledger: InventoryLedger; event: InventoryEvent }> {
  return this.dataSource.transaction('SERIALIZABLE', async (em) => {
    // 1. Check idempotency — if key exists, return existing result
    const existing = await em.findOne(InventoryEvent, {
      where: { idempotencyKey },
    });
    if (existing) return { ledger: await em.findOne(...), event: existing };
    
    // 2. Lock ledger row (SELECT ... FOR UPDATE)
    const ledger = await em
      .createQueryBuilder(InventoryLedger, 'l')
      .setLock('pessimistic_write')
      .where('l.listing_id = :listingId', { listingId })
      .getOneOrFail();
    
    // 3. Validate
    const newTotal = ledger.quantityTotal + change;
    if (newTotal < 0) throw new BadRequestException('Insufficient stock');
    if (newTotal < ledger.quantityReserved) throw new BadRequestException('Cannot reduce below reserved');
    
    // 4. Create event
    const event = em.create(InventoryEvent, {
      listingId,
      eventType: change > 0 ? 'manual_adjust' : 'manual_adjust',
      quantityChange: change,
      quantityBefore: ledger.quantityTotal,
      quantityAfter: newTotal,
      sourceChannel: source,
      idempotencyKey,
      reason,
    });
    
    // 5. Update ledger
    ledger.quantityTotal = newTotal;
    ledger.version += 1;
    
    await em.save(event);
    await em.save(ledger);
    
    return { ledger, event };
  });
}
```

### Duplicate Detection

```typescript
// duplicate-detector.service.ts

// Strategies (layered):
// 1. Exact SKU match (100% confidence)
// 2. Exact MPN match within same brand (95%)
// 3. Title similarity via pg_trgm (threshold 0.7) within same category (80%)
// 4. Image perceptual hash match (future — requires pHash computation)

// Query:
SELECT a.id AS id_a, b.id AS id_b,
       similarity(a.title, b.title) AS title_sim,
       CASE WHEN a.custom_label_sku = b.custom_label_sku THEN 1.0 ELSE 0 END AS sku_match,
       CASE WHEN a.c_manufacturer_part_number = b.c_manufacturer_part_number 
            AND a.c_brand = b.c_brand THEN 0.95 ELSE 0 END AS mpn_match
FROM listing_records a
JOIN listing_records b ON a.id < b.id
  AND a.deleted_at IS NULL AND b.deleted_at IS NULL
WHERE similarity(a.title, b.title) > 0.7
   OR (a.custom_label_sku = b.custom_label_sku AND a.custom_label_sku IS NOT NULL)
   OR (a.c_manufacturer_part_number = b.c_manufacturer_part_number 
       AND a.c_brand = b.c_brand 
       AND a.c_manufacturer_part_number IS NOT NULL)
ORDER BY GREATEST(similarity(a.title, b.title), sku_match, mpn_match) DESC
LIMIT 100;
```

### Frontend Changes

**New: InventoryPanel (in ListingEditor)**
- Current stock display (total / reserved / available)
- Adjustment form: +/- with reason field
- Event history timeline
- Low-stock warning badge

**Dashboard.tsx — Low Stock Widget:**
- Show top 10 low-stock items
- Click through to inventory adjustment

**CatalogManager.tsx — Stock Column:**
- Add quantity column to results grid
- Color-code: red (0), yellow (<threshold), green

### Background Jobs

| Queue | Job Type | Schedule | Purpose |
|-------|----------|----------|---------|
| `inventory` | `cross-channel-sync` | Every 15min | Push quantity changes to all connected channels |
| `inventory` | `reconcile` | Daily 2AM | Compare internal ledger vs. marketplace actual |
| `inventory` | `low-stock-alert` | Every hour | Check for items below threshold, trigger notification |
| `inventory` | `duplicate-scan` | Weekly Sun 3AM | Run full duplicate detection |

### Polling Fallback Strategy

```
Primary: Webhook-driven (instant)
    ↓ (if webhook fails)
Secondary: Polling every 15 minutes via BullMQ repeatable job
    ↓ (if polling API fails)
Tertiary: Manual reconciliation trigger from dashboard
    ↓ (if > 1 hour out of sync)
Alert: Notification to admin + channel marked "out_of_sync"
```

### Security & Compliance

- **SERIALIZABLE transaction isolation** for all quantity mutations (prevents double-sell)
- **Idempotency keys** on every event (prevents duplicate processing of webhooks/retries)
- **Audit trail** — `inventory_events` is append-only, never deleted
- **Quantity constraints** — DB-level CHECK constraints prevent negative stock

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Double-sell during high traffic | Medium | Critical | SERIALIZABLE isolation + pessimistic row lock |
| Inventory drift over time | High | Medium | Daily reconciliation job + manual reconcile button |
| Webhook missed/delayed | Medium | Medium | 15-min polling fallback + reconciliation |

---

## Module 6 — Real Dashboard (API-driven)

**Priority:** 🟠 High  
**Estimated Complexity:** Medium  
**Estimated Duration:** 2 weeks  

### Backend Architecture

```
backend/src/dashboard/
├── dashboard.module.ts
├── dashboard.controller.ts
├── dashboard.service.ts
├── aggregation.service.ts           ← Pre-compute dashboard metrics
├── entities/
│   ├── audit-log.entity.ts
│   └── dashboard-cache.entity.ts    ← Materialized metrics cache
└── processors/
    └── aggregation.processor.ts     ← BullMQ: periodic recomputation
```

### Database Schema

```sql
-- ═══ audit_logs ═══

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(50) NOT NULL,       -- 'listing', 'order', 'ingestion_job', 'channel'
  entity_id     UUID NOT NULL,
  action        VARCHAR(30) NOT NULL,       -- 'create', 'update', 'delete', 'publish', 'sell'
  actor_id      UUID,                       -- user who performed action
  actor_type    VARCHAR(20) DEFAULT 'user', -- 'user', 'system', 'webhook', 'cron'
  changes       JSONB,                      -- { field: { old, new } }
  metadata      JSONB DEFAULT '{}',         -- extra context
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity   ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_action   ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_actor    ON audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_created  ON audit_logs (created_at DESC);

-- ═══ dashboard_metrics_cache ═══
-- Pre-computed metrics refreshed by background job

CREATE TABLE dashboard_metrics_cache (
  metric_key    VARCHAR(100) PRIMARY KEY,
  metric_value  JSONB NOT NULL,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══ sales_records ═══ (denormalized for fast aggregation)

CREATE TABLE sales_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id),
  listing_id      UUID NOT NULL REFERENCES listing_records(id),
  channel         VARCHAR(30) NOT NULL,
  quantity_sold   INTEGER NOT NULL DEFAULT 1,
  sale_price      NUMERIC(10,2) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  marketplace_fee NUMERIC(10,2),
  net_revenue     NUMERIC(10,2),
  sold_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_date    ON sales_records (sold_at DESC);
CREATE INDEX idx_sales_channel ON sales_records (channel, sold_at DESC);
CREATE INDEX idx_sales_listing ON sales_records (listing_id);
```

### API Endpoints

| Method | Endpoint                         | Response                                              |
|--------|----------------------------------|-------------------------------------------------------|
| `GET`  | `/api/dashboard/summary`         | `{ totalListings, activeListings, totalSales, revenue, avgPrice, channelBreakdown }` |
| `GET`  | `/api/dashboard/sales`           | `{ salesByDay[], salesByChannel[], topItems[] }`      |
| `GET`  | `/api/dashboard/activity`        | `{ recentActivity[] }` (from audit_logs)              |
| `GET`  | `/api/dashboard/channel-health`  | `{ channels: [{ name, status, lastSync, errorCount, listingCount }] }` |
| `GET`  | `/api/dashboard/kpis`            | `{ catalogSize, publishedCount, soldCount, avgDaysToSell, returnRate }` |
| `GET`  | `/api/dashboard/inventory-alerts`| `{ lowStock[], outOfStock[], overstock[] }`           |
| `GET`  | `/api/audit-logs`                | `?entity=listing&action=create&since=&limit=50`      |

### Dashboard Queries

```typescript
// dashboard.service.ts

async getSummary(): Promise<DashboardSummary> {
  // Try cache first
  const cached = await this.getCache('dashboard:summary');
  if (cached) return cached;
  
  const [totalListings, activeListings, salesData, channelData] = await Promise.all([
    this.listingRepo.count({ where: { deletedAt: IsNull() } }),
    this.listingRepo.count({ where: { status: 'published', deletedAt: IsNull() } }),
    this.salesRepo
      .createQueryBuilder('s')
      .select('COUNT(*)', 'count')
      .addSelect('SUM(s.sale_price)', 'revenue')
      .addSelect('AVG(s.sale_price)', 'avgPrice')
      .where('s.sold_at >= :since', { since: subDays(new Date(), 30) })
      .getRawOne(),
    this.channelListingRepo
      .createQueryBuilder('cl')
      .select('cc.channel', 'channel')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('cl.connection', 'cc')
      .where('cl.sync_status = :s', { s: 'active' })
      .groupBy('cc.channel')
      .getRawMany(),
  ]);
  
  const result = {
    totalListings,
    activeListings,
    totalSales: Number(salesData.count),
    revenue: Number(salesData.revenue) || 0,
    avgPrice: Number(salesData.avgPrice) || 0,
    channelBreakdown: channelData,
    computedAt: new Date().toISOString(),
  };
  
  await this.setCache('dashboard:summary', result, 60_000); // 1 min
  return result;
}
```

### Frontend Changes

**Dashboard.tsx — Full Rewrite:**
```
Replace ALL hardcoded values:
- KPI cards: fetch from /api/dashboard/summary → totalListings, activeListings, revenue, sales
- Sales chart: fetch from /api/dashboard/sales → render with simple bar/line (CSS-only or add recharts)
- Activity feed: fetch from /api/dashboard/activity → real audit log entries
- Channel health: fetch from /api/dashboard/channel-health → real status cards
- Low stock alerts: fetch from /api/dashboard/inventory-alerts

Fix broken dynamic Tailwind classes:
- Replace `bg-${c.color}-500/10` with explicit class mapping:
  const colorMap = { blue: 'bg-blue-500/10', green: 'bg-green-500/10', ... };
```

### Background Jobs

| Queue | Job Type | Schedule | Purpose |
|-------|----------|----------|---------|
| `dashboard` | `recompute-summary` | Every 5min | Refresh dashboard_metrics_cache |
| `dashboard` | `daily-sales-rollup` | Daily 1AM | Pre-aggregate daily sales totals |

### Security & Compliance

- Dashboard endpoints are read-only — no mutation risk
- Audit logs are append-only (no UPDATE/DELETE permissions on table)
- Cache invalidation on relevant mutations (listing create/update, sale, order)
- Rate limit: 30 req/min on dashboard endpoints

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Slow aggregate queries on large datasets | Medium | Medium | Pre-computed cache + background aggregation |
| Dynamic Tailwind classes stripped by JIT | Certain | Low | Replace with explicit class mapping (safelist or object map) |

---

## Module 7 — Image Storage Architecture

**Priority:** 🟠 High  
**Estimated Complexity:** Medium  
**Estimated Duration:** 2 weeks  

### Backend Architecture

```
backend/src/storage/
├── storage.module.ts
├── storage.controller.ts            ← Upload URL generation, metadata
├── storage.service.ts               ← S3 operations
├── image-processor.service.ts       ← Sharp transformations
├── entities/
│   └── image-asset.entity.ts        ← Shared with Module 2
├── dto/
│   ├── request-upload.dto.ts
│   └── image-transform.dto.ts
└── processors/
    ├── thumbnail.processor.ts       ← BullMQ: generate thumbnails
    └── cleanup.processor.ts         ← BullMQ: orphan cleanup
```

### Database Schema

See `image_assets` table in Module 2 (shared schema).

### Storage Architecture

```
┌─────────────┐     Signed URL      ┌──────────────┐
│   Browser    │ ──────────────────> │   AWS S3     │
│  (direct     │                     │ Bucket:      │
│   upload)    │                     │ realtrack-img│
└──────┬───────┘                     └──────┬───────┘
       │                                    │
       │ POST /upload-url                   │ S3 Event
       │                                    │ Notification
       ▼                                    ▼
┌──────────────┐                    ┌──────────────┐
│   NestJS     │                    │  BullMQ      │
│   Backend    │ <───────────────── │  Thumbnail   │
│              │   confirm upload   │  Worker      │
└──────────────┘                    └──────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  CloudFront  │
                                    │  CDN         │
                                    │  d1234.cf.net│
                                    └──────────────┘
```

**S3 Bucket Structure:**
```
realtrack-images/
├── originals/
│   └── {listing_id}/{asset_id}.webp
├── thumbnails/
│   └── {listing_id}/{asset_id}_200x200.webp
├── medium/
│   └── {listing_id}/{asset_id}_800x800.webp
└── temp/
    └── {upload_session_id}/{filename}      ← TTL: 24h
```

### API Endpoints

| Method  | Endpoint                              | Purpose                              |
|---------|---------------------------------------|--------------------------------------|
| `POST`  | `/api/storage/upload-url`             | Generate signed S3 upload URL        |
| `POST`  | `/api/storage/confirm`                | Confirm upload, trigger thumbnail    |
| `GET`   | `/api/storage/listing/:listingId`     | Get all images for a listing         |
| `PATCH` | `/api/storage/:assetId`               | Update sort order, is_primary        |
| `DELETE` | `/api/storage/:assetId`              | Soft delete image                    |
| `POST`  | `/api/storage/bulk-upload-urls`       | Generate multiple signed URLs        |

### Image Transformation Pipeline

```typescript
// image-processor.service.ts (using Sharp)

const VARIANTS = [
  { suffix: '_thumb', width: 200, height: 200, fit: 'cover' },
  { suffix: '_medium', width: 800, height: 800, fit: 'inside' },
  // Original is stored as-is after WebP conversion + max 2048px resize
];

async processImage(s3Key: string): Promise<ImageVariants> {
  const buffer = await this.s3.getObject(s3Key);
  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  // Generate blurhash for placeholder
  const blurhash = await this.generateBlurhash(image);
  
  const variants: ImageVariants = {};
  for (const variant of VARIANTS) {
    const processed = await sharp(buffer)
      .resize(variant.width, variant.height, { fit: variant.fit })
      .webp({ quality: 80 })
      .toBuffer();
    
    const variantKey = s3Key.replace(/\.\w+$/, `${variant.suffix}.webp`);
    await this.s3.putObject(variantKey, processed, 'image/webp');
    variants[variant.suffix] = variantKey;
  }
  
  return { ...variants, blurhash, width: metadata.width, height: metadata.height };
}
```

### Frontend Changes

**ListingCard.tsx:**
- Replace `itemPhotoUrl` (eBay URL) with CDN URL from `image_assets`
- Show `blurhash` placeholder while loading
- Lazy load with `loading="lazy"` + IntersectionObserver

**ListingEditor.tsx — Gallery Rewrite:**
- Drag-and-drop image upload (direct to S3 via signed URL)
- Sortable gallery with drag handles
- Primary image toggle
- Thumbnail strip with delete/reorder

**IngestionManager.tsx:**
- Replace base64 `localStorage` storage with S3 upload flow

### Background Jobs

| Queue | Job Type | Schedule | Purpose |
|-------|----------|----------|---------|
| `storage` | `generate-thumbnails` | On-demand | Generate all size variants after upload |
| `storage` | `cleanup-orphans` | Daily 3AM | Delete temp/ files > 24h, unlinked assets > 7d |
| `storage` | `migrate-ebay-urls` | One-time | Download existing eBay `itemPhotoUrl` images to S3 |

### Security & Compliance

- **Signed URLs:** 5-minute expiry, scoped to specific S3 key
- **Content Validation:** Check magic bytes server-side after upload (reject non-image)
- **Size Limits:** 20MB per file, 100MB per batch, enforced in signed URL policy
- **Public Read:** CloudFront serves public read; S3 bucket is NOT publicly accessible
- **CORS:** S3 CORS only allows PUT from `mhn.realtrackapp.com`
- **Lifecycle Rules:** S3 lifecycle deletes `temp/` prefix after 1 day

### Deployment Requirements

```bash
# AWS resources needed:
# 1. S3 bucket: realtrack-images (us-east-1)
# 2. CloudFront distribution: d1234.cloudfront.net → S3 origin
# 3. IAM role: realtrack-s3-role (s3:PutObject, s3:GetObject, s3:DeleteObject)
# 4. S3 Event Notification → SQS → consumed by thumbnail worker

# Environment variables:
AWS_S3_BUCKET=realtrack-images
AWS_S3_REGION=us-east-1
AWS_CLOUDFRONT_DOMAIN=d1234.cloudfront.net
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| S3 costs from orphaned images | Medium | Low | Daily cleanup job + lifecycle rules |
| Large original images slow to load | Medium | Medium | Always serve WebP via CDN, lazy load |
| Migration of existing eBay URLs | Medium | Low | Background job, keep old URLs as fallback |

---

## Module 8 — Orders Module

**Priority:** 🟡 Medium  
**Estimated Complexity:** High  
**Estimated Duration:** 3 weeks  

### Backend Architecture

```
backend/src/orders/
├── orders.module.ts
├── orders.controller.ts
├── orders.service.ts
├── order-state-machine.ts           ← FSM for order lifecycle
├── entities/
│   ├── order.entity.ts
│   └── order-item.entity.ts
├── dto/
│   ├── orders-query.dto.ts
│   ├── update-order.dto.ts
│   └── refund.dto.ts
└── processors/
    └── order-import.processor.ts    ← BullMQ: ingest from marketplace webhooks
```

### Database Schema

```sql
-- ═══ orders ═══

CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source
  channel           VARCHAR(30) NOT NULL,     -- 'ebay', 'shopify', 'manual'
  connection_id     UUID REFERENCES channel_connections(id),
  external_order_id VARCHAR(100),             -- marketplace order ID
  external_url      TEXT,
  
  -- State machine
  status            VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',         -- just received
      'confirmed',       -- payment confirmed
      'processing',      -- being picked/packed
      'shipped',         -- tracking uploaded
      'delivered',       -- delivery confirmed
      'completed',       -- finalized
      'cancelled',       -- cancelled before ship
      'refund_requested',
      'refunded',        -- money returned
      'disputed'         -- marketplace dispute
    )),
  
  -- Buyer info
  buyer_username    VARCHAR(200),
  buyer_email       VARCHAR(200),
  buyer_name        VARCHAR(200),
  
  -- Shipping
  shipping_name     VARCHAR(200),
  shipping_address_1 TEXT,
  shipping_address_2 TEXT,
  shipping_city     VARCHAR(100),
  shipping_state    VARCHAR(100),
  shipping_zip      VARCHAR(20),
  shipping_country  CHAR(2),
  shipping_method   VARCHAR(100),
  tracking_number   VARCHAR(100),
  tracking_carrier  VARCHAR(50),
  shipped_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  
  -- Financials
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_cost     NUMERIC(10,2) DEFAULT 0,
  tax_amount        NUMERIC(10,2) DEFAULT 0,
  total_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency          CHAR(3) NOT NULL DEFAULT 'USD',
  marketplace_fee   NUMERIC(10,2) DEFAULT 0,
  net_revenue       NUMERIC(10,2),
  
  -- Refund
  refund_amount     NUMERIC(10,2) DEFAULT 0,
  refund_reason     TEXT,
  refunded_at       TIMESTAMPTZ,
  
  -- Timestamps
  ordered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at           TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Idempotency
  UNIQUE(channel, external_order_id)
);

CREATE INDEX idx_order_status   ON orders (status);
CREATE INDEX idx_order_channel  ON orders (channel, ordered_at DESC);
CREATE INDEX idx_order_date     ON orders (ordered_at DESC);
CREATE INDEX idx_order_buyer    ON orders (buyer_email);

-- ═══ order_items ═══

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id      UUID REFERENCES listing_records(id),
  
  -- From marketplace
  external_item_id VARCHAR(100),
  sku             VARCHAR(100),
  title           TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(10,2) NOT NULL,
  total_price     NUMERIC(10,2) NOT NULL,
  
  -- Fulfillment
  fulfilled       BOOLEAN NOT NULL DEFAULT false,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_item_order   ON order_items (order_id);
CREATE INDEX idx_order_item_listing ON order_items (listing_id);
```

### Order State Machine

```
                    ┌──────────────┐
                    │   pending    │
                    └──────┬───────┘
                           │ payment_confirm
                    ┌──────▼───────┐       cancel
                    │  confirmed   │──────────────┐
                    └──────┬───────┘              │
                           │ start_processing     │
                    ┌──────▼───────┐              │
                    │  processing  │──────────────┤
                    └──────┬───────┘              │
                           │ ship                 │
                    ┌──────▼───────┐              │
                    │   shipped    │              │
                    └──────┬───────┘              │
                           │ deliver              ▼
                    ┌──────▼───────┐     ┌──────────────┐
                    │  delivered   │     │  cancelled   │
                    └──────┬───────┘     └──────────────┘
                           │ complete
                    ┌──────▼───────┐
              ┌─────│  completed   │
              │     └──────────────┘
              │ request_refund
      ┌───────▼────────┐
      │refund_requested │
      └───────┬─────────┘
              │ process_refund
      ┌───────▼───────┐
      │   refunded    │
      └───────────────┘
```

```typescript
// order-state-machine.ts
const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending:          ['confirmed', 'cancelled'],
  confirmed:        ['processing', 'cancelled'],
  processing:       ['shipped', 'cancelled'],
  shipped:          ['delivered', 'disputed'],
  delivered:        ['completed', 'refund_requested', 'disputed'],
  completed:        ['refund_requested'],
  refund_requested: ['refunded', 'completed'],  // refund denied → back to completed
  cancelled:        [],                          // terminal
  refunded:         [],                          // terminal
  disputed:         ['refunded', 'completed'],
};

function canTransition(from: string, to: string): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### API Endpoints

| Method  | Endpoint                          | Purpose                              |
|---------|-----------------------------------|--------------------------------------|
| `GET`   | `/api/orders`                     | List orders (paginated, filtered)    |
| `GET`   | `/api/orders/:id`                 | Order detail with items              |
| `PATCH` | `/api/orders/:id/status`          | Transition order status              |
| `PATCH` | `/api/orders/:id/shipping`        | Add tracking number                  |
| `POST`  | `/api/orders/:id/refund`          | Process refund                       |
| `GET`   | `/api/orders/stats`               | Order count by status                |

### Frontend Changes

**New: OrdersPage.tsx**
- Order list table with status badges (color-coded by state)
- Filters: status, channel, date range, search by buyer/order ID
- Order detail modal: items, buyer info, shipping, timeline
- Actions: Mark Shipped (enter tracking), Refund, Cancel
- Print packing slip

**Shell.tsx:**
- Wire `/orders` route to `OrdersPage`

### Background Jobs

| Queue | Job Type | Schedule | Purpose |
|-------|----------|----------|---------|
| `orders` | `import-from-channel` | Every 10min | Fetch new orders from eBay/Shopify |
| `orders` | `update-tracking` | Daily | Sync tracking status from carriers |
| `orders` | `auto-complete` | Daily | Auto-complete orders delivered > 14 days ago |

### Security & Compliance

- **PII Handling:** Buyer email/name/address encrypted at rest (column-level encryption)
- **Audit Trail:** All status transitions logged in `audit_logs`
- **Idempotent Import:** `UNIQUE(channel, external_order_id)` prevents duplicate import
- **Financial Accuracy:** Use `NUMERIC(10,2)` — never floating point for money

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Duplicate order import from webhook + poll | Medium | High | Idempotency constraint + check before insert |
| Refund amount mismatch with marketplace | Medium | Medium | Store marketplace refund separately, reconcile |
| Stale order status | Medium | Low | Periodic sync job + manual refresh button |

---

## Module 9 — Settings Module

**Priority:** 🟡 Medium  
**Estimated Complexity:** Medium  
**Estimated Duration:** 2 weeks  

### Backend Architecture

```
backend/src/settings/
├── settings.module.ts
├── settings.controller.ts
├── settings.service.ts
├── entities/
│   ├── tenant-settings.entity.ts
│   ├── shipping-profile.entity.ts
│   ├── pricing-rule.entity.ts
│   └── user.entity.ts               ← (if multi-tenant/multi-user)
├── dto/
│   ├── update-settings.dto.ts
│   ├── shipping-profile.dto.ts
│   └── pricing-rule.dto.ts
└── guards/
    └── roles.guard.ts
```

### Database Schema

```sql
-- ═══ tenant_settings ═══
-- Key-value store with typed JSON values

CREATE TABLE tenant_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    VARCHAR(50) NOT NULL,          -- 'general', 'marketplace', 'tax', 'shipping', 'notification'
  key         VARCHAR(100) NOT NULL,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID,
  UNIQUE(category, key)
);

-- Seed settings:
INSERT INTO tenant_settings (category, key, value, description) VALUES
  ('general', 'business_name', '"MHN Auto Parts"', 'Business display name'),
  ('general', 'business_email', '"info@mhnautoparts.com"', 'Primary contact email'),
  ('general', 'default_currency', '"USD"', 'Default currency code'),
  ('general', 'default_location', '"Houston, TX"', 'Default listing location'),
  ('general', 'timezone', '"America/Chicago"', 'Business timezone'),
  ('marketplace', 'ebay_auto_publish', 'false', 'Auto-publish to eBay when status=ready'),
  ('marketplace', 'shopify_auto_sync', 'false', 'Auto-sync inventory to Shopify'),
  ('marketplace', 'default_return_policy', '"30_days"', 'Default return policy'),
  ('tax', 'tax_rate', '0.0825', 'Default tax rate (8.25% TX)'),
  ('tax', 'tax_enabled', 'true', 'Collect tax on orders'),
  ('notification', 'low_stock_alert', 'true', 'Alert on low stock'),
  ('notification', 'order_alert', 'true', 'Alert on new orders'),
  ('ai', 'ai_provider', '"openai"', 'Default AI provider'),
  ('ai', 'ai_auto_approve_threshold', '0.85', 'Auto-approve confidence threshold'),
  ('ai', 'max_daily_ai_spend', '50.00', 'Max daily AI API spend (USD)');

-- ═══ shipping_profiles ═══

CREATE TABLE shipping_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  carrier         VARCHAR(50) NOT NULL,       -- 'USPS', 'UPS', 'FedEx', 'DHL'
  service         VARCHAR(100) NOT NULL,      -- 'Priority Mail', 'Ground', etc.
  handling_time   INTEGER NOT NULL DEFAULT 1, -- business days
  cost_type       VARCHAR(20) NOT NULL CHECK (cost_type IN ('flat','calculated','free')),
  flat_cost       NUMERIC(8,2),
  weight_based    BOOLEAN DEFAULT false,
  domestic_only   BOOLEAN DEFAULT true,
  is_default      BOOLEAN DEFAULT false,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══ pricing_rules ═══
-- Automated pricing adjustments

CREATE TABLE pricing_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  rule_type       VARCHAR(30) NOT NULL
    CHECK (rule_type IN ('markup','markdown','round','min_margin','competitive')),
  channel         VARCHAR(30),               -- NULL = all channels
  category_id     VARCHAR(20),               -- NULL = all categories
  brand           VARCHAR(100),              -- NULL = all brands
  
  -- Rule parameters
  parameters      JSONB NOT NULL,
  -- Examples:
  -- markup: { "percentage": 15, "base": "cost" }
  -- markdown: { "percentage": 10, "condition": "days_listed > 30" }
  -- round: { "strategy": "up_to_99", "example": "24.50 → 24.99" }
  -- min_margin: { "percentage": 20, "floor_price": 4.99 }
  
  priority        INTEGER NOT NULL DEFAULT 0, -- higher = applied later
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══ users ═══ (basic, for future multi-user)

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(200) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            VARCHAR(200),
  role            VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin','manager','user','viewer')),
  active          BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### API Endpoints

| Method  | Endpoint                            | Purpose                             |
|---------|-------------------------------------|-------------------------------------|
| `GET`   | `/api/settings`                     | Get all settings by category        |
| `GET`   | `/api/settings/:category`           | Get settings for a category         |
| `PUT`   | `/api/settings/:category/:key`      | Update a setting                    |
| `GET`   | `/api/settings/shipping-profiles`   | List shipping profiles              |
| `POST`  | `/api/settings/shipping-profiles`   | Create shipping profile             |
| `PUT`   | `/api/settings/shipping-profiles/:id`| Update shipping profile            |
| `DELETE` | `/api/settings/shipping-profiles/:id`| Delete shipping profile            |
| `GET`   | `/api/settings/pricing-rules`       | List pricing rules                  |
| `POST`  | `/api/settings/pricing-rules`       | Create pricing rule                 |
| `PUT`   | `/api/settings/pricing-rules/:id`   | Update pricing rule                 |

### Frontend Changes

**New: SettingsPage.tsx**
- Tabbed layout: General | Marketplace | Tax | Shipping | Pricing | Notifications | Users
- **General tab:** Business name, email, timezone, currency, location
- **Marketplace tab:** per-channel auto-publish toggles, default policies
- **Tax tab:** tax rate, tax collection toggle
- **Shipping tab:** manage shipping profiles (table + create/edit modal)
- **Pricing tab:** rule builder UI (type selector → parameter form → preview)
- **Notifications tab:** toggle alerts per event type
- **Users tab:** user list, invite, role assignment (future)

**Shell.tsx:** Wire `/settings` route

### Security & Compliance

- **Role-based Access:** Settings modification requires `admin` or `manager` role
- **Encryption:** Channel credentials (OAuth tokens) stored encrypted (handled in Module 4)
- **Validation:** All settings validated against schema before save
- **Audit:** All setting changes logged in `audit_logs`

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Settings cache stale after update | Medium | Low | Invalidate in-memory cache on every PUT |
| Pricing rules conflicting | Medium | Medium | Priority ordering + "preview" mode before activation |

---

## Module 10 — Notification System

**Priority:** 🟡 Medium  
**Estimated Complexity:** Low–Medium  
**Estimated Duration:** 1.5 weeks  

### Backend Architecture

```
backend/src/notifications/
├── notifications.module.ts
├── notifications.controller.ts
├── notifications.service.ts
├── notification-gateway.ts           ← WebSocket gateway (Socket.IO or ws)
├── entities/
│   └── notification.entity.ts
├── dto/
│   └── notifications-query.dto.ts
└── triggers/
    └── notification-triggers.ts     ← Event listeners that create notifications
```

### Database Schema

```sql
-- ═══ notifications ═══

CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who
  recipient_id  UUID,                        -- user ID (NULL = broadcast)
  
  -- What
  type          VARCHAR(50) NOT NULL,
  -- Types: 'new_order', 'order_shipped', 'low_stock', 'out_of_stock',
  --        'ingestion_complete', 'ingestion_failed', 'ai_review_needed',
  --        'channel_error', 'channel_connected', 'channel_disconnected',
  --        'listing_published', 'listing_sold', 'sync_conflict',
  --        'system_alert'
  
  title         VARCHAR(200) NOT NULL,
  body          TEXT,
  icon          VARCHAR(30),                 -- lucide icon name
  severity      VARCHAR(10) NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','success','warning','error')),
  
  -- Linking
  entity_type   VARCHAR(50),                 -- 'listing', 'order', 'ingestion_job'
  entity_id     UUID,
  action_url    TEXT,                        -- frontend route to navigate to
  
  -- State
  read          BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  dismissed     BOOLEAN NOT NULL DEFAULT false,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient ON notifications (recipient_id, read, created_at DESC);
CREATE INDEX idx_notif_unread    ON notifications (recipient_id) WHERE read = false;
CREATE INDEX idx_notif_type      ON notifications (type, created_at DESC);
```

### API Endpoints

| Method  | Endpoint                           | Purpose                              |
|---------|------------------------------------|--------------------------------------|
| `GET`   | `/api/notifications`               | List notifications (paginated)       |
| `GET`   | `/api/notifications/unread-count`  | Get unread badge count               |
| `PATCH` | `/api/notifications/:id/read`      | Mark as read                         |
| `POST`  | `/api/notifications/mark-all-read` | Mark all as read                     |
| `DELETE` | `/api/notifications/:id`          | Dismiss notification                 |

### WebSocket Gateway

```typescript
// notification-gateway.ts

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3191', 'https://mhn.realtrackapp.com'],
  },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  // Called by notification.service.ts after creating a notification
  emitToUser(userId: string, notification: Notification) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  emitBroadcast(notification: Notification) {
    this.server.emit('notification', notification);
  }
  
  handleConnection(client: Socket) {
    // Authenticate via token query param
    const userId = this.validateToken(client.handshake.auth.token);
    if (userId) client.join(`user:${userId}`);
  }
}
```

### Event-Driven Triggers

```typescript
// notification-triggers.ts
// Uses NestJS event emitter or direct service calls

// Trigger points (wired into respective modules):

// Module 2 - Ingestion:
//   - Job completed → 'ingestion_complete' notification
//   - Job failed → 'ingestion_failed' notification (error severity)
//   - Review needed → 'ai_review_needed' notification (warning)

// Module 4 - Channels:
//   - Channel connected → 'channel_connected' (success)
//   - Channel error → 'channel_error' (error)
//   - Listing published → 'listing_published' (success)

// Module 5 - Inventory:
//   - Low stock → 'low_stock' (warning)
//   - Out of stock → 'out_of_stock' (error)
//   - Sync conflict → 'sync_conflict' (warning)

// Module 8 - Orders:
//   - New order → 'new_order' (info)
//   - Order shipped → 'order_shipped' (success)
//   - Refund requested → 'refund_requested' (warning)
```

### Frontend Changes

**Shell.tsx — Bell Dropdown:**
```typescript
// Replace cosmetic bell icon with real notification dropdown:
// 1. Fetch unread count on mount: GET /api/notifications/unread-count
// 2. Display red badge with count
// 3. On click: dropdown with recent notifications
// 4. Each notification: icon + title + relative time + severity color
// 5. Click notification → navigate to action_url + mark as read
// 6. "Mark all as read" footer link
// 7. WebSocket connection for real-time updates (increment badge without polling)
```

**New: NotificationsPage.tsx (optional)**
- Full notification history with filters
- `/notifications` route

### Security & Compliance

- **WebSocket Auth:** Token-based authentication on connection
- **Rate Limit:** Max 10 notifications/minute per trigger type (prevent storm)
- **Retention:** Auto-delete notifications older than 90 days (cron job)
- **No PII in notifications:** Reference entity IDs, not buyer names/emails

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Notification flood from bulk operations | Medium | Low | Aggregate: "50 listings published" instead of 50 individual |
| WebSocket connection drops | Medium | Low | Auto-reconnect with exponential backoff; poll fallback |

---

## Execution Roadmap

### Dependency Graph

```
Module 7 (Image Storage)
    ↓
Module 1 (Listing CRUD) ←──── Module 2 (AI Ingestion)
    ↓                              ↓
Module 3 (Fitment)         Module 10 (Notifications) ←── all modules
    ↓                              
Module 5 (Inventory)       Module 9 (Settings)
    ↓                              ↓
Module 4 (Marketplace)     Module 6 (Dashboard)
    ↓                              ↓
Module 8 (Orders) ─────────→ Module 6 (Dashboard feeds from all)
```

### Phased Execution Plan

#### Phase 0 — Foundation (1 week)
**Prerequisite infrastructure for all modules**

| Task | Duration | Details |
|------|----------|---------|
| Install Redis | 1 day | AWS ElastiCache or local Redis; add `@nestjs/bullmq`, `bullmq`, `ioredis` to backend |
| Install class-validator | 0.5 day | `class-validator`, `class-transformer`, global validation pipe |
| Add `@nestjs/event-emitter` | 0.5 day | For cross-module event communication |
| Set up AWS S3 bucket + CloudFront | 1 day | Bucket, IAM role, distribution |
| Add Sharp for image processing | 0.5 day | `npm i sharp @types/sharp` |
| Add `@nestjs/websockets` + `socket.io` | 0.5 day | For Module 10 |
| Database migrations setup | 1 day | Switch from `synchronize: true` to TypeORM migrations |
| Add `@nestjs/swagger` | 0.5 day | Auto-generated API docs |

**New backend `package.json` dependencies:**
```json
{
  "@nestjs/bullmq": "^11.0.0",
  "@nestjs/event-emitter": "^3.0.0",
  "@nestjs/swagger": "^8.0.0",
  "@nestjs/websockets": "^11.0.0",
  "@nestjs/platform-socket.io": "^11.0.0",
  "@aws-sdk/client-s3": "^3.500.0",
  "@aws-sdk/s3-request-presigner": "^3.500.0",
  "bullmq": "^5.0.0",
  "ioredis": "^5.3.0",
  "sharp": "^0.33.0",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.1",
  "socket.io": "^4.7.0",
  "uuid": "^9.0.0"
}
```

#### Phase 1 — Core Data (Weeks 2–4)
**Enable basic CRUD and storage**

| Week | Module | Deliverable |
|------|--------|-------------|
| 2 | **Module 7** — Image Storage | S3 upload, thumbnails, CDN serving, `image_assets` table |
| 2-3 | **Module 1** — Listing CRUD | POST/PUT/PATCH/DELETE, revisions, soft delete, validation |
| 3 | **Module 10** — Notifications (basic) | DB table, REST endpoints, bell dropdown wired |
| 4 | **Module 9** — Settings (basic) | Settings CRUD, shipping profiles, basic pricing rules |

#### Phase 2 — Intelligence (Weeks 5–8)
**AI and vehicle data**

| Week | Module | Deliverable |
|------|--------|-------------|
| 5-7 | **Module 2** — AI Ingestion | BullMQ queue, OpenAI Vision integration, S3 upload flow, review workflow |
| 7-8 | **Module 3** — Fitment System | ACES schema, reference data, part_fitments, AI detection |

#### Phase 3 — Commerce (Weeks 9–14)
**Marketplace + inventory + orders**

| Week | Module | Deliverable |
|------|--------|-------------|
| 9-11 | **Module 4** — Marketplace (eBay first) | eBay OAuth, adapter, publish, webhooks |
| 12 | **Module 5** — Inventory Sync | Event-sourced ledger, cross-channel sync, reconciliation |
| 12-13 | **Module 4.b** — Marketplace (Shopify) | Shopify adapter, parallel to inventory |
| 13-14 | **Module 8** — Orders | Order import, state machine, UI |

#### Phase 4 — Insights (Weeks 15–16)
**Dashboard and polish**

| Week | Module | Deliverable |
|------|--------|-------------|
| 15 | **Module 6** — Dashboard | API-driven KPIs, sales charts, activity feed, channel health |
| 16 | **Module 10.b** — Notifications (WebSocket) | Real-time push, event triggers from all modules |
| 16 | Polish | Performance testing, error handling, documentation |

### Timeline Summary

| Phase | Duration | Modules | Cumulative |
|-------|----------|---------|------------|
| Phase 0 — Foundation | 1 week | Infrastructure | Week 1 |
| Phase 1 — Core Data | 3 weeks | 7, 1, 10, 9 | Weeks 2–4 |
| Phase 2 — Intelligence | 4 weeks | 2, 3 | Weeks 5–8 |
| Phase 3 — Commerce | 6 weeks | 4, 5, 8 | Weeks 9–14 |
| Phase 4 — Insights | 2 weeks | 6, 10b | Weeks 15–16 |
| **Total** | **16 weeks** | **10 modules** | |

---

## Risk Register

| # | Risk | Probability | Impact | Phase | Mitigation | Owner |
|---|------|-------------|--------|-------|------------|-------|
| R1 | eBay API approval takes weeks | High | Critical | 3 | Apply for eBay developer account immediately (Phase 0) | Lead Dev |
| R2 | AI costs exceed budget | Medium | High | 2 | Daily spend cap in settings, dual-provider for cost optimization | Backend Lead |
| R3 | Database migrations break production | Medium | Critical | 0 | Switch to explicit migrations, test on staging DB clone | DBA |
| R4 | S3 region latency for image uploads | Low | Medium | 1 | Use CloudFront for reads, multi-part upload for large files | DevOps |
| R5 | Inventory double-sell during marketplace sync | Medium | Critical | 3 | SERIALIZABLE transactions, pessimistic locks, idempotency keys | Backend Lead |
| R6 | ACES data licensing restrictions | Medium | High | 2 | Use customer's own ACES files or open AAIA data | Product |
| R7 | WebSocket scaling with multiple PM2 instances | Low | Medium | 4 | Redis adapter for Socket.IO (sticky sessions or pub/sub) | DevOps |
| R8 | Shopify rate limiting during bulk sync | Medium | Medium | 3 | GraphQL bulk operations API, exponential backoff | Backend Lead |
| R9 | `synchronize: true` in production | Certain | High | 0 | Disable immediately, switch to migration-based schema mgmt | DBA |
| R10 | PII data in orders without encryption | High | Critical | 3 | Column-level encryption + access audit logging | Security |

---

## Technical Debt Cleanup

| # | Item | Current State | Target State | Priority | Phase |
|---|------|---------------|-------------|----------|-------|
| D1 | `DB_SYNC=true` in production | Auto-syncs schema on boot | Migration-only schema changes | Critical | 0 |
| D2 | All prices stored as `TEXT` | `startPrice: string` | `NUMERIC(10,2)` type + migration | High | 1 |
| D3 | No input validation | No `class-validator` on DTOs | Global validation pipe + decorated DTOs | High | 0 |
| D4 | No authentication / authorization | Zero auth on all endpoints | JWT + role-based guards | Critical | 0-1 |
| D5 | Hardcoded CORS origins | Two origins in `main.ts` | Environment variable driven | Medium | 0 |
| D6 | No health check endpoint | None | `/api/health` with DB/Redis/S3 checks | Medium | 0 |
| D7 | Frontend `fetch()` error handling | Basic `res.ok` check | Centralized API client with retry, 401 redirect, toast errors | Medium | 1 |
| D8 | No test coverage | 0 backend tests, 0 frontend tests | Minimum 60% coverage on services | Medium | Ongoing |
| D9 | Broken dynamic Tailwind classes | `bg-${c.color}-500/10` | Explicit color class mapping | Low | 1 |
| D10 | `quantity` stored as TEXT | String type | INTEGER with proper stock tracking via inventory_ledger | High | 1 |
| D11 | Single PM2 instance (fork mode) | `instances: 1` | Cluster mode with 2+ workers + Redis session store | Medium | 3 |
| D12 | No rate limiting on API | None | `@nestjs/throttler` global guard | High | 0 |
| D13 | No API documentation | None | Swagger/OpenAPI auto-generated | Medium | 0 |

---

## New Backend Modules Summary

Final backend module tree after full implementation:

```
backend/src/
├── app.module.ts                    ← Root: imports all modules below
├── app.controller.ts
├── app.service.ts
├── main.ts                          ← ADD: validation pipe, swagger, throttle
│
├── common/                          ← NEW: shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/                      ← Auth, Roles, Throttle
│   ├── interceptors/
│   └── pipes/
│
├── auth/                            ← NEW: Module
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── entities/user.entity.ts
│
├── listings/                        ← EXTEND: existing module
│   ├── listing-record.entity.ts     ← ADD columns
│   ├── listing-revision.entity.ts   ← NEW
│   ├── listings.controller.ts       ← ADD CRUD endpoints
│   ├── listings.service.ts          ← ADD CRUD methods
│   ├── search.service.ts            ← Existing (no change)
│   └── dto/                         ← ADD new DTOs
│
├── ingestion/                       ← NEW: Module 2
│   ├── ingestion.module.ts
│   ├── ingestion.controller.ts
│   ├── ingestion.service.ts
│   ├── ai/
│   ├── review/
│   ├── entities/
│   ├── dto/
│   └── processors/
│
├── fitment/                         ← NEW: Module 3
│   ├── fitment.module.ts
│   ├── fitment.controller.ts
│   ├── fitment.service.ts
│   ├── fitment-import.service.ts
│   ├── fitment-matcher.service.ts
│   ├── entities/
│   └── dto/
│
├── channels/                        ← NEW: Module 4
│   ├── channels.module.ts
│   ├── channels.controller.ts
│   ├── channels.service.ts
│   ├── adapters/ebay/
│   ├── adapters/shopify/
│   ├── entities/
│   ├── dto/
│   ├── processors/
│   └── guards/
│
├── inventory/                       ← NEW: Module 5
│   ├── inventory.module.ts
│   ├── inventory.controller.ts
│   ├── inventory.service.ts
│   ├── inventory-sync.service.ts
│   ├── duplicate-detector.service.ts
│   ├── entities/
│   └── processors/
│
├── dashboard/                       ← NEW: Module 6
│   ├── dashboard.module.ts
│   ├── dashboard.controller.ts
│   ├── dashboard.service.ts
│   ├── aggregation.service.ts
│   └── entities/
│
├── storage/                         ← NEW: Module 7
│   ├── storage.module.ts
│   ├── storage.controller.ts
│   ├── storage.service.ts
│   ├── image-processor.service.ts
│   └── processors/
│
├── orders/                          ← NEW: Module 8
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   ├── order-state-machine.ts
│   ├── entities/
│   └── processors/
│
├── settings/                        ← NEW: Module 9
│   ├── settings.module.ts
│   ├── settings.controller.ts
│   ├── settings.service.ts
│   └── entities/
│
└── notifications/                   ← NEW: Module 10
    ├── notifications.module.ts
    ├── notifications.controller.ts
    ├── notifications.service.ts
    ├── notification-gateway.ts
    └── entities/
```

**Total new entities:** 18  
**Total new API endpoints:** ~55  
**Total new BullMQ queues:** 6 (`ingestion`, `fitment`, `channels`, `inventory`, `orders`, `dashboard`)  
**Total new background job types:** ~20  

---

## Deployment Requirements (Updated)

### Infrastructure Additions

| Resource | Service | Purpose | Est. Monthly Cost |
|----------|---------|---------|-------------------|
| Redis | AWS ElastiCache `cache.t3.micro` | BullMQ + Socket.IO adapter + caching | ~$15 |
| S3 Bucket | `realtrack-images` | Image storage | ~$5-20 (usage) |
| CloudFront | Distribution | Image CDN | ~$5-15 (usage) |
| Larger DB | RDS `db.t3.small` | Additional tables + indexes | ~$30 |
| PM2 Cluster | 2 instances | Handle background jobs + API | Same server |

### Updated ecosystem.config.cjs

```javascript
module.exports = {
  apps: [
    {
      name: 'realtrackapp-api',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4191,
      },
      env_file: './backend/.env',
    },
    {
      name: 'realtrackapp-workers',
      cwd: './backend',
      script: 'dist/workers/main.js', // separate entry point for BullMQ workers
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_MODE: 'true',
      },
      env_file: './backend/.env',
    },
  ],
};
```

### Required Environment Variables (Addition)

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AWS
AWS_S3_BUCKET=realtrack-images
AWS_S3_REGION=us-east-1
AWS_CLOUDFRONT_DOMAIN=d1234.cloudfront.net
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# AI
OPENAI_API_KEY=
GOOGLE_VISION_API_KEY=

# eBay
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_REDIRECT_URI=https://mhn.realtrackapp.com/api/channels/ebay/callback
EBAY_ENVIRONMENT=PRODUCTION  # or SANDBOX

# Shopify
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_REDIRECT_URI=https://mhn.realtrackapp.com/api/channels/shopify/callback

# Auth
JWT_SECRET=
JWT_EXPIRY=24h

# Encryption
CHANNEL_ENCRYPTION_KEY=  # 32-byte hex for AES-256-GCM

# General
MAX_DAILY_AI_SPEND=50.00
```

---

## Appendix A — Risk Mitigation Implementation Plans

> Every risk from the Risk Register (R1–R10) and every per-module risk is expanded below into
> a concrete, implementable mitigation with code, SQL, configuration, or process steps.
> Risks are grouped by severity: **Critical → High → Medium → Low**.

---

### RM-01: `synchronize: true` in Production (R9 — Certain / High)

**Problem:** TypeORM `synchronize: true` auto-alters tables on every boot. A new column
or entity could drop data or add breaking constraints before you notice.

**Mitigation — Switch to Migration-Based Schema Management:**

```bash
# 1. Install TypeORM CLI
cd backend
npm install -D ts-node typeorm

# 2. Add ormconfig datasource (required for CLI)
```

```typescript
// backend/src/data-source.ts
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config({ path: '.env' });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'listingpro',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
});
```

```jsonc
// Add to backend/package.json "scripts":
{
  "migration:generate": "typeorm migration:generate -d src/data-source.ts src/migrations/Migration",
  "migration:run": "typeorm migration:run -d src/data-source.ts",
  "migration:revert": "typeorm migration:revert -d src/data-source.ts",
  "migration:show": "typeorm migration:show -d src/data-source.ts"
}
```

```typescript
// backend/src/app.module.ts — CHANGE:
// Before:
//   synchronize: config.get<string>('DB_SYNC', 'true') === 'true',
// After:
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get<string>('DB_HOST', 'localhost'),
    port: Number(config.get<string>('DB_PORT', '5432')),
    username: config.get<string>('DB_USER', 'postgres'),
    password: config.get<string>('DB_PASSWORD', 'postgres'),
    database: config.get<string>('DB_NAME', 'listingpro'),
    autoLoadEntities: true,
    synchronize: false,  // ← ALWAYS false
    migrationsRun: config.get<string>('NODE_ENV') !== 'test', // auto-run on boot
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    migrationsTableName: 'typeorm_migrations',
  }),
}),
```

```bash
# 3. Generate initial baseline migration (captures current schema as-is)
npm run migration:generate -- -n InitialBaseline

# 4. Deploy process update:
#    Before: npm run start:prod
#    After:  npm run migration:run && npm run start:prod
#    (or set migrationsRun: true in TypeORM config)
```

**Verification:** `SELECT * FROM typeorm_migrations;` shows all applied migrations.

---

### RM-02: No Authentication / Authorization (D4 — Certain / Critical)

**Problem:** Every API endpoint is publicly accessible. Any client can create, delete, or
modify listings without authentication.

**Mitigation — JWT Authentication + Role-Based Guards:**

```bash
cd backend
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

```typescript
// backend/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from './entities/user.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRY', '24h') },
      }),
    }),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

```typescript
// backend/src/auth/entities/user.entity.ts
import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn,
} from 'typeorm';

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  email: string;

  @Column({ type: 'text', select: false }) // never returned in queries
  passwordHash: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
```

```typescript
// backend/src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

interface JwtPayload {
  sub: string;   // user ID
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, active: true },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');
    return user;
  }
}
```

```typescript
// backend/src/common/guards/roles.guard.ts
import {
  CanActivate, ExecutionContext, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../auth/entities/user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true; // no roles required = public
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.role);
  }
}
```

```typescript
// backend/src/auth/auth.controller.ts
import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const result = await this.auth.validateAndSign(body.email, body.password);
    if (!result) throw new UnauthorizedException('Invalid credentials');
    return result; // { accessToken, user: { id, email, role, name } }
  }

  @Post('register')
  async register(
    @Body() body: { email: string; password: string; name?: string },
  ) {
    return this.auth.register(body.email, body.password, body.name);
  }
}
```

```typescript
// Usage in controllers — protect mutation endpoints:
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'manager')
@Post()
createListing(@Body() dto: CreateListingDto, @Req() req) {
  return this.listingsService.create(dto, req.user.id);
}

// Read endpoints can remain public or require 'viewer' role
```

**Migration for `users` table:**
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(200) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            VARCHAR(200),
  role            VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin','manager','user','viewer')),
  active          BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial admin user (password: change-me-immediately)
-- bcrypt hash of 'change-me-immediately' with 12 rounds
INSERT INTO users (email, password_hash, name, role) VALUES
  ('admin@realtrackapp.com',
   '$2b$12$LJ3m4yPh0YxQx6QZ6x5Rk.placeholder_hash_replace_on_first_login',
   'System Admin', 'admin');
```

---

### RM-03: Inventory Double-Sell (R5 — Medium / Critical)

**Problem:** Two marketplaces sell the last unit simultaneously before sync propagates.

**Mitigation — Multi-Layer Defense:**

```typescript
// Layer 1: SERIALIZABLE transaction + pessimistic lock (already in blueprint)
// Layer 2: Pre-validation before marketplace publish
// Layer 3: Emergency circuit breaker

// backend/src/inventory/inventory.service.ts

async processSaleEvent(
  listingId: string,
  quantitySold: number,
  channel: string,
  externalOrderId: string,
): Promise<InventoryEvent> {
  const idempotencyKey = `sale:${channel}:${externalOrderId}`;

  return this.dataSource.transaction('SERIALIZABLE', async (em) => {
    // Idempotency check — if this sale was already processed, return
    const existing = await em.findOne(InventoryEvent, {
      where: { idempotencyKey },
    });
    if (existing) {
      this.logger.warn(`Duplicate sale event ignored: ${idempotencyKey}`);
      return existing;
    }

    // Pessimistic lock on ledger row
    const ledger = await em
      .createQueryBuilder(InventoryLedger, 'l')
      .setLock('pessimistic_write')
      .where('l.listingId = :listingId', { listingId })
      .getOne();

    if (!ledger) {
      throw new NotFoundException(`No inventory ledger for listing ${listingId}`);
    }

    const available = ledger.quantityTotal - ledger.quantityReserved;

    if (available < quantitySold) {
      // OVERSELL DETECTED — still record the event but flag it
      this.logger.error(
        `OVERSELL: listing=${listingId} available=${available} sold=${quantitySold} channel=${channel}`,
      );

      // Record oversell event for reconciliation
      const event = em.create(InventoryEvent, {
        listingId,
        eventType: 'sale',
        quantityChange: -quantitySold,
        quantityBefore: ledger.quantityTotal,
        quantityAfter: Math.max(0, ledger.quantityTotal - quantitySold),
        sourceChannel: channel,
        sourceOrderId: externalOrderId,
        idempotencyKey,
        reason: `OVERSELL: available=${available}, sold=${quantitySold}`,
      });
      await em.save(event);

      // Set quantity to 0 and immediately end listings on all channels
      ledger.quantityTotal = Math.max(0, ledger.quantityTotal - quantitySold);
      ledger.version += 1;
      await em.save(ledger);

      // Emit emergency event — channel adapter will end listings
      this.eventEmitter.emit('inventory.oversell', {
        listingId,
        channel,
        externalOrderId,
        deficit: quantitySold - available,
      });

      return event;
    }

    // Normal sale path
    const event = em.create(InventoryEvent, {
      listingId,
      eventType: 'sale',
      quantityChange: -quantitySold,
      quantityBefore: ledger.quantityTotal,
      quantityAfter: ledger.quantityTotal - quantitySold,
      sourceChannel: channel,
      sourceOrderId: externalOrderId,
      idempotencyKey,
      reason: `Sale from ${channel}`,
    });

    ledger.quantityTotal -= quantitySold;
    ledger.version += 1;

    await em.save(event);
    await em.save(ledger);

    // If stock is now low, trigger cross-channel quantity update immediately
    const newAvailable = ledger.quantityTotal - ledger.quantityReserved;
    if (newAvailable <= (ledger.lowStockThreshold ?? 2)) {
      this.eventEmitter.emit('inventory.low-stock', { listingId, available: newAvailable });
    }
    if (newAvailable === 0) {
      this.eventEmitter.emit('inventory.out-of-stock', { listingId });
    }

    return event;
  });
}
```

```typescript
// Layer 3: Emergency circuit breaker — end all channel listings when oversold
// backend/src/inventory/listeners/oversell.listener.ts

@Injectable()
export class OversellListener {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly notificationService: NotificationsService,
  ) {}

  @OnEvent('inventory.oversell')
  async handleOversell(payload: {
    listingId: string;
    channel: string;
    externalOrderId: string;
    deficit: number;
  }) {
    // Immediately end listing on ALL channels except the one that triggered the sale
    await this.channelsService.endListingOnAllChannels(
      payload.listingId,
      `Oversell detected: deficit=${payload.deficit}`,
    );

    // Create critical notification for admin
    await this.notificationService.create({
      type: 'sync_conflict',
      severity: 'error',
      title: `Oversell detected — ${payload.deficit} unit(s) short`,
      body: `Listing was oversold on ${payload.channel}. Order: ${payload.externalOrderId}. All channel listings have been ended.`,
      entityType: 'listing',
      entityId: payload.listingId,
      actionUrl: `/listings/${payload.listingId}/edit`,
    });
  }
}
```

---

### RM-04: PII Data in Orders Without Encryption (R10 — High / Critical)

**Problem:** Buyer names, emails, and addresses stored in plaintext in PostgreSQL.

**Mitigation — Column-Level Encryption with TypeORM Transformer:**

```typescript
// backend/src/common/transformers/encrypted-column.transformer.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.COLUMN_ENCRYPTION_KEY;
  if (!secret) throw new Error('COLUMN_ENCRYPTION_KEY env var is required');
  // Derive a stable key from the secret using scrypt
  cachedKey = scryptSync(secret, 'realtrackapp-salt', KEY_LENGTH);
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as: iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(encryptedText: string): string {
  const key = getKey();
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// TypeORM column transformer
export const EncryptedTransformer = {
  to: (value: string | null): string | null => {
    if (value === null || value === undefined) return null;
    return encrypt(value);
  },
  from: (value: string | null): string | null => {
    if (value === null || value === undefined) return null;
    try {
      return decrypt(value);
    } catch {
      return value; // Return raw if decryption fails (migration period)
    }
  },
};
```

```typescript
// Usage in order.entity.ts:
import { EncryptedTransformer } from '../../common/transformers/encrypted-column.transformer';

@Column({ type: 'text', nullable: true, transformer: EncryptedTransformer })
buyerEmail: string | null;

@Column({ type: 'text', nullable: true, transformer: EncryptedTransformer })
buyerName: string | null;

@Column({ type: 'text', nullable: true, transformer: EncryptedTransformer })
shippingAddress1: string | null;

@Column({ type: 'text', nullable: true, transformer: EncryptedTransformer })
shippingAddress2: string | null;

// Note: buyer_username is NOT encrypted — it's a public marketplace handle
// Note: shipping_city, state, zip, country are NOT encrypted — needed for tax/shipping queries
```

```bash
# Required env var:
COLUMN_ENCRYPTION_KEY=your-32-char-minimum-secret-key-here

# Key rotation strategy:
# 1. Set COLUMN_ENCRYPTION_KEY_NEW alongside old key
# 2. Run migration job: decrypt with old -> encrypt with new -> save
# 3. Remove old key, rename new to primary
```

---

### RM-05: eBay API Approval & OAuth (R1 — High / Critical → RESOLVED)

**Status:** User confirmed eBay developer account exists.

**Remaining Setup Steps:**

```bash
# 1. Log into https://developer.ebay.com/my/keys
# 2. For Production keyset:
#    - App ID (Client ID) → EBAY_CLIENT_ID
#    - Cert ID (Client Secret) → EBAY_CLIENT_SECRET
#    - Dev ID (not used in OAuth flow but keep for reference)

# 3. App settings → Add RuName (Redirect URL Name):
#    - URL: https://mhn.realtrackapp.com/api/channels/ebay/callback
#    - Privacy Policy URL: https://mhn.realtrackapp.com/privacy
#    - Accept Redirect: checked

# 4. Subscribe to required API scopes:
#    https://api.ebay.com/oauth/api_scope/sell.inventory
#    https://api.ebay.com/oauth/api_scope/sell.account
#    https://api.ebay.com/oauth/api_scope/sell.fulfillment
#    https://api.ebay.com/oauth/api_scope/commerce.notification.subscription

# 5. Marketplace & Account Deletion notification endpoints:
#    https://mhn.realtrackapp.com/api/channels/webhooks/ebay
```

```typescript
// backend/src/channels/adapters/ebay/ebay-auth.service.ts

@Injectable()
export class EbayAuthService {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: string;

  constructor(private readonly config: ConfigService) {
    const env = config.get('EBAY_ENVIRONMENT', 'SANDBOX');
    this.baseUrl = env === 'PRODUCTION'
      ? 'https://auth.ebay.com'
      : 'https://auth.sandbox.ebay.com';
    this.clientId = config.getOrThrow('EBAY_CLIENT_ID');
    this.clientSecret = config.getOrThrow('EBAY_CLIENT_SECRET');
    this.redirectUri = config.getOrThrow('EBAY_REDIRECT_URI');
    this.scopes = [
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      'https://api.ebay.com/oauth/api_scope/commerce.notification.subscription',
    ].join(' ');
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes,
      state,
    });
    return `${this.baseUrl}/oauth2/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    const apiBase = this.baseUrl.replace('auth.', 'api.');
    const res = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${this.clientId}:${this.clientSecret}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`eBay token exchange failed: ${res.status} ${err}`);
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const apiBase = this.baseUrl.replace('auth.', 'api.');
    const res = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${this.clientId}:${this.clientSecret}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: this.scopes,
      }),
    });
    if (!res.ok) throw new Error(`eBay token refresh failed: ${res.status}`);
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  }
}
```

---

### RM-06: AI Costs Exceed Budget (R2 — Medium / High)

**Mitigation — Cost Control Service with Daily Cap + Provider Fallback:**

```typescript
// backend/src/ingestion/ai/ai-cost-guard.service.ts

@Injectable()
export class AiCostGuardService {
  constructor(
    @InjectRepository(AiResult)
    private readonly aiResultRepo: Repository<AiResult>,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Check if we can afford another AI call today.
   * Returns the cheapest available provider under budget, or throws.
   */
  async getAffordableProvider(): Promise<'openai' | 'google'> {
    const maxDailySpend = await this.settingsService.getNumber(
      'ai', 'max_daily_ai_spend', 50.0,
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { totalSpend } = await this.aiResultRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(j.ai_cost_usd), 0)', 'totalSpend')
      .innerJoin('ingestion_jobs', 'j', 'j.id = r.job_id')
      .where('r.created_at >= :todayStart', { todayStart })
      .getRawOne();

    const spent = Number(totalSpend);
    const remaining = maxDailySpend - spent;

    if (remaining <= 0) {
      throw new BadRequestException(
        `Daily AI budget exhausted: $${spent.toFixed(2)} / $${maxDailySpend.toFixed(2)}. ` +
        `Resets at midnight. Adjust in Settings > AI > max_daily_ai_spend.`,
      );
    }

    // OpenAI Vision: ~$0.01-0.04/image, Google Vision: ~$0.0015/image
    // If remaining budget is low, prefer cheaper provider
    if (remaining < 5) {
      return 'google'; // cheaper fallback
    }

    return 'openai'; // default to higher quality
  }

  /**
   * Record the cost of an AI call after completion.
   */
  async recordCost(jobId: string, provider: string, cost: number): Promise<void> {
    await this.aiResultRepo.update(
      { jobId },
      { /* cost is on the job, not the result */ },
    );
    // Update the job's ai_cost_usd column
    await this.aiResultRepo.manager.update('ingestion_jobs', jobId, {
      aiCostUsd: cost,
    });
  }
}
```

```typescript
// Cost estimation per provider:
const COST_PER_IMAGE = {
  openai: 0.03,   // GPT-4o Vision average
  google: 0.0015, // Google Cloud Vision
};

// In the ingestion processor, check budget before processing:
async processJob(data: IngestionJobData): Promise<void> {
  const provider = await this.costGuard.getAffordableProvider();
  // ... proceed with provider
  const estimatedCost = data.assetIds.length * COST_PER_IMAGE[provider];
  // ... after call, record actual cost
  await this.costGuard.recordCost(data.jobId, provider, actualCost);
}
```

---

### RM-07: AI Hallucinating MPN / Brand (Module 2 — High / High)

**Mitigation — Multi-Stage Validation Pipeline:**

```typescript
// backend/src/ingestion/ai/ai-normalizer.service.ts

@Injectable()
export class AiNormalizerService {
  constructor(
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
  ) {}

  /**
   * Validate and score AI-extracted fields against existing catalog data.
   * Returns adjusted confidence scores.
   */
  async validateAndScore(raw: AiExtraction): Promise<ValidatedExtraction> {
    const result = { ...raw };

    // 1. Brand validation — check if brand exists in our catalog
    if (raw.extractedBrand) {
      const brandCount = await this.listingRepo
        .createQueryBuilder('r')
        .where('LOWER(r.c_brand) = LOWER(:brand)', { brand: raw.extractedBrand })
        .getCount();

      if (brandCount === 0) {
        // Unknown brand — reduce confidence
        result.confidenceBrand = Math.min(raw.confidenceBrand ?? 0.5, 0.4);
        result.validationNotes = (result.validationNotes ?? '') +
          `Brand "${raw.extractedBrand}" not found in catalog (${brandCount} matches). `;
      } else {
        // Known brand — boost confidence
        result.confidenceBrand = Math.max(raw.confidenceBrand ?? 0.5, 0.85);
      }
    }

    // 2. MPN cross-reference — check for existing parts with same MPN
    if (raw.extractedMpn) {
      const mpnMatch = await this.listingRepo.findOne({
        where: { cManufacturerPartNumber: raw.extractedMpn },
        select: ['id', 'title', 'cBrand'],
      });

      if (mpnMatch) {
        // MPN exists — verify brand consistency
        if (mpnMatch.cBrand?.toLowerCase() !== raw.extractedBrand?.toLowerCase()) {
          result.confidenceMpn = 0.3; // MPN exists but brand mismatch = suspicious
          result.validationNotes = (result.validationNotes ?? '') +
            `MPN "${raw.extractedMpn}" exists under brand "${mpnMatch.cBrand}" ` +
            `but AI said "${raw.extractedBrand}". `;
        } else {
          result.confidenceMpn = 0.95; // MPN exists and brand matches = high confidence
          result.matchedExistingId = mpnMatch.id;
        }
      }
    }

    // 3. Price sanity check — compare to catalog average in same category
    if (raw.extractedPriceEstimate && raw.extractedPartType) {
      const { avg } = await this.listingRepo
        .createQueryBuilder('r')
        .select('AVG(CAST(r.start_price AS NUMERIC))', 'avg')
        .where('r.c_type = :type', { type: raw.extractedPartType })
        .andWhere("r.start_price ~ '^[0-9]+(\\.[0-9]+)?$'") // only numeric prices
        .getRawOne();

      if (avg) {
        const avgPrice = Number(avg);
        const ratio = raw.extractedPriceEstimate / avgPrice;
        if (ratio > 5 || ratio < 0.1) {
          // Price is 5x or 0.1x the category average — flagged
          result.validationNotes = (result.validationNotes ?? '') +
            `Price $${raw.extractedPriceEstimate} is ${ratio.toFixed(1)}x category avg ($${avgPrice.toFixed(2)}). `;
          result.confidenceOverall = Math.min(result.confidenceOverall, 0.5);
        }
      }
    }

    // 4. Recalculate overall confidence
    const scores = [
      result.confidenceTitle ?? 0.5,
      result.confidenceBrand ?? 0.5,
      result.confidenceMpn ?? 0.5,
      result.confidencePartType ?? 0.5,
    ];
    result.confidenceOverall = scores.reduce((a, b) => a + b, 0) / scores.length;

    return result;
  }
}
```

**Auto-approve threshold (configurable in settings):**
```
confidence_overall >= 0.85 → auto_approved → create draft listing
confidence_overall >= 0.60 → needs_review → human review queue
confidence_overall <  0.60 → rejected → manual entry required
```

---

### RM-08: Database Migrations Breaking Production (R3 — Medium / Critical)

**Mitigation — Safe Migration Protocol:**

```typescript
// backend/src/migrations/1709000000000-AddListingLifecycleColumns.ts

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddListingLifecycleColumns1709000000000 implements MigrationInterface {
  name = 'AddListingLifecycleColumns1709000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SAFETY: All new columns are nullable or have defaults
    // so existing rows are unaffected and no table lock is required.

    await queryRunner.query(`
      ALTER TABLE listing_records
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_by UUID NULL,
        ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS ebay_listing_id VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS shopify_product_id VARCHAR(64) NULL;
    `);

    // Add CHECK constraint only after column exists
    await queryRunner.query(`
      ALTER TABLE listing_records
        ADD CONSTRAINT chk_listing_status
        CHECK (status IN ('draft','ready','published','sold','delisted','archived'));
    `);

    // Concurrent index creation — does NOT lock the table
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listing_status
        ON listing_records (status) WHERE deleted_at IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listing_updated
        ON listing_records (updated_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_listing_updated;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_listing_status;`);
    await queryRunner.query(`
      ALTER TABLE listing_records
        DROP CONSTRAINT IF EXISTS chk_listing_status;
    `);
    await queryRunner.query(`
      ALTER TABLE listing_records
        DROP COLUMN IF EXISTS shopify_product_id,
        DROP COLUMN IF EXISTS ebay_listing_id,
        DROP COLUMN IF EXISTS published_at,
        DROP COLUMN IF EXISTS updated_by,
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS deleted_at,
        DROP COLUMN IF EXISTS version,
        DROP COLUMN IF EXISTS status;
    `);
  }
}
```

**Safe migration rules (enforced by code review):**
1. **Never** `DROP COLUMN` without a prior release removing code references
2. **Always** use `IF NOT EXISTS` / `IF EXISTS` for idempotency
3. **Always** use `CREATE INDEX CONCURRENTLY` (no table lock)
4. **Never** add `NOT NULL` columns without a `DEFAULT` value
5. **Always** split data-modifying migrations from schema migrations
6. **Test** every migration on a staging DB clone before production

```bash
# Deployment script (update PM2 ecosystem or CI/CD pipeline):
#!/bin/bash
set -e

echo "=== Pull latest code ==="
cd /home/app/listingpro
git pull origin main

echo "=== Build backend ==="
cd backend
npm ci --production=false
npm run build

echo "=== Run migrations ==="
npm run migration:run

echo "=== Restart backend ==="
pm2 restart realtrackapp-api --update-env

echo "=== Build frontend ==="
cd ..
npm ci --production=false
npm run build

echo "=== Done ==="
```

---

### RM-09: S3 Region Latency for Image Uploads (R4 — Low / Medium)

**Mitigation — Multi-Part Upload + Transfer Acceleration:**

```typescript
// backend/src/storage/storage.service.ts

import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnDomain: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow('AWS_S3_BUCKET');
    this.cdnDomain = config.get('AWS_CLOUDFRONT_DOMAIN', '');
    this.s3 = new S3Client({
      region: config.get('AWS_S3_REGION', 'us-east-1'),
      // Enable Transfer Acceleration for faster uploads from distant clients
      useAccelerateEndpoint: config.get('AWS_S3_ACCELERATE', 'false') === 'true',
    });
  }

  /**
   * Generate a pre-signed URL for direct browser → S3 upload.
   * Content-Length is enforced to prevent oversized uploads.
   */
  async getPresignedUploadUrl(opts: {
    key: string;
    contentType: string;
    maxSizeBytes: number;
  }): Promise<{ uploadUrl: string; key: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: opts.key,
      ContentType: opts.contentType,
      // Server-side encryption
      ServerSideEncryption: 'AES256',
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 300, // 5 minutes
    });

    return { uploadUrl, key: opts.key };
  }

  /**
   * Get CDN URL for an image (use CloudFront if configured, else S3 direct).
   */
  getCdnUrl(key: string): string {
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  /**
   * Delete an object from S3.
   */
  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }
}
```

```json
// S3 Bucket CORS configuration (apply via AWS Console or Terraform)
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://mhn.realtrackapp.com", "http://localhost:5173"],
      "AllowedMethods": ["PUT", "POST"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}

// S3 Lifecycle rule — clean temp uploads after 1 day
{
  "Rules": [
    {
      "ID": "CleanTempUploads",
      "Prefix": "temp/",
      "Status": "Enabled",
      "Expiration": { "Days": 1 }
    }
  ]
}
```

---

### RM-10: Input Validation (D3 — Certain / High)

**Mitigation — Global Validation Pipe:**

```typescript
// backend/src/main.ts — updated bootstrap

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Gzip compression
  app.use(compression({ level: 6, threshold: 1024 }));

  // CORS — now environment-driven (D5 fix)
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'https://mhn.realtrackapp.com'];
  app.enableCors({ origin: corsOrigins });

  // Global prefix
  app.setGlobalPrefix('api');

  // ✅ Global validation pipe (D3 fix)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip unknown properties
      forbidNonWhitelisted: true, // throw on unknown properties
      transform: true,          // auto-transform to DTO types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ✅ Swagger API docs (D13 fix)
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('RealTrackApp API')
      .setDescription('Multi-channel motor parts platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 4191);
}
bootstrap();
```

---

### RM-11: Rate Limiting (D12 — Certain / High)

**Mitigation — NestJS Throttler:**

```bash
cd backend && npm install @nestjs/throttler
```

```typescript
// backend/src/app.module.ts — add ThrottlerModule

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 10,   // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000,  // 1 minute
        limit: 100,  // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000,  // 1000 requests per hour
      },
    ]),
    // ... other imports
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

```typescript
// Per-endpoint override for expensive operations:
import { Throttle, SkipThrottle } from '@nestjs/throttler';

// AI ingestion — strict rate limit
@Throttle([{ name: 'medium', ttl: 60000, limit: 10 }])
@Post('jobs')
createIngestionJob(@Body() dto: CreateJobDto) { ... }

// Search — relaxed (already cached)
@SkipThrottle()
@Get('search')
search(@Query() query: SearchQueryDto) { ... }
```

---

### RM-12: Health Check Endpoint (D6 — Medium)

```bash
cd backend && npm install @nestjs/terminus
```

```typescript
// backend/src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}

// backend/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck, HealthCheckService, TypeOrmHealthIndicator,
  MemoryHealthIndicator, DiskHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
      () => this.disk.checkStorage('disk', {
        path: '/',
        thresholdPercent: 0.9, // 90% usage warning
      }),
      // Redis health check (add after Redis is installed):
      // () => this.redis.pingCheck('redis'),
    ]);
  }
}
```

---

### RM-13: Webhook Security (Module 4 — Medium / Medium)

```typescript
// backend/src/channels/guards/webhook-signature.guard.ts

import {
  CanActivate, ExecutionContext, Injectable, RawBodyRequest,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class EbayWebhookGuard implements CanActivate {
  private readonly logger = new Logger(EbayWebhookGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = req.headers['x-ebay-signature'] as string;

    if (!signature) {
      this.logger.warn('eBay webhook missing X-EBAY-SIGNATURE header');
      throw new UnauthorizedException('Missing signature');
    }

    // eBay uses Ed25519 digital signatures (public key verified)
    // For simplicity, we log + store all webhooks and process async
    // The real verification requires fetching eBay's public key
    // via the Key Management API

    return true; // Process webhook, validate asynchronously
  }
}

@Injectable()
export class ShopifyWebhookGuard implements CanActivate {
  private readonly logger = new Logger(ShopifyWebhookGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;

    if (!hmacHeader) {
      this.logger.warn('Shopify webhook missing HMAC header');
      throw new UnauthorizedException('Missing HMAC');
    }

    const secret = this.config.getOrThrow('SHOPIFY_API_SECRET');
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new UnauthorizedException('Raw body not available for HMAC verification');
    }

    const computed = createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    // Timing-safe comparison to prevent timing attacks
    const expected = Buffer.from(hmacHeader, 'base64');
    const actual = Buffer.from(computed, 'base64');

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      this.logger.warn('Shopify webhook HMAC verification failed');
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    return true;
  }
}
```

```typescript
// main.ts — IMPORTANT: preserve raw body for HMAC verification
import { NestFactory } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // ← preserves req.rawBody for webhook HMAC verification
  });
  // ...
}
```

---

### RM-14: WebSocket Scaling with PM2 Cluster (R7 — Low / Medium)

```typescript
// When running PM2 in cluster mode (instances > 1), Socket.IO connections
// may land on different workers. Use Redis adapter for cross-worker pub/sub.

// backend/src/notifications/notification-gateway.ts

import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

@WebSocketGateway({
  cors: { origin: ['http://localhost:5173', 'https://mhn.realtrackapp.com'] },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(private readonly config: ConfigService) {}

  async afterInit(server: Server) {
    // Only apply Redis adapter if running in cluster mode
    if (process.env.PM2_CLUSTER === 'true' || process.env.REDIS_HOST) {
      const pubClient = createClient({
        url: `redis://${this.config.get('REDIS_HOST', 'localhost')}:${this.config.get('REDIS_PORT', '6379')}`,
      });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
    }
  }
}
```

---

### RM-15: Shopify Rate Limiting During Bulk Sync (R8 — Medium / Medium)

```typescript
// backend/src/channels/adapters/shopify/shopify-rate-limiter.ts

@Injectable()
export class ShopifyRateLimiter {
  private remaining = 40; // Shopify REST: 40 requests / bucket
  private lastRefill = Date.now();
  private readonly refillRate = 2; // 2 requests/second leak rate

  /**
   * Wait until a request slot is available.
   * Implements leaky bucket algorithm matching Shopify's rate limit model.
   */
  async acquire(): Promise<void> {
    // Refill based on elapsed time
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.remaining = Math.min(40, this.remaining + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.remaining < 1) {
      // Calculate wait time
      const waitMs = ((1 - this.remaining) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs + 50)); // +50ms safety
      this.remaining = 1;
    }

    this.remaining -= 1;
  }

  /**
   * Update from Shopify response headers for accuracy.
   */
  updateFromHeaders(headers: Headers): void {
    const callLimit = headers.get('x-shopify-shop-api-call-limit');
    if (callLimit) {
      // Format: "32/40" (used/total)
      const [used, total] = callLimit.split('/').map(Number);
      this.remaining = total - used;
      this.lastRefill = Date.now();
    }
  }
}

// For GraphQL, track cost points instead:
@Injectable()
export class ShopifyGraphQLThrottler {
  private availableCost = 1000; // Shopify: 1000 points/second max

  async acquireCost(estimatedCost: number): Promise<void> {
    if (this.availableCost < estimatedCost) {
      const waitMs = ((estimatedCost - this.availableCost) / 50) * 1000; // 50 points/sec restore
      await new Promise((resolve) => setTimeout(resolve, waitMs + 100));
    }
    this.availableCost -= estimatedCost;
  }

  updateFromResponse(extensions: {
    cost: { requestedQueryCost: number; actualQueryCost: number; throttleStatus: {
      maximumAvailable: number; currentlyAvailable: number; restoreRate: number;
    }};
  }): void {
    this.availableCost = extensions.cost.throttleStatus.currentlyAvailable;
  }
}
```

---

### RM-16: Broken Dynamic Tailwind Classes (D9 — Certain / Low)

**Problem:** `bg-${c.color}-500/10` generates class names at runtime that Tailwind JIT
can never detect during build. These classes are always missing from the CSS output.

**Mitigation — Explicit Color Class Map:**

```typescript
// src/components/dashboard/Dashboard.tsx — replace dynamic class generation

// BEFORE (broken):
// className={`bg-${c.color}-500/10 text-${c.color}-600`}

// AFTER (working):
const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-600',   border: 'border-blue-200' },
  green:  { bg: 'bg-green-500/10',  text: 'text-green-600',  border: 'border-green-200' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-200' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-200' },
  red:    { bg: 'bg-red-500/10',    text: 'text-red-600',    border: 'border-red-200' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-200' },
  cyan:   { bg: 'bg-cyan-500/10',   text: 'text-cyan-600',   border: 'border-cyan-200' },
  pink:   { bg: 'bg-pink-500/10',   text: 'text-pink-600',   border: 'border-pink-200' },
};

// Usage:
const cls = colorClasses[c.color] ?? colorClasses.blue;
<div className={`${cls.bg} ${cls.text} rounded-lg p-4`}>
  {/* KPI card content */}
</div>
```

---

### RM-17: Frontend Error Handling (D7 — Medium / Medium)

**Mitigation — Centralized API Client with Retry + Toast Notifications:**

```typescript
// src/lib/apiClient.ts

type ApiOptions = {
  retries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
};

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown,
  ) {
    super(`API ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

const API_BASE = '/api';

async function request<T>(
  path: string,
  init?: RequestInit,
  opts: ApiOptions = {},
): Promise<T> {
  const { retries = 2, retryDelay = 1000, signal } = opts;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...init?.headers,
        },
      });

      // Handle auth failure — redirect to login
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new ApiError(401, 'Unauthorized');
      }

      // Rate limited — auto-retry after delay
      if (res.status === 429 && attempt < retries) {
        const retryAfter = Number(res.headers.get('Retry-After') ?? '2') * 1000;
        await sleep(retryAfter);
        continue;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(res.status, res.statusText, body);
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') throw err;

      // Network error — retry
      if (attempt < retries) {
        await sleep(retryDelay * (attempt + 1));
        continue;
      }
      throw new Error(
        err instanceof Error ? err.message : 'Network error — please check your connection',
      );
    }
  }

  throw new Error('Request failed after all retries');
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Public API
export const api = {
  get: <T>(path: string, opts?: ApiOptions) =>
    request<T>(path, { method: 'GET' }, opts),

  post: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, opts),

  put: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, opts),

  patch: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, opts),

  delete: <T>(path: string, opts?: ApiOptions) =>
    request<T>(path, { method: 'DELETE' }, opts),
};
```

---

### RM-18: ACES Data Licensing (R6 — Medium / High)

**Mitigation — Dual Data Source Strategy:**

```
Strategy 1 (Recommended): Customer's Own ACES Files
├── Customer exports their ACES catalog from their existing parts data provider
├── Upload via /api/fitment/bulk-import
├── No licensing issues — customer owns the data
└── Limitation: only covers their specific inventory

Strategy 2: Open AAIA/AutoCare Data
├── AAIA (Auto Care Association) provides reference data
├── Free for members ($300+/year membership)
├── VCdb (Vehicle Configuration Database): makes, models, years, engines
├── NOT free for non-members — commercial license required
└── Alternative: build from public data (Wikipedia, NHTSA VIN decoder)

Strategy 3 (Implemented): Incremental Build from AI + Manual Entry
├── AI extracts fitment from listing titles/descriptions
├── Each new make/model/year is added to our reference tables
├── Over time, reference tables grow organically
├── Verified fitments become the gold standard
└── No external licensing dependency
```

```sql
-- Seed with publicly available make/model data (no licensing issues):
-- Source: NHTSA VPIC API (public domain, US government data)
-- https://vpic.nhtsa.dot.gov/api/

-- Top 50 makes (public knowledge):
INSERT INTO fitment_makes (name, slug) VALUES
  ('Acura', 'acura'), ('Alfa Romeo', 'alfa-romeo'), ('Audi', 'audi'),
  ('BMW', 'bmw'), ('Buick', 'buick'), ('Cadillac', 'cadillac'),
  ('Chevrolet', 'chevrolet'), ('Chrysler', 'chrysler'), ('Dodge', 'dodge'),
  ('Ferrari', 'ferrari'), ('Fiat', 'fiat'), ('Ford', 'ford'),
  ('Genesis', 'genesis'), ('GMC', 'gmc'), ('Honda', 'honda'),
  ('Hyundai', 'hyundai'), ('Infiniti', 'infiniti'), ('Jaguar', 'jaguar'),
  ('Jeep', 'jeep'), ('Kia', 'kia'), ('Lamborghini', 'lamborghini'),
  ('Land Rover', 'land-rover'), ('Lexus', 'lexus'), ('Lincoln', 'lincoln'),
  ('Maserati', 'maserati'), ('Mazda', 'mazda'), ('Mercedes-Benz', 'mercedes-benz'),
  ('Mini', 'mini'), ('Mitsubishi', 'mitsubishi'), ('Nissan', 'nissan'),
  ('Porsche', 'porsche'), ('Ram', 'ram'), ('Rivian', 'rivian'),
  ('Subaru', 'subaru'), ('Tesla', 'tesla'), ('Toyota', 'toyota'),
  ('Volkswagen', 'volkswagen'), ('Volvo', 'volvo')
ON CONFLICT (slug) DO NOTHING;

-- Years 1960-2027:
INSERT INTO fitment_years (year) SELECT generate_series(1960, 2027)
ON CONFLICT (year) DO NOTHING;
```

---

### RM-19: Optimistic Lock Conflicts (Module 1 — Medium / Low)

```typescript
// backend/src/listings/listings.service.ts

async update(
  id: string,
  dto: UpdateListingDto,
  userId: string,
): Promise<{ listing: ListingRecord; revision: ListingRevision }> {
  return this.dataSource.transaction(async (em) => {
    // Load current listing
    const listing = await em.findOneOrFail(ListingRecord, { where: { id } });

    // Check optimistic lock
    if (listing.version !== dto.version) {
      // Return enough info for the frontend to show a merge UI
      throw new ConflictException({
        message: 'This listing was modified by another user since you loaded it.',
        currentVersion: listing.version,
        yourVersion: dto.version,
        currentData: listing,
        hint: 'Reload the listing, review changes, and re-submit.',
      });
    }

    // Snapshot current state for revision history
    const snapshot = { ...listing } as Record<string, unknown>;
    delete snapshot.searchVector; // don't store tsvector in revision

    const oldStatus = listing.status;

    // Apply changes
    const { version: _v, ...changes } = dto;
    Object.assign(listing, changes);
    listing.updatedBy = userId;

    // Save (TypeORM auto-increments @VersionColumn)
    const saved = await em.save(ListingRecord, listing);

    // Create revision record
    const revision = em.create(ListingRevision, {
      listingId: id,
      version: saved.version,
      statusBefore: oldStatus,
      statusAfter: saved.status,
      snapshot,
      changeReason: 'manual_edit',
      changedBy: userId,
    });
    await em.save(revision);

    return { listing: saved, revision };
  });
}
```

```typescript
// Frontend — conflict resolution UI
// src/components/listings/ConflictModal.tsx

function ConflictModal({ conflict, onResolve, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <h3 className="text-lg font-semibold text-red-600 mb-2">
          Edit Conflict Detected
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          This listing was modified by another user (version {conflict.currentVersion}).
          You were editing version {conflict.yourVersion}.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => onResolve('reload')}
            className="flex-1 bg-blue-600 text-white rounded px-4 py-2"
          >
            Reload & Review
          </button>
          <button
            onClick={() => onResolve('force')}
            className="flex-1 bg-orange-600 text-white rounded px-4 py-2"
          >
            Overwrite (Force Save)
          </button>
          <button onClick={onCancel} className="px-4 py-2 border rounded">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### RM-20: OAuth Token Expiry During Bulk Operations (Module 4 — Medium / Medium)

```typescript
// backend/src/channels/channels.service.ts

/**
 * Get a valid access token for a channel connection.
 * Auto-refreshes if expired or about to expire (within 5 min).
 */
async getValidToken(connectionId: string): Promise<string> {
  const conn = await this.connRepo.findOneOrFail({
    where: { id: connectionId },
  });

  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (conn.tokenExpiresAt && conn.tokenExpiresAt > fiveMinutesFromNow) {
    // Token is still valid — decrypt and return
    return decrypt(conn.accessToken);
  }

  // Token expired or about to expire — refresh
  this.logger.log(`Refreshing token for ${conn.channel}:${conn.marketplaceAccountId}`);

  const adapter = this.getAdapter(conn.channel);
  const decryptedRefresh = decrypt(conn.refreshToken);

  try {
    const newTokens = await adapter.refreshToken({
      ...conn,
      refreshToken: decryptedRefresh,
    });

    // Update stored tokens
    await this.connRepo.update(connectionId, {
      accessToken: encrypt(newTokens.accessToken),
      refreshToken: newTokens.refreshToken
        ? encrypt(newTokens.refreshToken)
        : conn.refreshToken,
      tokenExpiresAt: newTokens.expiresAt,
      status: 'active',
      lastError: null,
      updatedAt: new Date(),
    });

    return newTokens.accessToken;
  } catch (err) {
    // Token refresh failed — mark connection as expired
    await this.connRepo.update(connectionId, {
      status: 'expired',
      lastError: err instanceof Error ? err.message : 'Token refresh failed',
      updatedAt: new Date(),
    });

    // Notify admin
    this.eventEmitter.emit('channel.error', {
      connectionId,
      channel: conn.channel,
      error: 'Token refresh failed — re-authentication required',
    });

    throw new UnauthorizedException(
      `${conn.channel} token expired and refresh failed. Please reconnect.`,
    );
  }
}
```

```typescript
// Background job: proactive token refresh (every 30 min)
// backend/src/channels/processors/token-refresh.processor.ts

@Processor('channels')
export class TokenRefreshProcessor {
  @Process('refresh-tokens')
  async refreshExpiring(job: Job): Promise<void> {
    // Find connections expiring within 1 hour
    const connections = await this.connRepo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: 'active' })
      .andWhere('c.token_expires_at < :threshold', {
        threshold: new Date(Date.now() + 60 * 60 * 1000),
      })
      .getMany();

    for (const conn of connections) {
      try {
        await this.channelsService.getValidToken(conn.id);
        this.logger.log(`Refreshed token for ${conn.channel}:${conn.marketplaceAccountId}`);
      } catch (err) {
        this.logger.error(`Failed to refresh ${conn.channel}: ${err}`);
      }
    }
  }
}
```

---

## Appendix B — Risk Mitigation Status Matrix

| # | Risk | Status | Mitigation Applied | Residual Risk |
|---|------|--------|-------------------|---------------|
| R1 | eBay API approval | ✅ RESOLVED | User has developer account | None — proceed to OAuth setup |
| R2 | AI costs exceed budget | ✅ MITIGATED | AiCostGuardService with daily cap + dual-provider fallback | Low — manual budget increase possible |
| R3 | DB migrations break production | ✅ MITIGATED | Migration-only schema, `CREATE INDEX CONCURRENTLY`, idempotent DDL, staging-first protocol | Low — human error still possible |
| R4 | S3 region latency | ✅ MITIGATED | CloudFront CDN, Transfer Acceleration option, pre-signed URLs | Negligible |
| R5 | Inventory double-sell | ✅ MITIGATED | 3-layer defense: SERIALIZABLE txn + pessimistic lock + idempotency + oversell circuit breaker | Low — edge case at extreme concurrency |
| R6 | ACES data licensing | ✅ MITIGATED | 3-strategy approach: customer files, public NHTSA data, or organic AI+manual build | None — no external license dependency |
| R7 | WebSocket PM2 scaling | ✅ MITIGATED | Redis adapter for Socket.IO cross-worker pub/sub | Negligible |
| R8 | Shopify rate limiting | ✅ MITIGATED | Leaky bucket rate limiter (REST), cost-point throttler (GraphQL), header-driven updates | Low |
| R9 | `synchronize: true` | ✅ MITIGATED | Set to `false`, TypeORM migrations setup, data-source CLI config | None after deployment |
| R10 | PII without encryption | ✅ MITIGATED | AES-256-GCM column transformer, key derivation via scrypt, rotation strategy | Low — key management in env vars |
| D3 | No input validation | ✅ MITIGATED | Global ValidationPipe, whitelist + forbidNonWhitelisted | None |
| D4 | No auth | ✅ MITIGATED | JWT + Passport + RolesGuard + User entity | Low — password policy enforcement TBD |
| D5 | Hardcoded CORS | ✅ MITIGATED | `CORS_ORIGIN` env var | None |
| D6 | No health check | ✅ MITIGATED | @nestjs/terminus: DB + memory + disk checks | None |
| D7 | Frontend error handling | ✅ MITIGATED | Centralized apiClient with retry, 401 redirect, rate-limit backoff | Low |
| D9 | Dynamic Tailwind classes | ✅ MITIGATED | Explicit colorClasses map | None |
| D12 | No rate limiting | ✅ MITIGATED | @nestjs/throttler: short/medium/long buckets + per-endpoint overrides | Low |
| D13 | No API docs | ✅ MITIGATED | @nestjs/swagger auto-generation in non-production | None |

---

*End of Enterprise Implementation Blueprint v1.1 — Risk Mitigations Added*
