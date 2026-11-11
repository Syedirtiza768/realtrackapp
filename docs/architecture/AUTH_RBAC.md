# Auth & RBAC

**MotoArk lifecycle (deployed 2026-11-03):** `motoark.orders.notify`
and `motoark.orders.view` allow scoped lifecycle submission/status/quantity
reads. `motoark.returns.receive` and `motoark.returns.restock` separately
authorize physical return processing. Registry defaults grant administrators
these permissions; migration `1791500000000` grants the existing external
reader role only notify/view. Production verification confirmed the external
reader has no physical return receive/restock authority. JWT, organization membership, Primemotive store
access, strict DTO validation, and a separate raw-body HMAC remain required.
See the [full contract](MOTOARK_ORDER_LIFECYCLE.md).

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **Source**: Consolidated from `docs/RBAC_AND_SECURITY.md` (374 lines) and `docs/architecture/auth-rbac.md` (106 lines) — 2026-05-29.
> For the security checklist and operational concerns, see [SECURITY.md](SECURITY.md).

---

## Authentication

### JWT Token Authentication

**Scheme**: Bearer token authentication via Passport JWT

```
Authorization: Bearer <jwt_token>
```

### Token Lifecycle

1. **Issuance**: On successful login/register via `AuthService.validateAndSign()`
2. **Storage**: Client stores in `localStorage` (key: `mk_auth_token`)
3. **Validation**: `JwtAuthGuard` validates on every request
4. **Expiry**: Configured in `auth.module.ts` (verify current setting)
5. **Logout**: Client-side only — token discarded, no server revocation

### Token Contents

```typescript
{ sub: userId, email: string, role: string }
```

### Password Security

- **Hashing**: bcrypt with 12 salt rounds
- **Storage**: `passwordHash` column with `select: false`
- **Comparison**: `bcrypt.compare()` in `AuthService.validateAndSign()`
- **Self-service change**: `PATCH /api/auth/change-password` — authenticated users change their own password (requires current password verification)
- **Admin reset**: `PATCH /api/rbac/users/:id/reset-password` — admin/super-admin resets any user's password (requires `users.reset_password` permission)
- **Audit**: Both operations log to `audit_logs` (`auth.password_changed`, `auth.admin_password_reset`)

### Login Flow

```
POST /api/auth/login
    ↓
Lowercase email lookup
    ↓
bcrypt.compare(password, hash)
    ↓
Update lastLoginAt
    ↓
Sign JWT
    ↓
Return { accessToken, user }
```

### Registration Flow

`POST /api/auth/register` creates user with legacy `role='user'`, ensures a default organization, assigns the `staff` RBAC role.

---

## User Model

`backend/src/auth/entities/user.entity.ts` (`users` table):
`id` (uuid), `email` (unique), `passwordHash` (`select:false`), `name`, `role` (legacy enum: `super_admin|admin|manager|user|viewer`), `active`, `lastLoginAt`, `createdAt`.

The legacy `role` column is bridged to RBAC slugs via `LEGACY_USER_ROLE_TO_SLUG` in `permission-registry.ts`. Real authorization uses the RBAC tables, not this column.

---

## RBAC Model

### Role-Based Access Control

```
User → UserRoleAssignment → Role → RolePermission → Permission
```

Tables (rbac module): `Role`, `Permission`, `RolePermission`, `UserRoleAssignment`. Plus internal `Organization` / `OrganizationMember` (auth).

- **Source of truth**: `backend/src/rbac/permission-registry.ts`
- **Seeding**: `RbacSeedService.syncFromRegistry()` upserts roles/permissions (enabled via `RBAC_SYNC_PERMISSIONS=true`)

### System Roles (10)

| Slug | Name | Scope |
|------|------|-------|
| `super_admin` | Super Admin | Everything incl. client settings / white-label |
| `admin` | Admin | Broad ops, no branding controls |
| `manager` | Manager | Ops management across listings/orders/channels |
| `staff` | Staff | Day-to-day listing/catalog ops (default for new users) |
| `supervisor` | Supervisor | Approve/publish listings, revise live listings |
| `viewer` | Viewer | Read-only **except** all publish perms are granted (see below) |
| `catalog_manager` | Catalog Manager | Catalog import + product mgmt |
| `listing_manager` | Listing Manager | Listing create/publish/sync |
| `ops_user` | Operations User | Orders/inventory/fulfillment |
| `listing_user` | Listing User | Upload sheets, verify data, edit drafts, publish to all stores |

> A non-system custom role `api_published_listings_reader` exists on some tenants for machine/API read-only access to the published-listings feed. It is intentionally excluded from publish permissions.

### Permissions

73 keys named `module.action` (e.g. `listings.view`, `catalog.import`, `ebay.publish`, `client_settings.manage`). Default-role buckets in the registry: `READ_ONLY`, `READ_WRITE`, `MANAGER_UP`, `ADMIN_UP`, `SUPER_ADMIN_ONLY`, `ALL_OPERATIONAL`.

### Permission Categories

| Module | Key Permissions |
|--------|----------------|
| auth | `auth.session` |
| users | `users.view`, `users.create`, `users.update`, `users.deactivate`, `users.reset_password` |
| roles | `roles.view`, `roles.manage`, `roles.assign_permissions`, `roles.assign` |
| client_settings | `client_settings.view`, `client_settings.manage`, `client_settings.branding`, `client_settings.theme`, `client_settings.whitelabel` |
| dashboard | `dashboard.view` |
| listings | `listings.view`, `listings.create`, `listings.update`, `listings.delete`, `listings.publish`, `listings.import`, `listings.export`, `listings.generate` |
| ai | `ai.routing.view`, `ai.routing.manage` |
| ingestion | `ingestion.view`, `ingestion.create`, `ingestion.manage` |
| pipeline | `pipeline.view`, `pipeline.run`, `pipeline.manage`, `pipeline.review`, `pipeline.export` |
| catalog | `catalog.view`, `catalog.update`, `catalog.import`, `catalog.clear`, `catalog.export`, `catalog.compliance` |
| inventory | `inventory.view`, `inventory.enrich`, `inventory.delete`, `inventory.adjust`, `inventory.allocate`, `inventory.reconcile` |
| orders | `orders.view`, `orders.update`, `orders.ship`, `orders.refund`, `orders.import` |
| channels | `channels.view`, `channels.connect`, `channels.publish`, `channels.sync`, `channels.manage` |
| stores | `stores.view`, `stores.manage` |
| ebay | `ebay.view`, `ebay.connect`, `ebay.sync`, `ebay.publish`, `ebay.manage`, `ebay.audit` |
| settings | `settings.view`, `settings.manage` |
| automation | `automation.view`, `automation.manage` |
| templates | `templates.view`, `templates.manage` |
| notifications | `notifications.view`, `notifications.manage` |
| audit | `audit.view` |
| motors | `motors.view`, `motors.manage`, `motors.review` |
| fitment | `fitment.view`, `fitment.manage` |
| storage | `storage.view`, `storage.upload`, `storage.manage` |
| pricing | `pricing.view`, `pricing.manage` |
| published_listings | `published_listings.view`, `published_listings.export`, `published_listings.external_feed`, `published_listings.sales.notify`, `published_listings.sync`, `published_listings.manage`, `published_listings.bulk` |
| feature_flags | `feature_flags.view`, `feature_flags.manage` |

> Full list: read `permission-registry.ts` (do not duplicate it here — it drifts).

### Vertical pilot authorization

Vertical endpoints reuse existing permissions: `catalog.view`/`catalog.update`
for profiles, category metadata, families, and variants; `settings.view` and
`settings.manage` for per-store configuration; and `ebay.publish` for variant
mappings and family publishing. The separate `multi_vertical_catalog` feature
flag is disabled by default and is an additional rollout gate, not a new RBAC
permission.

### Default Role Assignments

| Permission Level | Default Roles |
|-----------------|---------------|
| `super_admin` only | `client_settings.*`, `roles.assign_permissions`, `feature_flags.manage` |
| `admin` and up | `users.*`, `catalog.clear`, `settings.manage`, `inventory.reconcile` |
| `super_admin` + `admin` (default) | `listings.delete`, `inventory.delete` — soft-delete; reassignable via Roles UI |
| `manager` and up | `users.view`, `roles.view`, `ingestion.manage`, `pipeline.manage`, `catalog.import`, `inventory.adjust`, `orders.refund` |
| `read_write` | `listings.create`, `listings.update`, `catalog.update`, `orders.update`, `orders.ship` |
| `read_only` | All view permissions |
| `read_only` (all human roles) | **All publish permissions** — see [Publish policy](#publish-policy) below |

### Publish policy

> **Policy (2026-08-08):** Every human system role may publish listings to every store. The following permissions default to `READ_ONLY` (all 10 human roles): `listings.publish`, `listings.approve`, `listings.revise`, `channels.publish`, `ebay.publish`, `published_listings.export`, `published_listings.sync`, `published_listings.manage`, `published_listings.bulk`. Only `listings.delete` and `listings.price_override` remain restricted (admin/manager up). The machine role `api_published_listings_reader` is excluded.

Two gates must both be satisfied for a user to publish **all** listings to **all** stores:

1. **Permission gate** — the user's role grants the publish permissions above (checked live per request by `PermissionsGuard` via `RbacService.getPermissionKeysForUser`).
2. **Store-access gate** — `users.store_access_all`. When `true`, `StoreAccessService` short-circuits all store filters (`resolveStoreFilter` returns `undefined` = all stores) and `assertStoreAccess` passes for any store. When `false`, the user only sees/publishes to stores in `user_store_assignments`.

To grant a user all-store access without per-store assignments, set `store_access_all = true` (toggle via `POST /api/store-access/access-all/:userId` with `stores.access_all_manage`, or directly in the `users` table). On the US production instance all active users were set to `store_access_all = true` on 2026-08-08.

### Pipeline upload policy

> **Policy (2026-08-08):** Every human system role can upload files to the enrichment pipeline and receive output listings. `pipeline.run` (gates `POST /api/pipeline/upload` and `POST /api/pipeline/single`) defaults to `READ_ONLY` — all 10 human roles. `pipeline.view` and `pipeline.export` are already `READ_ONLY`. Pipeline job visibility in `GET /api/pipeline/jobs` is filtered to a user's own jobs unless they hold `users.view` (manager-and-up), but a user who uploads a file always sees their own job and can download its output templates (`us`/`uk`/`au`/`de`/`report`). The pipeline processor imports results into `catalog_products` + `listing_records` as a background job (no per-request permission check); those imported listings are then visible to the uploader via `listings.view` (READ_ONLY) with the store filter bypassed by `store_access_all`.

> **Customized roles caveat:** roles with `roles.is_customized = true` are skipped by `syncFromRegistry()` on boot. If a customized role (e.g. `staff`) is missing publish perms after a registry change, add them directly to `role_permissions` or reset the role to defaults.

The Primemotive external API permissions are not granted to human default roles.
Migration `1791200000000-PrimemotiveExternalApiPermissions` grants
`published_listings.external_feed` and `published_listings.sales.notify` only to the
`api_published_listings_reader` custom role when it exists.
Migration `1791300000000-PrimemotiveExportPermissionGrant` adds the existing
`published_listings.export` CSV permission to the same role. It does not grant
listing management or publishing permissions.

---

## Enforcement

### Backend (Global Guards, in `app.module.ts`)

Order: `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`.

- `@Public()` (`auth/decorators/public.decorator.ts`) bypasses JWT — used for login, register, health, branding, OAuth callbacks.
- `@RequirePermissions('module.action')` (controller or method) is checked by `rbac/guards/permissions.guard.ts`.
- `@CurrentUser()` injects the authenticated user.

### Frontend

- `src/components/auth/ProtectedRoute.tsx` gates routes via a `permissions` prop (see `App.tsx` route table).
- `src/lib/permissions.ts` + `hooks/usePermissions.ts` + a `<Can permission="…">` component hide UI elements.

### Protected / Admin Areas

- `/settings/users`, `/settings/permissions` — RBAC admin (`users.*`, `roles.*`).
- `/settings/client` — white-label, **super-admin only** (`client_settings.*`).
- eBay integration management — `ebay.manage` / `ebay.publish`.

---

## Decorators

| Decorator | Location | Purpose |
|-----------|----------|---------|
| `@Public()` | `auth/decorators/public.decorator.ts` | Skip auth |
| `@CurrentUser()` | `auth/decorators/current-user.decorator.ts` | Inject user |
| `@RequirePermissions(...)` | `rbac/decorators/require-permissions.decorator.ts` | Require permissions |

### @Public() Usage

Used for: `/api/health`, `/api/auth/login`, `/api/auth/register`, `/api/integrations/ebay/callback`, `/api/client-settings/branding/public`.

### @RequirePermissions(...) Usage

```typescript
@RequirePermissions('listings.create')
@Post()
create() { }

@RequirePermissions('listings.update', 'listings.delete')
@Put(':id')
update() { }
```

---

## Frontend Permission Usage

```typescript
// Hook
const { can, permissions } = usePermissions();
if (can('listings.delete')) { /* show delete button */ }

// Component
<Can permission="listings.delete">
  <DeleteButton />
</Can>

// Route
<ProtectedRoute permissions={['listings.create']}>
  <ListingEditor />
</ProtectedRoute>
```

Permissions returned from `GET /api/auth/me`.

---

## Current session and automotive isolation controls (2026-09-11)

- New access tokens include a `jti`. Logout stores that session ID in Redis until
  token expiry, and `JwtStrategy` rejects revoked sessions. Tokens issued before
  this rollout have no `jti` and expire normally.
- Query-string JWTs are rejected globally except for the authenticated Motors
  product-progress SSE route required by native `EventSource`.
- Dedicated login requests validate `automotive` (`dashboard.view`), `fashion`
  (`fashion.access`), or `business_industrial`
  (`business_industrial.access`) before issuing a token.
- Generic Auto Parts catalog and listing APIs apply organization, automotive
  vertical, store, and team boundaries on the server. Pre-tenancy NULL rows are
  visible only to members of `LEGACY_AUTOMOTIVE_ORGANIZATION_ID`; new rows are
  tagged with the resolved organization and `vertical=automotive`.

Refresh-token rotation is not implemented; access tokens remain bounded by
`JWT_EXPIRY_SECONDS`.

---

*Consolidated & reorganized: 2026-06-06. Updated: 2026-08-19.*

## Fashion workspace authorization (2026-09-09)

Fashion has an explicit login at /fashion/login and uses the same JWT/RBAC infrastructure with a separate permission namespace. The registry defines fashion.access, dashboard/listing/import/review/publish/store/user/role/settings/authenticity/incident permissions and the system roles fashion_admin, fashion_manager, and fashion_operator. Fashion roles do not inherit the legacy organization-wide publish permissions.

The Fashion login rejects authenticated credentials unless the user has fashion.access. Fashion controllers enforce the same permission boundary server-side; the client route is not a security boundary. The Fashion user-management endpoints can list workspace members and assign only the three Fashion roles. Existing users do not receive Fashion access automatically.

The seed command is backend npm run seed:fashion-admin. It requires FASHION_SEED_ADMIN_EMAIL and FASHION_SEED_ADMIN_PASSWORD, creates only a missing user/workspace, never resets an existing password, and refuses to expand an existing non-Fashion account.

## Business & Industrial workspace authorization (2026-09-09)

The B&I route tree uses `business_industrial.access` plus specific permissions
for listings, import, review, private evidence, publish, stores, incidents,
and users. The registry defines `business_industrial_admin`,
`business_industrial_manager`, and `business_industrial_operator`; these
vertical roles are excluded from the legacy all-users publish permission grant.
Existing users do not receive B&I access automatically.

The backend resolves every request through the user’s organization membership.
Store access is further restricted to eBay stores whose config explicitly says
`ownerVertical: business_industrial`; OAuth rejects a seller account already
connected in the organization, preventing reuse across verticals. The B&I
login sends an explicit vertical assertion and the backend validates the
matching permission before issuing a token. The B&I admin UI creates
organization-scoped accounts with temporary-password enforcement, supports
role assignment/deactivation, and replaces dedicated-store assignments
transactionally. Account, policy, category, job, and publication APIs use the
same `BusinessIndustrialService` authorization rule. Users with
`business_industrial.stores.manage` may administer every dedicated B&I store in
their organization; other users remain limited by explicit store assignments
and access level. No cross-vertical store access is granted.

The shared public eBay OAuth callback uses the vertical saved in OAuth state
when choosing its success destination. A B&I connection returns to
`/business-industrial/stores`; the general `/settings/integrations/ebay` page
requires `ebay.view` and is not an authorized fallback for B&I-only roles.

A public invitation acceptance flow remains outside this change.

The seed command is `backend` npm run `seed:business-industrial-admin`. It
requires `BUSINESS_INDUSTRIAL_SEED_ADMIN_EMAIL` and
`BUSINESS_INDUSTRIAL_SEED_ADMIN_PASSWORD`, never resets an existing password,
and refuses to expand an existing account without an explicit B&I role.

## Shared catalog action permissions (2026-09-12)

Catalog reads use the existing vertical listing-view permissions. The shared
workspace adds `fashion.catalog.export`, `fashion.catalog.delete`,
`fashion.catalog.assign_team`, and `fashion.catalog.manage_policies`, with
parallel `business_industrial.catalog.*` permissions. Export is available to
all vertical roles; team assignment and policy changes are manager/admin
actions; delete is admin-only. Every controller method declares both the
vertical access permission and the operation permission, while the service
re-checks organization membership, vertical, team scope, and store scope.
Quarantine/manual-review holds are enforced independently of UI permissions.

## Warehouse stock permissions (2026-10-05)

Twelve `stock.*` keys are registered in `permission-registry.ts` (module `stock`). They are granted to the Auto Parts role groups and to the Fashion and B&I roles, so all three workspaces share one stock system. The defaults are:
- **view:** read roles and all vertical roles;
- **receive/move/count/fulfil:** read-write roles and all vertical roles;
- **adjust, adjust.approve, procure, valuation.view, serials.private:** managers (including vertical managers);
- **warehouses.manage, channel_sync.manage:** admins (including vertical admins).

The sidebar module key `stock` maps to `stock.view`.

Users are scoped per warehouse through `user_warehouse_assignments`: no rows means all warehouses, and any rows restrict the user to those warehouses. Adjustments and count variances above `STOCK_ADJUST_APPROVAL_QTY` units need `stock.adjust.approve`. See [WAREHOUSE_INVENTORY.md](WAREHOUSE_INVENTORY.md#8-rbac).
