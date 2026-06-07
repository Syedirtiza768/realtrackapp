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
| `DB_MIGRATIONS_RUN` | `true` | Run migrations on boot |
| `DB_POOL_MAX` / `DB_POOL_MIN` | `20` / `5` | Connection pool |
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
| `EBAY_DEFAULT_MERCHANT_LOCATION_KEY` | `default` | Key used when auto-provisioning an inventory location |
| `EBAY_DEFAULT_INVENTORY_ADDRESS_LINE1` | `Primary Warehouse` | Ship-from line 1 for auto-created locations |
| `EBAY_DEFAULT_INVENTORY_CITY` | `Houston` | Ship-from city |
| `EBAY_DEFAULT_INVENTORY_STATE` | `TX` | Ship-from state/province |
| `EBAY_DEFAULT_INVENTORY_POSTAL_CODE` | `77001` | Ship-from postal code |
| `EBAY_DEFAULT_INVENTORY_COUNTRY` | `US` | Ship-from country (ISO) |

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
| `NODE_OPTIONS` | `--max-old-space-size=8192` | V8 heap (large CSV imports) |
| `IGNORE_ENV_FILE` | `true` (Docker) | Ignore host `.env` in container |
| `PIPELINE_PROJECT_ROOT` | `/app` | Root for pipeline scripts/output |

## Frontend (Vite) — optional ingestion provider

| Var | Purpose |
|-----|---------|
| `VITE_INGESTION_PROVIDER` | `mock` (default) or `api` |
| `VITE_INGESTION_API_BASE_URL` | Required when provider is `api` |
| `VITE_INGESTION_HEALTH_PATH` | Optional health path |

> When adding a new env var: add it to `.env.example`, wire it in
> `docker-compose.yml` if containerized, and document it here.
