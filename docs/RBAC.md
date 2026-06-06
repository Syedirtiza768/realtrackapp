> ⚠️ LEGACY REFERENCE — Superseded by /docs/architecture/AUTH_RBAC.md. Preserved for historical context.

# RBAC & Authentication

## Architecture

- **JWT** bearer tokens (`Authorization: Bearer <token>`) via Passport.
- **Global guards**: `JwtAuthGuard` (authn) + `PermissionsGuard` (authz).
- **Public routes**: `@Public()` decorator (login, health, webhooks, OAuth callbacks, public branding).
- **Permission checks**: `@RequirePermissions('module.action')` on controllers.
- **Registry**: `backend/src/rbac/permission-registry.ts` — sync on startup when `RBAC_SYNC_PERMISSIONS=true`.

## Permission naming

`module.action` — e.g. `listings.view`, `client_settings.manage`.

## Adding a new permission

1. Add entry to `PERMISSION_REGISTRY` with `defaultRoles`.
2. Restart backend (or run `npm run migration:run` + sync).
3. Protect backend: `@RequirePermissions('your.permission')`.
4. Protect frontend route: `<ProtectedRoute permissions={['your.permission']}>`.
5. Hide UI: `<Can permission="your.permission">...</Can>`.

## Seed users (development)

Set passwords via environment variables (never commit):

- `DEFAULT_SUPER_ADMIN_EMAIL`, `DEFAULT_SUPER_ADMIN_PASSWORD`
- `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`
- `DEFAULT_MANAGER_EMAIL`, `DEFAULT_MANAGER_PASSWORD`
- `DEFAULT_STAFF_EMAIL`, `DEFAULT_STAFF_PASSWORD`
- `DEFAULT_VIEWER_EMAIL`, `DEFAULT_VIEWER_PASSWORD`

`SEED_DEMO_USERS=true` enables seeding outside production.

## Key endpoints

| Endpoint | Auth |
|----------|------|
| `POST /api/auth/login` | Public |
| `POST /api/auth/register` | Public |
| `GET /api/auth/me` | JWT |
| `GET /api/client-settings/branding` | Public |
| `GET /api/client-settings` | `client_settings.view` |
| `PATCH /api/client-settings` | `client_settings.manage` |
