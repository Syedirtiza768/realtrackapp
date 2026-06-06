# Security

> **Source**: Consolidated from `docs/operations/security-checklist.md` (60 lines) and security sections of `docs/RBAC_AND_SECURITY.md` — 2026-05-29.
> For the auth/RBAC architecture, see [AUTH_RBAC.md](AUTH_RBAC.md).
> For known risks, see [/docs/context/KNOWN_ISSUES.md](../context/KNOWN_ISSUES.md).

---

## Security Model

### Authentication

- JWT Bearer tokens via Passport JWT
- Passwords hashed with bcrypt (12 salt rounds)
- Global `JwtAuthGuard` protects all routes; `@Public()` opts out
- Frontend stores JWT in `localStorage` (`mk_auth_token`)

### Authorization

- RBAC with 8 roles and ~90 permissions (`module.action` format)
- Global `PermissionsGuard` enforces `@RequirePermissions()` decorators
- Source of truth: `backend/src/rbac/permission-registry.ts`
- Super-admin-only features: client settings, role management, feature-flag management

### Rate Limiting

`ThrottlerGuard`: 10/s, 100/min, 1000/hr per client — applied globally.

### Input Validation

Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). DTOs use `class-validator`. Raw body preserved for webhook HMAC verification.

### CORS

Configured from `CORS_ORIGIN` (comma-separated) or built-in defaults:
- `http://localhost:3911` (Vite dev)
- `http://localhost:8050` (Docker frontend)
- `https://mhn.realtrackapp.com`
- `http://mhn.realtrackapp.com`

### Password Security

- bcrypt with 12 salt rounds
- `passwordHash` column with `select: false` (never returned in queries)
- `bcrypt.compare()` for verification

---

## Pre-Deploy Security Checklist

Run before every production deployment.

### Secrets & Config

- [ ] `JWT_SECRET` is a strong random value, unique per environment, not the placeholder. Rotating it invalidates all existing tokens.
- [ ] DB credentials changed from defaults (`postgres/postgres`).
- [ ] `REDIS_PASSWORD` set if Redis is network-reachable.
- [ ] `OPENAI_API_KEY`, eBay creds, AWS keys provided via env/secret store — never committed. `.env` is gitignored.
- [ ] No secret values pasted into docs, logs, or commit messages.

### Database

- [ ] `DB_SYNCHRONIZE=false` (schema only via reviewed migrations).
- [ ] Postgres not exposed publicly (bind to internal network / firewall the external port).
- [ ] Backups taken before risky migrations.

### AuthN / AuthZ

- [ ] Global guard stack intact: `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard` (`app.module.ts`).
- [ ] New endpoints carry `@RequirePermissions(...)`; `@Public()` used only where intended (login, register, health, branding, OAuth callback, webhooks).
- [ ] New permissions registered in `rbac/permission-registry.ts`.
- [ ] Super-admin-only areas (client settings, role mgmt) verified gated.
- [ ] Frontend `ProtectedRoute` permission props match backend permissions.

### Transport / Network

- [ ] HTTPS terminated at the proxy for the public host.
- [ ] `CORS_ORIGIN` restricted to known origins (no `*`).
- [ ] Rate limiting (Throttler) tuned for traffic.

### Input / Data Handling

- [ ] Global `ValidationPipe` strict mode on (`forbidNonWhitelisted`).
- [ ] DTOs validate all external input (`class-validator`).
- [ ] File uploads constrained (type/size) and stored in S3, not served from app.
- [ ] Webhook endpoints verify HMAC (raw body preserved in `main.ts`).
- [ ] User-supplied HTML sanitized on the frontend (`dompurify`, `lib/sanitize.ts`).

### Integrations

- [ ] eBay tokens stored encrypted; refresh path tested (`integrations/ebay/`).
- [ ] `EBAY_ENVIRONMENT` correct (`SANDBOX` vs `PRODUCTION`).
- [ ] S3 bucket policy least-privilege; presigned URLs short-lived.

---

## Outstanding Security Gaps

- No server-side token revocation (logout is client-only).
- Tenant/org row-level isolation inconsistent (prior audit).
- Test coverage too low to catch authz regressions automatically.
- No refresh-token rotation; tokens remain valid until expiry.
- eBay OAuth token refresh fragile against live API.

Tracked in: [/docs/context/KNOWN_ISSUES.md](../context/KNOWN_ISSUES.md).

---

## Sensitive Environment Variables

| Variable | Security Level | Notes |
|----------|---------------|-------|
| `JWT_SECRET` | Critical | Strong random string, never commit |
| `DB_PASSWORD` | Critical | Change from default `postgres` |
| `REDIS_PASSWORD` | High | If set, used for auth |
| `EBAY_CLIENT_SECRET` | Critical | eBay API secret |
| `EBAY_DEV_ID` | Critical | eBay developer ID |
| `OPENAI_API_KEY` | High | OpenAI API access |
| `AWS_SECRET_ACCESS_KEY` | Critical | S3 access |
| `SELLERPUNDIT_EMAIL`, `SELLERPUNDIT_PASSWORD` | High | SellerPundit credentials |

---

*Consolidated & reorganized: 2026-06-06.*
