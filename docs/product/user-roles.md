# User Roles

Roles and permissions are defined in `backend/src/rbac/permission-registry.ts`
(source of truth) and enforced by the global `PermissionsGuard`. See
[/docs/architecture/auth-rbac.md](../architecture/auth-rbac.md) for the mechanism.

## System roles

| Slug | Name | Typical user | Capability summary |
|------|------|--------------|--------------------|
| `super_admin` | Super Admin | Platform owner | Everything, incl. white-label/client settings and role management |
| `admin` | Admin | Org administrator | Broad operational access; no branding controls |
| `manager` | Manager | Team lead | Manage listings, orders, channels, catalog import, inventory adjust |
| `staff` | Staff | Day-to-day operator | Create/update listings & catalog, publish; **default for new registrations** |
| `viewer` | Viewer | Read-only stakeholder | View-only across modules |
| `catalog_manager` | Catalog Manager | Catalog specialist | Catalog import + product management |
| `listing_manager` | Listing Manager | Listing specialist | Listing create/publish/channel sync |
| `ops_user` | Operations User | Fulfillment | Orders, inventory, fulfillment ops |

## Permission buckets (defaults)

The registry assigns each permission to role buckets:

- `READ_ONLY` — all operational roles + viewer (e.g. `*.view`)
- `READ_WRITE` — all operational roles, no viewer (create/update/publish)
- `MANAGER_UP` — super_admin, admin, manager (import, delete, manage)
- `ADMIN_UP` — super_admin, admin, manager (sensitive admin actions)
- `SUPER_ADMIN_ONLY` — client settings, role management, feature-flag manage

## Sensitive / restricted areas

| Area | Required permission | Roles |
|------|--------------------|-------|
| Client settings / white-label | `client_settings.*` | super_admin only |
| Role management / permission assignment | `roles.manage`, `roles.assign_permissions` | super_admin only |
| User management | `users.*` | manager+ (view), admin+ (mutate) |
| Catalog clear, inventory reconcile, order refund | `catalog.clear`, `inventory.reconcile`, `orders.refund` | admin+ |
| Feature-flag management | `feature_flags.manage` | super_admin only |

## Legacy role column

`users.role` (`super_admin|admin|manager|user|viewer`) is legacy; mapped to RBAC
slugs via `LEGACY_USER_ROLE_TO_SLUG`. Authorization decisions use the RBAC tables,
not this column. New registrations get legacy `user` + RBAC `staff`.

> The authoritative permission→role matrix is the registry file. Do not hand-copy
> it here; it drifts. Read `permission-registry.ts`.
