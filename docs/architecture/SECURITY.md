# Security

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

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

- RBAC with 10 system roles and ~90 permissions (`module.action` format)
- Global `PermissionsGuard` enforces `@RequirePermissions()` decorators
- Source of truth: `backend/src/rbac/permission-registry.ts`
- Super-admin-only features: client settings, role management, feature-flag management
- **Publish policy (2026-08-08):** all publish permissions are granted to every human role, and `store_access_all` is enabled for all active users on US production — any authenticated user can publish any listing to any store. `listings.delete` / `listings.price_override` remain restricted. See [AUTH_RBAC.md → Publish policy](AUTH_RBAC.md#publish-policy). This is a deliberate business decision, not least-privilege; reassess if tenant isolation is introduced.

### Rate Limiting

`ThrottlerGuard`: 10/s, 100/min, 1000/hr per client — applied globally.

### Input Validation

Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). DTOs use `class-validator`. Raw body preserved for webhook HMAC verification.

### CORS

Configured from `CORS_ORIGIN` (comma-separated) or built-in defaults:
- `http://localhost:3911` (Vite dev)
- `http://localhost:8050` (Docker frontend)
- `https://app.omnicoreholding.com`
- `http://app.omnicoreholding.com`

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

- Legacy automotive rows still use nullable tenancy columns. Access is now
  restricted to members of one configured legacy organization, but a future
  reviewed data migration should backfill ownership and make the columns
  non-null where operationally possible.
- No refresh-token rotation; access tokens remain valid until expiry unless
  their `jti` is revoked on logout.
- eBay OAuth token refresh remains dependent on live provider behavior.

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

## Fashion isolation and authenticity controls (2026-09-09)

Fashion access is denied at login and at every controller through fashion.access and more specific Fashion permissions. Organization and store checks are performed server-side; vertical values from the browser are not trusted to grant access. eBay OAuth state carries the vertical, new Fashion stores are tagged Fashion, and the callback rejects a seller account already connected in the workspace so one seller cannot be reused across verticals.

Fashion review evidence is stored as private object keys in fashion_reviews and omitted from listing/catalog responses. Approval requires an explicit authenticityConfirmed=true. Publish projection blocks any Fashion product that is not approved, including quarantined products. Quarantine is local and fail-closed: the current integration reports that a remote eBay takedown action is unavailable rather than claiming universal webhook or takedown support.

## Business & Industrial controls (2026-09-09)

B&I DTOs allowlist the explicit category family, measurable values with units,
inventory/lot relationships, testing evidence, restricted-category clearance,
compatibility claims, and shipping coverage. Private serialized numbers are
stored in `business_industrial_units` and public responses expose only optional
public serials. Review approval requires provenance, specifications, testing,
and (where applicable) restricted-category confirmation; publish validation
also requires a mapped eBay leaf category, shipping evidence, and a dedicated
B&I seller store.

Verified incidents are idempotent by organization and external event ID. They
quarantine local catalog/review state immediately. Tracked eBay Inventory API
offers are withdrawn and re-read until `UNPUBLISHED` is verified; missing,
unauthorized, or failed targets remain escalated with sanitized attempt history
and can be retried by an authorized B&I administrator. Release is blocked until
all remote targets are verified, and quarantined listings cannot be edited or
approved while locked.

B&I login accepts an explicit `vertical=business_industrial` assertion and the
server checks the matching permission before issuing a token. B&I account
creation is organization-scoped, assigns only B&I roles, requires a temporary
password change, and permits only dedicated B&I store assignments. Private
serial numbers are never returned from public listing responses.

### B&I image intake controls (2026-09-10)

Image intake jobs, groups, and assets are filtered by the resolved organization
on every request. Upload paths are normalized and reject traversal, absolute
paths, unsupported files, files over 25 MB, and runs over 5,000 images. Source
images are stored below a job-specific B&I S3 prefix rather than in the legacy
global Image Drive tables. The vision prompt forbids invented identifiers,
specifications, compatibility, certifications, conditions, and prices. eBay
categories are accepted only after Taxonomy confirms a leaf; otherwise the
group remains a manual-review item. Applying a group creates a draft only;
existing provenance/specification/testing approval and dedicated-store publish
gates still apply. A group linked to a draft rejects additional intake uploads
so its evidence cannot silently diverge from the catalog record.

Retries use a unique BullMQ attempt ID and process only `pending` or `failed`
groups. Completed, reviewable, and draft-created results are preserved,
preventing repeated AI cost and accidental replacement of reviewed evidence.
Manual listing DTOs cap image arrays at 24 validated HTTP(S) URLs.

Drive completion can refresh prices only from the shared eBay Browse and
pricing-analysis services; it never writes a zero price when evidence is
unavailable. The completion runner uses an existing authorized B&I admin user
identity and does not extract or create credentials. It creates drafts and
inventory projections but does not publish to eBay; provenance,
specification, testing, restricted-category, and dedicated-store gates remain
authoritative.

### Shared catalog controls (2026-09-12)

The Fashion and Business & Industrial catalog workspaces use a shared backend
service but retain vertical-specific edit/review/publish authorities. Search,
facets, suggestions, detail, bulk actions, and CSV export resolve the caller’s
organization before querying `catalog_products`, require the expected vertical,
limit team visibility to unassigned or caller-accessible teams, and filter
publication summaries/facets to accessible stores. Requested team filters and
store targets are rejected when unauthorized rather than silently broadened.

Inline updates delegate to the vertical service. Bulk delete is a soft-delete
lifecycle transition and fails closed for published, quarantined, or manual-review
records. The quick view never renders private review evidence or serialized
unit secrets. Fashion bulk publish requires approved products and dedicated
Fashion stores; B&I publish retains its existing compliance and incident gates.
