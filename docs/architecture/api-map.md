> ⚠️ MOVED → [/docs/architecture/API_CONTRACTS.md](API_CONTRACTS.md) (2026-06-06)

# API Map

All routes are served under the **global prefix `/api`** (`app.setGlobalPrefix('api')`
in `backend/src/main.ts`). Swagger UI: `GET /api/docs` (non-production only).

Auth model: every route is protected by global `JwtAuthGuard` + `PermissionsGuard`
unless marked `@Public()`. Controller-level `@RequirePermissions('module.action')`
sets the default; method-level decorators can override. See
[auth-rbac.md](auth-rbac.md).

> This map is generated from `@Controller(...)` prefixes and per-module
> permission decorators. Request/response shapes live in each module's `dto/`
> folder and entities — consult those for exact fields. Mark anything uncertain
> "Needs verification".

## ⚠️ Double-prefix caveat (Needs verification)

Three controllers declare a path that already includes `api/`, which combines with
the global prefix to produce `/api/api/...`:

| Controller | Declared | Effective path |
|-----------|----------|----------------|
| `common/feature-flags/feature-flag.controller.ts` | `@Controller('api/feature-flags')` | `/api/api/feature-flags` |
| `listings/export-rule.controller.ts` | `@Controller('api/export-rules')` | `/api/api/export-rules` |

Confirm whether frontend clients call `/api/api/...` or whether these should be
fixed to drop the `api/` segment. Do **not** "fix" without checking the matching
`src/lib/*Api.ts` client first.

## Controller → route prefix → auth

| Module | Controller | Base path (`/api/…`) | Default permission |
|--------|-----------|----------------------|--------------------|
| app | `app.controller.ts` | `/` | (root) |
| health | `health.controller.ts` | `/health` | `@Public()` |
| auth | `auth.controller.ts` | `/auth` | Public: `login`, `register`; JWT: `me`, `logout`, `organizations` |
| rbac | `rbac-admin.controller.ts` | `/rbac` | roles/users perms (see registry) |
| client-settings | `client-settings.controller.ts` | `/client-settings` | `branding` public; rest `client_settings.*` |
| listings | `listings.controller.ts` | `/listings` | `listings.*` |
| listings (v2) | `listings-v2.controller.ts` | `/v2/listings` | cached (RedisCacheInterceptor) |
| listings (gen) | `listing-generation.controller.ts` | `/listings` | `listings.generate` |
| listings (export) | `export-rule.controller.ts` | `/api/export-rules` ⚠️ | `listings.export` |
| ingestion | `ingestion.controller.ts` | `/ingestion` | `ingestion.*` |
| ingestion (pipeline) | `pipeline.controller.ts` | `/pipeline` | `pipeline.*` |
| ingestion (images) | `image-enrichment.controller.ts` | `/pipeline/images` | `pipeline.run` |
| ingestion (review) | `review.controller.ts` | `/ingestion/review` | `pipeline.review` |
| catalog-import | `catalog-import.controller.ts` | `/catalog-import` | `catalog.view` |
| catalog-import | `catalog-product.controller.ts` | `/catalog-products` | `catalog.view` |
| catalog-import | `compliance.controller.ts` | `/catalog-import/compliance` | `catalog.compliance` |
| fitment | `fitment.controller.ts` | `/fitment` | `fitment.view` |
| motors | `motors-intelligence.controller.ts` | `/motors-intelligence` | `motors.view` |
| motors | `review-queue.controller.ts` | `/motors-intelligence/review` | `motors.review` |
| channels | `channels.controller.ts` | `/channels` | `channels.view` |
| channels | `stores.controller.ts` | `/stores` | `stores.view` |
| channels | `ai-enhancement.controller.ts` | `/ai-enhancements` | `listings.view` |
| openai | `ai-routing.controller.ts` | `/ai/routing` | `ai.routing.view` / `ai.routing.manage` |
| channels | `ebay-publish.controller.ts` | `/channels/ebay` | `ebay.publish` |
| integrations/ebay | `integrations-ebay.controller.ts` | `/integrations/ebay` | `ebay.view` |
| integrations/ebay | `ebay-multi-store.controller.ts` | `/ebay` | `ebay.view` |
| integrations/ebay/sellerpundit | `sellerpundit-ebay.controller.ts` | `/integrations/ebay/sellerpundit` | `ebay.view` / `ebay.manage` / `ebay.connect` |
| inventory | `inventory.controller.ts` | `/inventory` | `inventory.*` |
| orders | `orders.controller.ts` | `/orders` | `orders.*` |
| dashboard | `dashboard.controller.ts` | `/dashboard` | `dashboard.view` |
| dashboard (audit) | `dashboard.controller.ts` | `/audit-logs` | `audit.view` |
| pricing | `pricing-intelligence.controller.ts` | `/pricing` | `pricing.view` |
| settings | `settings.controller.ts` | `/settings` | `settings.*` |
| automation | `automation.controller.ts` | `/automation-rules` | `automation.view` |
| templates | `template.controller.ts` | `/templates` | `templates.view` |
| notifications | `notifications.controller.ts` | `/notifications` | `notifications.view` |
| storage | `storage.controller.ts` | `/storage` | `storage.view` |
| feature-flags | `feature-flag.controller.ts` | `/api/feature-flags` ⚠️ | `feature_flags.view` |

## Parts Search portal (2026-10-26)

`/api/parts-search/*` — read-only proxy over PartsBazar360 universal search for the `/parts-search` portal (`backend/src/parts-search/`). Every route requires `dashboard.view`, the Auto Parts workspace permission.

| Method | Path | Upstream on PartsBazar360 | Notes |
|---|---|---|---|
| GET | `/api/parts-search/query` | `/api/integrations/realtrack/search` when `PARTSBAZAR360_SEARCH_API_KEY` is set, otherwise `/api/v1/search` | Params mirror PartsBazar360's `SearchQueryDto` (`q` ≤ 200, `page` ≤ 400, `pageSize` ∈ 24/48/72, list filters ≤ 25 values, sent as repeated params). `seller`/`sourceTag` only reach the internal endpoint. `meta.audience` = `internal` or `public`; `meta.internalUnavailableReason` is set when internal search answered 401/403/404/503 and public search was used instead. 503 `{degraded:true}` on timeout or 5xx. Throttled 5/s, 120/min per user. |
| GET | `/api/parts-search/suggest?q=` | `/api/search/suggest` | Typeahead. Fewer than 2 chars or any upstream failure returns empty lists, never an error. Throttled 20/s, 400/min. |
| GET | `/api/parts-search/parts/:id` | `/api/integrations/realtrack/search/parts/:id` (keyed) or `/api/search/parts/:id` | Part detail. Internal view adds `internalOffers` (every offer, any status, with seller, store, source, SKU, base price, per-warehouse stock) and `sourceRecords`; since 2026-10-27 also `crossReferences` (number, role, source, verified), structured `fitments` + `fitmentCount`, `itemSpecifics`, `genuineOem` (passed through unchanged). 404 passes PartsBazar360's reason through. |
| GET | `/api/parts-search/status` | `/api/v1/search` probe + internal `/health` | Upstream reachable, index name, whether the internal key works. |
| GET | `/api/parts-search/options` | `/api/integrations/realtrack/search/options` (key required) | "Every sellable option" (2026-10-27). Params: `q`, vehicle (`vehicleConfigId` / `makeId`+`modelId`+`year` / `make`+`model`+`year`, `engineLitres`), `drop`, `includeUnavailable`, `page`, `pageSize`. Groups by relation (number queries) or fitment verdict (text), with live availability. Omni Core automotive warehouse stock is merged by normalized MPN/OEM number (scoped to the user's organizations) as an "In our warehouse" group plus badges. Not-available parts are hidden after the merge unless `includeUnavailable`. Every call is logged to `parts_search_events`. 503 `INTERNAL_SEARCH_UNAVAILABLE` without the key (the SPA then shows the buyer view). |
| POST | `/api/parts-search/events/select` | — | `{query, partId, requestRef?, action}`: audit of what staff opened, copied or followed. |
| POST | `/api/parts-search/requests` | — | Sourcing request `{query, numbers?, vehicle?, partId?, note?}` → `parts_search_events` (type `request`, status `open`). |
| PATCH | `/api/parts-search/requests/:id` | — | `{status: open / done / dismissed}`. |
| GET | `/api/parts-search/demand?days=7` | — | Searched-but-unsellable report: totals, top numbers, top queries, top vehicles, requests. |
| GET | `/api/parts-search/vehicles/{makes, makes/:id/models, models/:id/generations, generations/:id/configurations}` | `/api/vehicles/...` (public) | Vehicle picker; cached 1 h in Redis. |
| GET | `/api/parts-search/vin/:vin` | NHTSA vPIC `DecodeVinValues` | `{year, make, model, trim, engineLitres}`; cached 30 days; 17-char VIN check. |
| GET | `/api/parts-search/parts/:id/images` | `…/search/parts/:id` (internal or public) | High-quality previews `[{index, previewUrl, filename, origin}]`: our S3 originals via `/api/storage/serve/<original key>` (never responsive variants), eBay upgraded to the 1600 px rendition, others as stored. |
| GET | `/api/parts-search/parts/:id/images/:index/download` | image host | One image as an attachment (`<brand>-<mpn>-<n>.<ext>`), best quality: our private bucket read through `StorageService`, eBay `s-l1600`/`$_57` (falls back to the stored size on 404), other hosts fetched server-side. |
| GET | `/api/parts-search/parts/:id/images/zip` | image hosts | All images (≤ 30) as a zip; failures listed in `MISSING.txt`. |
| GET | `/api/parts-search/omni/:itemId/image/download` | our bucket / image host | Image of an Omni Core warehouse item ("In our warehouse"), scoped to the caller's organizations. |


Responses are cached in Redis for `PARTS_SEARCH_CACHE_TTL_SECONDS` (default 30 s; part detail ≥ 120 s), keyed separately for internal and public. Degraded answers are never cached.

## Warehouse stock (2026-10-05)

`/api/stock/*` — warehouses, bins, SKU stock, documents, procurement and purchase orders, order stock, and channel quantity sync. The full table is in [API_CONTRACTS.md](API_CONTRACTS.md#warehouse-stock-apistock) and the design is in [WAREHOUSE_INVENTORY.md](WAREHOUSE_INVENTORY.md). This is distinct from `/api/inventory/*` (the Auto Parts enrichment workbench).

## Auth endpoints (detail)

| Method | Path | Handler | Auth | Purpose |
|--------|------|---------|------|---------|
| POST | `/api/auth/login` | `AuthController.login` | Public | Email+password → `{ accessToken, user }` |
| POST | `/api/auth/register` | `AuthController.register` | Public | Create user (assigned `staff` role + default org) |
| GET | `/api/auth/me` | `AuthController.me` | JWT | Current user profile + permissions + organizations |
| POST | `/api/auth/logout` | `AuthController.logout` | JWT | Audit log only (client discards token) |
| GET | `/api/auth/organizations` | `AuthController.listOrganizations` | JWT | Internal RealTrack workspaces (not eBay) |

Frontend usage: `src/lib/authApi.ts` (token storage), `src/components/auth/*`.

## Realtime

- Socket.IO gateway on the `notifications` namespace (`@nestjs/websockets` +
  `@nestjs/platform-socket.io`). See `backend/src/notifications/`.

## How to extend safely

1. Add the controller under the owning module; rely on the global `/api` prefix
   (do **not** prefix with `api/`).
2. Add a `@RequirePermissions('module.action')` and register the permission in
   `rbac/permission-registry.ts` (see [auth-rbac.md](auth-rbac.md)).
3. Add/extend DTOs with `class-validator` decorators (global ValidationPipe is strict).
4. Add the matching client in `src/lib/<domain>Api.ts`.
5. Update this file and the [task-completion-checklist](../development/task-completion-checklist.md).
