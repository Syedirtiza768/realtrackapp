> ⚠️ MOVED → [/docs/architecture/AUTH_RBAC.md](AUTH_RBAC.md) (2026-06-06)

# Auth & RBAC

> This expands and supersedes the short `docs/RBAC.md`. Keep both in sync; this is
> the architecture-level reference.

## Authentication

- **Scheme**: JWT bearer tokens via Passport (`@nestjs/passport`, `passport-jwt`).
  Header `Authorization: Bearer <token>`.
- **Password hashing**: `bcrypt`, 12 salt rounds (`auth.service.ts`).
- **Token issue**: `JwtService.sign({ sub: userId, email, role })` on login/register.
- **Frontend storage**: JWT in `localStorage` key `mk_auth_token`
  (`src/lib/authApi.ts`). On HTTP 401 the client clears the token and redirects
  to `/login`.

### Login / session flow

1. `POST /api/auth/login` → `AuthService.validateAndSign` looks up active user by
   lowercased email, `bcrypt.compare`, updates `lastLoginAt`, signs JWT.
2. Client stores token; subsequent requests attach the bearer header
   (`fetchWithAuth`).
3. `GET /api/auth/me` returns the RBAC auth profile (effective permissions) +
   internal organizations.
4. `POST /api/auth/logout` is audit-only — the client discards the token (no
   server-side session/blacklist).
5. Registration (`POST /api/auth/register`) creates the user with legacy
   `role='user'`, ensures a default organization, and assigns the `staff` RBAC role.

## User model

`backend/src/auth/entities/user.entity.ts` (`users` table):
`id` (uuid), `email` (unique), `passwordHash` (`select:false`), `name`, `role`
(legacy enum: `super_admin|admin|manager|user|viewer`), `active`, `lastLoginAt`,
`createdAt`.

The legacy `role` column is bridged to RBAC slugs via `LEGACY_USER_ROLE_TO_SLUG`
in `permission-registry.ts`. Real authorization uses the RBAC tables, not this
column.

## RBAC model

Tables (rbac module): `Role`, `Permission`, `RolePermission`,
`UserRoleAssignment`. Plus internal `Organization` / `OrganizationMember` (auth).

- **Source of truth**: `backend/src/rbac/permission-registry.ts` —
  `PERMISSION_REGISTRY` (permission keys + default roles) and `ROLE_DEFINITIONS`.
- **Seeding**: `RbacSeedService.syncFromRegistry()` upserts roles/permissions
  (enabled via `RBAC_SYNC_PERMISSIONS=true` on startup; see `seed-rbac.ts`).

### Roles (8 system roles)

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

~90 keys named `module.action` (e.g. `listings.view`, `catalog.import`,
`ebay.publish`, `client_settings.manage`). Default-role buckets in the registry:
`READ_ONLY`, `READ_WRITE`, `MANAGER_UP`, `ADMIN_UP`, `SUPER_ADMIN_ONLY`,
`ALL_OPERATIONAL`. Client-settings + role management are **super-admin only**.

Full list: read `permission-registry.ts` (do not duplicate it here — it drifts).

## Enforcement

### Backend (global guards, in `app.module.ts`)

Order: `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`.

- `@Public()` (`auth/decorators/public.decorator.ts`) bypasses JWT — used for
  login, register, health, branding, OAuth callbacks, webhooks.
- `@RequirePermissions('module.action')` (controller or method) is checked by
  `rbac/guards/permissions.guard.ts`.
- `@CurrentUser()` injects the authenticated user.

### Frontend

- `src/components/auth/ProtectedRoute.tsx` gates routes via a `permissions` prop
  (see `App.tsx` route table).
- `src/lib/permissions.ts` + `hooks/usePermissions.ts` + a `<Can permission="…">`
  component hide UI elements.

## Protected / admin areas

- `/settings/users`, `/settings/permissions` — RBAC admin (`users.*`, `roles.*`).
- `/settings/client` — white-label, **super-admin only** (`client_settings.*`).
- eBay integration management — `ebay.manage` / `ebay.publish`.

## Known gaps (Needs verification)

- No server-side token revocation/blacklist — logout is client-side only.
- No refresh-token rotation; JWT expiry config not asserted here (check
  `auth.module.ts` `JwtModule` registration).
- Row-level tenant/org isolation enforcement is inconsistent per prior audit.
- Some routes (e.g. `/settings/client`, `/settings/users` in `App.tsx`) lack an
  explicit `permissions` prop on the route element — verify the page-level guard
  covers them.
