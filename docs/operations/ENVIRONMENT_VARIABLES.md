# Environment Variables

> **Source**: Moved from `docs/development/environment-variables.md` (2026-05-29).
> Source of truth: `.env.example` (copy to `.env`).
> **Never commit real secret values.** This file documents variable *names* and purpose only.

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
| `DB_MIGRATIONS_RUN` | `true` | Run migrations on boot |
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

## CORS / Network

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
| `OPENAI_CHAT_MODEL` | `minimax/minimax-m3` | Chat model (OpenRouter) |
| `OPENAI_VISION_MODEL` | `minimax/minimax-m3` | Vision model (OpenRouter) |
| `OPENAI_LISTING_MODEL` | `minimax/minimax-m3` | Listing generation model (OpenRouter) |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter-compatible API base URL |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embeddings model |

## eBay Developer API

| Var | Default | Purpose |
|-----|---------|---------|
| `EBAY_CLIENT_ID` | — | **Secret.** App ID |
| `EBAY_CLIENT_SECRET` | — | **Secret.** Cert ID |
| `EBAY_DEV_ID` | — | **Secret.** Dev ID |
| `EBAY_ENVIRONMENT` | `SANDBOX` | `SANDBOX` or `PRODUCTION` |
| `EBAY_SANDBOX` | — | Legacy override (takes precedence if set) |
| `EBAY_REDIRECT_URI` | — | OAuth redirect/RuName |
| `EBAY_DEFAULT_MERCHANT_LOCATION_KEY` | `default` | Auto-provisioned inventory location key |
| `EBAY_DEFAULT_INVENTORY_ADDRESS_LINE1` | `Primary Warehouse` | Ship-from line 1 |
| `EBAY_DEFAULT_INVENTORY_CITY` | `Houston` | Ship-from city |
| `EBAY_DEFAULT_INVENTORY_STATE` | `TX` | Ship-from state |
| `EBAY_DEFAULT_INVENTORY_POSTAL_CODE` | `77001` | Ship-from postal code |
| `EBAY_DEFAULT_INVENTORY_COUNTRY` | `US` | Ship-from country (ISO) |

## SellerPundit

| Var | Default | Purpose |
|-----|---------|---------|
| `SELLERPUNDIT_API_BASE_URL` | `https://authentication.sellerpundit.com/api/v1` | Login API base |
| `SELLERPUNDIT_MARKETPLACES_URL` | `https://marketplaces.sellerpundit.com` | Policies, tokens, publish API |
| `SELLERPUNDIT_EMAIL` | — | **Secret.** Fallback login email |
| `SELLERPUNDIT_PASSWORD` | — | **Secret.** Fallback login password |
| `SELLERPUNDIT_ENVIRONMENT` | `production` | Stored on imported accounts |
| `SELLERPUNDIT_DEFAULT_MARKETPLACE_ID` | `EBAY_MOTORS_US` | Default marketplace |
| `SELLERPUNDIT_POLICY_SYNC_MAX_AGE_HOURS` | `24` | TTL before re-sync |
| `SELLERPUNDIT_PUBLISH_FALLBACK` | `auto` | `auto` / `direct_ebay` / `sellerpundit` |

## AWS S3

| Var | Default | Purpose |
|-----|---------|---------|
| `AWS_S3_BUCKET` | `solarrisebackupbucket` | Bucket |
| `AWS_S3_PREFIX` | `mhn/` | Key prefix |
| `AWS_S3_REGION` | `us-east-1` | Region |
| `AWS_ACCESS_KEY_ID` | — | **Secret** |
| `AWS_SECRET_ACCESS_KEY` | — | **Secret** |
| `S3_BUCKET` / `S3_PREFIX` / `S3_REGION` | — | Legacy aliases |

## Node / Runtime

| Var | Default | Purpose |
|-----|---------|---------|
| `NODE_ENV` | `production` (Docker) | Env mode; gates Swagger |
| `NODE_OPTIONS` | `--max-old-space-size=1536` (t3.medium) | V8 heap; raise on larger instances |
| `IGNORE_ENV_FILE` | `true` (Docker) | Ignore host `.env` in container |
| `PIPELINE_PROJECT_ROOT` | `/app` | Root for pipeline scripts/output |
| `PIPELINE_AI_CONCURRENCY` | `3` (t3.medium) | Max parallel OpenRouter enrichment batches |
| `PIPELINE_AI_BATCH_SIZE` | `6` (t3.medium) | Parts per AI batch |
| `PIPELINE_LOCALIZATION_CONCURRENCY` | `3` | Parallel AU/DE localization |
| `PIPELINE_IMAGE_CONCURRENCY` | `3` | Parallel image-enrichment batches |
| `PIPELINE_CATEGORY_CONCURRENCY` | `2` | Parallel eBay taxonomy lookups |
| `PIPELINE_VIN_BATCH_CONCURRENCY` | `3` | Parallel NHTSA VIN decode batches |
| `PIPELINE_IMAGE_SKU_CONCURRENCY` | `2` | S3 image mirror per SKU |
| `CATALOG_IMPORT_EBAY_BROWSE_CONCURRENCY` | `2` | eBay browse during CSV import |
| `CATALOG_IMPORT_IMAGE_SKU_CONCURRENCY` | `2` | Image mirror during CSV import |

## Frontend (Vite)

| Var | Purpose |
|-----|---------|
| `VITE_INGESTION_PROVIDER` | `mock` (default) or `api` |
| `VITE_INGESTION_API_BASE_URL` | Required when provider is `api` |
| `VITE_INGESTION_HEALTH_PATH` | Optional health path |

> When adding a new env var: add it to `.env.example`, wire it in `docker-compose.yml` if containerized, and document it here.

---

*Reorganized: 2026-06-06.*
