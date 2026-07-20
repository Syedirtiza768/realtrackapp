> ⚠️ MOVED → [/docs/operations/ENVIRONMENT_VARIABLES.md](../operations/ENVIRONMENT_VARIABLES.md) (2026-06-06)

# Environment Variables

Source of truth: `.env.example` (copy to `.env`). Docker passes these via
`docker-compose.yml` `environment` (container ignores host `.env` because
`IGNORE_ENV_FILE=true`). The backend CLI/migrations read `backend/.env`
(`data-source.ts`).

> **Never commit real secret values.** This file documents variable *names* and
> purpose only.

## Database (PostgreSQL)

| Var | Default | Purpose |
|-----|---------|---------|
| `DB_HOST` | `localhost` (`postgres` in Docker) | DB host |
| `DB_PORT` | `5432` | DB port (internal) |
| `DB_PORT_EXTERNAL` | `5432` | Host-exposed port |
| `DB_USER` | `postgres` | DB user |
| `DB_PASSWORD` | `postgres` | DB password (**secret**) |
| `DB_NAME` | `listingpro` | Database name |
| `DB_SYNCHRONIZE` | `false` | TypeORM auto-sync (keep false) |
| `DB_MIGRATIONS_RUN` | `true` | Enable migration runner (Docker entrypoint + optional Nest boot) |
| `DB_MIGRATIONS_AT_ENTRYPOINT` | `true` | Run migrations in container entrypoint before API start |
| `DB_MIGRATION_HOST` | `postgres` | Direct Postgres host for DDL (bypasses PgBouncer in prod overlay) |
| `DB_POOL_MAX` / `DB_POOL_MIN` | `10` / `2` (t3.medium) | Connection pool |
| `DB_LOGGING` | `false` | SQL logging |

## Redis

| Var | Default | Purpose |
|-----|---------|---------|
| `REDIS_HOST` | `localhost` (`redis` in Docker) | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PORT_EXTERNAL` | `6379` | Host-exposed port |
| `REDIS_PASSWORD` | _(empty)_ | Redis auth (**secret**) |

## Auth / RBAC

| Var | Purpose |
|-----|---------|
| `JWT_SECRET` | **Required.** JWT signing secret (**secret**) |
| `RBAC_SYNC_PERMISSIONS` | If `true`, sync permission registry → DB on startup |
| `SEED_DEMO_USERS` | If `true` (non-prod), seed default users |
| `DEFAULT_SUPER_ADMIN_EMAIL` / `_PASSWORD` | Seed super admin (**secret pw**) |
| `DEFAULT_ADMIN_EMAIL` / `_PASSWORD` | Seed admin |
| `DEFAULT_MANAGER_EMAIL` / `_PASSWORD` | Seed manager |
| `DEFAULT_STAFF_EMAIL` / `_PASSWORD` | Seed staff |
| `DEFAULT_VIEWER_EMAIL` / `_PASSWORD` | Seed viewer |

## CORS / network

| Var | Default | Purpose |
|-----|---------|---------|
| `CORS_ORIGIN` | localhost:8050, mhn.realtrackapp.com | Comma-separated allow-list |
| `PORT` | `4191` | Backend listen port |
| `FRONTEND_PORT` | `8050` | Docker frontend host port |
| `BACKEND_PORT_EXTERNAL` | `4191` | Docker backend host port |

## OpenAI

| Var | Default | Purpose |
|-----|---------|---------|
| `OPENAI_API_KEY` | — | **Secret.** OpenAI key |
| `OPENAI_MODEL_DEFAULT` | `openai/gpt-4.1-mini` | Default full enrichment lane |
| `OPENAI_MODEL_FLAGSHIP` | `google/gemini-2.5-flash` | High-value / fitment-critical lane |
| `OPENAI_MODEL_BULK` | `deepseek/deepseek-chat-v3-0324` | Bulk overnight lane |
| `OPENAI_MODEL_TEXT` | `openai/gpt-4o-mini` | Text-only cleanup (no fitment) |
| `OPENAI_MODEL_ESCALATION` | `google/gemini-2.5-flash` | One retry after hard validation fail |
| `OPENAI_CHAT_MODEL` | alias → `OPENAI_MODEL_DEFAULT` | Legacy chat model env |
| `OPENAI_VISION_MODEL` | `google/gemini-2.5-flash` | Vision model (OpenRouter); router avoids bulk/text-only models |
| `OPENAI_LISTING_MODEL` | `openai/gpt-4.1-mini` | Listing generation model |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter-compatible API base URL |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embeddings model |
| `OPENAI_TIMEOUT_MS` | `120000` | Chat completion timeout (ms) |
| `OPENAI_MODEL_FLAGSHIP_MIN_PRICE` | `200` | Price threshold for flagship lane |
| `AI_LOW_VALUE_MAX_PRICE` | `50` | SKUs below this use compact enrichment (no LLM fitment) |
| `OPENAI_VISION_DETAIL` | `auto` | Vision image detail: `low`, `auto`, or `high` |
| `AI_FITMENT_MIN_ROWS` | `5` | Soft-fail threshold for fitment rows |
| `AI_AUTO_APPROVE_MIN_SCORE` | `85` | Min validator score for auto-approve learning |
| `AI_ROUTING_POLICY_PATH` | `config/ai-routing-policy.json` | Learned routing policy file |
| `AI_OPTIMIZER_ENABLED` | `false` | Nightly optimizer cron |
| `AI_OPTIMIZER_CANARY_PERCENT` | `10` | % of SKUs on new policy first |
| `AI_LEARNING_MIN_SAMPLES` | `20` | Min outcomes before optimizer changes segment |
| `AI_PROMPT_VERSION` | `enrichment-v1` | Logged on every `ai_run_logs` row |
| `AI_RUN_MODE` | `default` | Pipeline run mode: `default` \| `bulk` |
| `AI_TAXONOMY_VALIDATION_ENABLED` | `false` | When `true`, validate category leaf + required aspects from cached `ebay_categories` |

## eBay Developer API

| Var | Default | Purpose |
|-----|---------|---------|
| `EBAY_CLIENT_ID` | — | **Secret.** App ID |
| `EBAY_CLIENT_SECRET` | — | **Secret.** Cert ID |
| `EBAY_DEV_ID` | — | **Secret.** Dev ID |
| `EBAY_ENVIRONMENT` | `SANDBOX` | `SANDBOX` or `PRODUCTION` |
| `EBAY_SANDBOX` | — | Legacy override (takes precedence if set) |
| `EBAY_REDIRECT_URI` | — | OAuth redirect/RuName |
| `EBAY_DEFAULT_MERCHANT_LOCATION_KEY` | `AE_Dubai` | Key used when auto-provisioning an inventory location |
| `EBAY_DEFAULT_INVENTORY_ADDRESS_LINE1` | `Dubai Warehouse` | Ship-from line 1 for auto-created locations |
| `EBAY_DEFAULT_INVENTORY_CITY` | `Dubai` | Ship-from city |
| `EBAY_DEFAULT_INVENTORY_STATE` | _(empty)_ | Ship-from state/province (optional; unused for AE) |
| `EBAY_DEFAULT_INVENTORY_POSTAL_CODE` | _(empty)_ | Ship-from postal code (optional; unused for AE) |
| `EBAY_DEFAULT_INVENTORY_COUNTRY` | `AE` | Ship-from country (ISO) |
| `EBAY_DAILY_PUBLISH_TARGET_LIMIT` | `5000` | Organization-wide UTC-day quota for listing/store publish targets; hard-capped at 5,000 |
| `PUBLISHED_LISTINGS_SYNC_CRON` | `*/15 * * * *` | Cron for scheduled published-listings mirror refresh; defaults to every 15 minutes for near-real-time API consumers |
| `PUBLISHED_LISTINGS_DEFAULT_STORE_SLUGS` | `salvagea,blackline` | Default `storeSlug` scope for `GET /published-listings` when neither `storeId` nor `storeSlug` is provided. Set to `all` (or empty) to disable. |
| `PUBLISHED_LISTINGS_ENRICH_MAX_PER_SYNC` | `150` | Max Trading GetItem / Browse legacy-listing enrichments per sync run (full `imageUrls[]` + compatibility backfill). Leftover budget after the live-list upsert pass is spent on active rows that still have ≤1 image. Keep bounded so SellerList sync + hard-gate prune can finish. |

Per-store override: set `stores.config.shipFromAddress` (object with the same
field names) or `stores.location_key` / `config.locationKey`.

## SellerPundit (optional eBay connection source)

Used when importing eBay stores via SellerPundit instead of native OAuth.
Org-level credentials can override env via `PUT /api/integrations/ebay/sellerpundit/config`.

| Var | Default | Purpose |
|-----|---------|---------|
| `SELLERPUNDIT_API_BASE_URL` | `https://authentication.sellerpundit.com/api/v1` | Login API base |
| `SELLERPUNDIT_MARKETPLACES_URL` | `https://marketplaces.sellerpundit.com` | Policies, tokens, publish API |
| `SELLERPUNDIT_EMAIL` | — | **Secret.** Fallback login email |
| `SELLERPUNDIT_PASSWORD` | — | **Secret.** Fallback login password |
| `SELLERPUNDIT_ENVIRONMENT` | `production` | Stored on imported accounts |
| `SELLERPUNDIT_DEFAULT_MARKETPLACE_ID` | `EBAY_MOTORS_US` | Default marketplace when mapping |
| `SELLERPUNDIT_POLICY_SYNC_MAX_AGE_HOURS` | `24` | TTL before publish re-syncs policies |
| `SELLERPUNDIT_PUBLISH_FALLBACK` | `auto` | `auto` = try SP bulk-create then fall back to direct eBay on platform SQL error; `direct_ebay` = skip SP publish; `sellerpundit` = SP only |

## AWS S3 / storage

| Var | Default | Purpose |
|-----|---------|---------|
| `AWS_S3_BUCKET` | `solarrisebackupbucket` | Bucket |
| `AWS_S3_PREFIX` | `mhn/` | Key prefix |
| `AWS_S3_REGION` | `us-east-1` | Region |
| `AWS_ACCESS_KEY_ID` | — | **Secret** |
| `AWS_SECRET_ACCESS_KEY` | — | **Secret** |
| `S3_BUCKET` / `S3_PREFIX` / `S3_REGION` | — | Legacy aliases |

## Node / runtime

| Var | Default | Purpose |
|-----|---------|---------|
| `NODE_ENV` | `production` (Docker) | Env mode; gates Swagger |
| `NODE_OPTIONS` | `--max-old-space-size=1536` (t3.medium) | V8 heap; raise on larger instances |
| `IGNORE_ENV_FILE` | `true` (Docker) | Ignore host `.env` in container |
| `PIPELINE_PROJECT_ROOT` | `/app` | Root for pipeline scripts/output |
| `PIPELINE_TARGET_MARKETPLACE` | (from job) | Set by the pipeline worker from upload provisioning (`US` \| `UK` \| `AU` \| `DE`). When set, only that marketplace is category-mapped, localized, exported, and imported. Omit on legacy jobs to generate all four outputs. |
| `PIPELINE_AI_CONCURRENCY` | `3` (t3.medium) | Max parallel OpenRouter enrichment batches |
| `PIPELINE_AI_BATCH_SIZE` | `6` (t3.medium) | Parts per AI batch (structured JSON) |
| `PIPELINE_LOCALIZATION_CONCURRENCY` | `3` (t3.medium) | Parallel AU/DE localization batches |
| `PIPELINE_LOCALIZATION_MODE` | `copy` | `copy` = AI title + description; `titles_only` = AI titles only; `ai` = all fields + description; `rule` = rule-based only |
| `PIPELINE_LOCALIZATION_MODEL` | `openai/gpt-4o-mini` | OpenRouter model for AU/DE localization (faster than enrichment model) |
| `PIPELINE_LOCALIZATION_BATCH_SIZE` | `8` | Parts per localization AI batch (smaller when descriptions included) |
| `PIPELINE_FAST_MODE` | `0` | `1` = rule localization + skip image validation + skip marketplace backfill |
| `PIPELINE_SKIP_IMAGE_VALIDATION` | `true` | Skip slow HTTP validation of image URLs after fetch |
| `PIPELINE_SKIP_IMAGE_FETCH` | `0` | Use source/upload images only — no image API |
| `PIPELINE_MIRROR_IMAGES` | `true` | Mirror listing images to S3 after pipeline (backend) |
| `PIPELINE_SKIP_MVL_ON_IMPORT` | auto | When unset: validate on import if local MVL is loaded (`npm run mvl:import`); set `true` to skip, `false` to force |
| `MVL_VALIDATION_CONCURRENCY` | `6` | Max concurrent canonicalization lookups during batched MVL validation (store branch). Existence checks are batched into ~3–5 queries regardless; this caps parallel canonicalization for non-matching makes/models. Keep `× MAX_CONCURRENT_PIPELINE_JOBS ≤ DB_POOL_MAX − 2` |
| `EBAY_MVL_DATA_DIR` | `../drive-download-20260706T171856Z-3-001` | Allowed root for `POST /api/fitment/ebay-mvl/import` and `npm run mvl:import` |
| `EBAY_MVL_WORKBOOK_PASSWORD` | — | Password for UK/US eBay MVL `.xlsx` files (requires Python `msoffcrypto-tool`) |
| `FITMENT_EXPANSION_MODE` | `hybrid` | `mvl` \| `hybrid` \| `ai` — deterministic MVL fitment vs legacy AI `compatibility[]` in enrichment prompt |
| `FITMENT_AI_INTERCHANGE` | `auto` | `off` \| `auto` \| `always` — micro-call when MVL row count is below `FITMENT_MIN_MVL_ROWS` |
| `FITMENT_MIN_MVL_ROWS` | `5` | Minimum valid MVL rows before skipping interchange micro-call |
| `FITMENT_SIBLING_EXPANSION` | `conservative` | `off` \| `conservative` \| `aggressive` — sibling model expansion from local MVL |
| `FITMENT_MVL_REQUIRED` | `true` | When local MVL release missing, flag `needs_review` instead of silent platform-only fitment |
| `PIPELINE_EXPORT_MAX_FITMENT_ROWS` | `80` | Max compatibility rows per listing in export templates |
| `PIPELINE_DESC_MAX_FITMENT_ROWS` | `30` | Max fitment rows embedded in listing description HTML |
| `MAX_CONCURRENT_PIPELINE_JOBS` | `2` | Max jobs **actively processing** (not queued `pending`); upload returns 503 when full |
| `PIPELINE_JOB_STALE_MINUTES` | `360` | Auto-fail stuck processing jobs with no DB progress (frees upload slots) |
| `PIPELINE_IMAGE_CONCURRENCY` | `3` (t3.medium) | Parallel image-enrichment API batches |
| `PIPELINE_CATEGORY_CONCURRENCY` | `2` (t3.medium) | Parallel eBay taxonomy lookups (capped at 2; rate limiter is primary throttle) |
| `PIPELINE_CATEGORY_MODE` | `auto` | `auto` = eBay Taxonomy per marketplace (US/AU/DE trees) → Gemini AI → keyword+Taxonomy fallback |
| `PIPELINE_CATEGORY_AI_MODEL` | `google/gemini-2.5-flash` | OpenRouter model for AI category tier; resolves AU/DE IDs via Taxonomy on trees `15`/`77` (see `docs/model-comparison/category-benchmark/REPORT.md`) |
| `PIPELINE_CATEGORY_AI_BATCH_SIZE` | `12` | Parts per AI category batch |
| `PIPELINE_CATEGORY_AI_MIN_CONFIDENCE` | `0.55` | Min AI confidence before keyword fallback |
| `PIPELINE_TAXONOMY_RPS` | `2` | Max eBay Taxonomy API requests per second |
| `PIPELINE_TAXONOMY_DAILY_QUOTA` | `4800` | Daily Taxonomy API budget (eBay Tier-1 limit is 5,000/day) |
| `EBAY_TAXONOMY_RPS` | `2` | Backend Taxonomy API rate limit (requests/second) |
| `EBAY_TAXONOMY_CACHE_PATH` | `config/.ebay-taxonomy-suggestions-cache.json` | Shared persistent category suggestion cache |
| `PIPELINE_VIN_BATCH_CONCURRENCY` | `3` (t3.medium) | Parallel NHTSA VIN decode batches |
| `PIPELINE_MVL_IMPORT_CONCURRENCY` | `8` | Parallel MVL fitment validation during post-enrichment catalog import (store-based; DB-bound) |
| `PIPELINE_CATEGORY_GUARD_CONCURRENCY` | `8` | Parallel category normalization before pipeline catalog/listing persistence; unrelated, parent, or unresolved categories are remapped to a verified Motors leaf, with `9886` as the emergency fallback |
| `PIPELINE_IMAGE_SKU_CONCURRENCY` | `2` (t3.medium) | Parallel S3 image mirror per SKU |
| `CATALOG_IMPORT_EBAY_BROWSE_CONCURRENCY` | `2` (t3.medium) | eBay browse calls during CSV import |
| `CATALOG_IMPORT_IMAGE_SKU_CONCURRENCY` | `2` (t3.medium) | Image mirror concurrency during CSV import |
| `OPENAI_CONCURRENCY` | — | Alias for `PIPELINE_AI_CONCURRENCY` |

## Frontend (Vite) — optional ingestion provider

| Var | Purpose |
|-----|---------|
| `VITE_INGESTION_PROVIDER` | `mock` (default) or `api` |
| `VITE_INGESTION_API_BASE_URL` | Required when provider is `api` |
| `VITE_INGESTION_HEALTH_PATH` | Optional health path |

> When adding a new env var: add it to `.env.example`, wire it in
> `docker-compose.yml` if containerized, and document it here.
