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
