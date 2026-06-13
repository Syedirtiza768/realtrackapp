# Auth & RBAC

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

### System Roles (8)

| Slug | Name | Scope |
|------|------|-------|
| `super_admin` | Super Admin | Everything incl. client settings / white-label |
| `admin` | Admin | Broad ops, no branding controls |
| `manager` | Manager | Ops management across listings/orders/channels |
| `staff` | Staff | Day-to-day listing/catalog ops (default for new users) |
| `viewer` | Viewer | Read-only |
| `catalog_manager` | Catalog Manager | Catalog import + product mgmt |
| `listing_manager` | Listing Manager | Listing create/publish/sync |
| `ops_user` | Operations User | Orders/inventory/fulfillment |

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
| inventory | `inventory.view`, `inventory.adjust`, `inventory.allocate`, `inventory.reconcile` |
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
| feature_flags | `feature_flags.view`, `feature_flags.manage` |

> Full list: read `permission-registry.ts` (do not duplicate it here — it drifts).

### Default Role Assignments

| Permission Level | Default Roles |
|-----------------|---------------|
| `super_admin` only | `client_settings.*`, `roles.assign_permissions`, `feature_flags.manage` |
| `admin` and up | `users.*`, `catalog.clear`, `settings.manage`, `inventory.reconcile` |
| `manager` and up | `users.view`, `roles.view`, `ingestion.manage`, `pipeline.manage`, `catalog.import`, `inventory.adjust`, `orders.refund` |
| `read_write` | `listings.create`, `listings.update`, `catalog.update`, `orders.update`, `orders.ship` |
| `read_only` | All view permissions |

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

## Known Gaps

- No server-side token revocation/blacklist — logout is client-side only.
- No refresh-token rotation; JWT expiry config not asserted here (check `auth.module.ts` `JwtModule` registration).
- Row-level tenant/org isolation enforcement is inconsistent per prior audit.
- Some routes (e.g. `/settings/client`, `/settings/users` in `App.tsx`) lack an explicit `permissions` prop on the route element — verify the page-level guard covers them.

---

*Consolidated & reorganized: 2026-06-06. Updated: 2026-06-11.*
