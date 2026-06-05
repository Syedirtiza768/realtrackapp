# Security Checklist

Operational security baseline for RealTrackApp. Re-run before each production
deploy.

## Secrets & config

- [ ] `JWT_SECRET` is a strong random value, unique per environment, not the
      placeholder. Rotating it invalidates all existing tokens.
- [ ] DB credentials changed from defaults (`postgres/postgres`).
- [ ] `REDIS_PASSWORD` set if Redis is network-reachable.
- [ ] `OPENAI_API_KEY`, eBay creds, AWS keys provided via env/secret store — never
      committed. `.env` is gitignored.
- [ ] No secret values pasted into docs, logs, or commit messages.

## Database

- [ ] `DB_SYNCHRONIZE=false` (schema only via reviewed migrations).
- [ ] Postgres not exposed publicly (bind to internal network / firewall the
      external port).
- [ ] Backups taken before risky migrations.

## AuthN / AuthZ

- [ ] Global guard stack intact: `ThrottlerGuard` → `JwtAuthGuard` →
      `PermissionsGuard` (`app.module.ts`).
- [ ] New endpoints carry `@RequirePermissions(...)`; `@Public()` used only where
      intended (login, register, health, branding, OAuth callback, webhooks).
- [ ] New permissions registered in `rbac/permission-registry.ts`.
- [ ] Super-admin-only areas (client settings, role mgmt) verified gated.
- [ ] Frontend `ProtectedRoute` permission props match backend permissions.

## Transport / network

- [ ] HTTPS terminated at the proxy for the public host.
- [ ] `CORS_ORIGIN` restricted to known origins (no `*`).
- [ ] Rate limiting (Throttler) tuned for traffic.

## Input / data handling

- [ ] Global `ValidationPipe` strict mode on (`forbidNonWhitelisted`).
- [ ] DTOs validate all external input (`class-validator`).
- [ ] File uploads constrained (type/size) and stored in S3, not served from app.
- [ ] Webhook endpoints verify HMAC (raw body preserved in `main.ts`).
- [ ] User-supplied HTML sanitized on the frontend (`dompurify`, `lib/sanitize.ts`).

## Integrations

- [ ] eBay tokens stored encrypted; refresh path tested (`integrations/ebay/`).
- [ ] `EBAY_ENVIRONMENT` correct (`SANDBOX` vs `PRODUCTION`).
- [ ] S3 bucket policy least-privilege; presigned URLs short-lived.

## Outstanding security gaps (track)

- No server-side token revocation (logout is client-only).
- Tenant/org row-level isolation inconsistent (prior audit).
- Test coverage too low to catch authz regressions automatically.

See [/docs/handover/risk-register.md](../handover/risk-register.md).
