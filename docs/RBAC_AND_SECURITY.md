> ⚠️ MOVED → [/docs/architecture/AUTH_RBAC.md](architecture/AUTH_RBAC.md) (auth) and [/docs/architecture/SECURITY.md](architecture/SECURITY.md) (security) (2026-06-06)

# RBAC and Security

> Authentication, authorization, and security model for RealTrackApp.
> For implementation details, see `backend/src/auth/` and `backend/src/rbac/`.

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
{
  sub: userId,      // User UUID
  email: string,    // User email
  role: string      // Legacy role (for backward compat)
}
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

---

## Authorization (RBAC)

### Role-Based Access Control Model

```
User → UserRoleAssignment → Role → RolePermission → Permission
```

### System Roles (8)

| Slug | Name | Description | Scope |
|------|------|-------------|-------|
| `super_admin` | Super Admin | Full system access | Everything |
| `admin` | Admin | Broad operational access | No client settings |
| `manager` | Manager | Operations management | Listings/orders/channels |
| `staff` | Staff | Day-to-day operations | Default for new users |
| `viewer` | Viewer | Read-only access | View everything |
| `catalog_manager` | Catalog Manager | Catalog focus | Import + products |
| `listing_manager` | Listing Manager | Listing focus | Create/publish/sync |
| `ops_user` | Operations User | Orders/inventory | Fulfillment |

### Permission Naming Convention

```
module.action
```

Examples:
- `listings.view`, `listings.create`, `listings.update`, `listings.delete`
- `catalog.import`, `catalog.compliance`
- `ebay.publish`, `ebay.manage`
- `users.create`, `roles.manage`

### Permission Categories (~90 total)

| Module | Permissions |
|--------|-------------|
| auth | `auth.session` |
| users | `users.view`, `users.create`, `users.update`, `users.deactivate`, `users.reset_password` |
| roles | `roles.view`, `roles.manage`, `roles.assign_permissions`, `roles.assign` |
| client_settings | `client_settings.view`, `client_settings.manage`, `client_settings.branding`, `client_settings.theme`, `client_settings.whitelabel` |
| dashboard | `dashboard.view` |
| listings | `listings.view`, `listings.create`, `listings.update`, `listings.delete`, `listings.publish`, `listings.import`, `listings.export`, `listings.generate` |
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

### Default Role Assignments

| Permission | Default Roles |
|------------|---------------|
| `super_admin` only | `client_settings.*`, `roles.assign_permissions`, `feature_flags.manage` |
| `admin` and up | `users.*`, `catalog.clear`, `settings.manage`, `inventory.reconcile` |
| `manager` and up | `users.view`, `roles.view`, `ingestion.manage`, `pipeline.manage`, `catalog.import`, `inventory.adjust`, `orders.refund` |
| `read_write` | `listings.create`, `listings.update`, `catalog.update`, `orders.update`, `orders.ship` |
| `read_only` | All view permissions |

### Source of Truth

**File**: `backend/src/rbac/permission-registry.ts`

```typescript
export const PERMISSION_REGISTRY: PermissionDefinition[] = [
  // All permissions defined here
];

export const ROLE_DEFINITIONS = [
  // All roles defined here
];
```

**Seeding**: `RbacSeedService.syncFromRegistry()` upserts roles/permissions on startup when `RBAC_SYNC_PERMISSIONS=true`.

---

## Guard Stack

Applied in order in `app.module.ts`:

### 1. ThrottlerGuard

```typescript
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000, limit: 10 },      // 10/sec
  { name: 'medium', ttl: 60000, limit: 100 },   // 100/min
  { name: 'long', ttl: 3600000, limit: 1000 },  // 1000/hr
])
```

### 2. JwtAuthGuard

- Validates JWT token from `Authorization` header
- Skipped with `@Public()` decorator
- Attaches user to request

### 3. PermissionsGuard

- Checks `@RequirePermissions()` decorator
- Validates user has required permission
- Returns 403 if unauthorized

---

## Decorators

### @Public()

Skip authentication for endpoint:

```typescript
@Public()
@Get('health')
health() { }
```

**Used for**:
- `/api/health`
- `/api/auth/login`
- `/api/auth/register`
- `/api/integrations/ebay/callback`
- `/api/client-settings/branding/public`

### @RequirePermissions(...)

Require specific permissions:

```typescript
@RequirePermissions('listings.create')
@Post()
create() { }

@RequirePermissions('listings.update', 'listings.delete')
@Put(':id')
update() { }
```

### @CurrentUser()

Inject authenticated user:

```typescript
@Get('me')
me(@CurrentUser() user: User) {
  return user;
}
```

---

## Frontend RBAC

### Permission Checking

**Hook**: `usePermissions.ts`

```typescript
const { can, permissions } = usePermissions();

if (can('listings.delete')) {
  // Show delete button
}
```

**Component**: `<Can>`

```tsx
<Can permission="listings.delete">
  <DeleteButton />
</Can>
```

**Route Protection**: `ProtectedRoute.tsx`

```tsx
<ProtectedRoute permissions={['listings.create']}>
  <ListingEditor />
</ProtectedRoute>
```

### Permission Storage

Permissions returned from `GET /api/auth/me`:

```typescript
{
  user: { id, email, name, role },
  permissions: ['listings.view', 'listings.create', ...],
  organizations: [...]
}
```

---

## Security Best Practices

### Environment Variables

| Variable | Security Level | Notes |
|----------|---------------|-------|
| `JWT_SECRET` | Critical | Strong random string, never commit |
| `DB_PASSWORD` | Critical | Change from default `postgres` |
| `REDIS_PASSWORD` | High | If set, used for auth |
| `EBAY_CLIENT_SECRET` | Critical | eBay API secret |
| `EBAY_DEV_ID` | Critical | eBay developer ID |
| `OPENAI_API_KEY` | High | OpenAI API access |
| `AWS_SECRET_ACCESS_KEY` | Critical | S3 access |

### CORS Configuration

```typescript
// From CORS_ORIGIN env var or defaults
defaultCorsOrigins = [
  'http://localhost:3911',    // Vite dev
  'http://localhost:8050',    // Docker frontend
  'https://mhn.realtrackapp.com',
  'http://mhn.realtrackapp.com',
];
```

### Input Validation

Global `ValidationPipe`:

```typescript
new ValidationPipe({
  whitelist: true,              // Strip unknown properties
  forbidNonWhitelisted: true,   // Error on unknown properties
  transform: true,              // Auto-transform types
  transformOptions: { enableImplicitConversion: true },
})
```

### Rate Limiting

- 10 requests/second
- 100 requests/minute
- 1000 requests/hour

Applied globally via `ThrottlerGuard`.

---

## Known Security Gaps

### R9: No JWT Revocation

- **Issue**: No server-side token blacklist
- **Impact**: Tokens remain valid until expiry even after logout
- **Mitigation**: Short token expiry, implement refresh token rotation

### R8: Weak Tenant Isolation

- **Issue**: Row-level org scoping inconsistent
- **Impact**: Potential data leakage between organizations
- **Mitigation**: Audit all queries for org filtering

### R3: Default Credentials

- **Issue**: `.env.example` has defaults like `postgres/postgres`
- **Impact**: Production deployments may use weak credentials
- **Mitigation**: Enforce strong secrets in production checklist

### R10: eBay OAuth Fragility

- **Issue**: Token refresh against live eBay API can fail
- **Impact**: Integration disruption
- **Mitigation**: Monitor `EbayApiError` logs, implement retry logic

---

## Security Checklist (Pre-Deploy)

- [ ] Change `JWT_SECRET` from default/placeholder
- [ ] Change `DB_PASSWORD` from `postgres`
- [ ] Set `REDIS_PASSWORD` if Redis exposed
- [ ] Verify `EBAY_ENVIRONMENT` is `PRODUCTION` (not `SANDBOX`)
- [ ] Set strong eBay credentials
- [ ] Set `NODE_ENV=production` (disables Swagger)
- [ ] Verify `DB_SYNCHRONIZE=false`
- [ ] Review CORS origins
- [ ] Enable Redis password if external access
- [ ] Verify S3 bucket permissions

See `/docs/operations/security-checklist.md` for full checklist.

---

## Related Documentation

- **Permission Registry**: `backend/src/rbac/permission-registry.ts`
- **Auth Implementation**: `backend/src/auth/`
- **RBAC Implementation**: `backend/src/rbac/`
- **API Map**: `/docs/API_MAP.md`
- **Security Checklist**: `/docs/operations/security-checklist.md`
- **Risk Register**: `/docs/handover/risk-register.md`

---

*Last updated: 2026-05-29*
