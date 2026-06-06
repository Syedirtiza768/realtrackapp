> ⚠️ MOVED → [/docs/context/KNOWN_ISSUES.md](../context/KNOWN_ISSUES.md) (2026-06-06)

# Known Gaps

Curated from code inspection plus prior audits (`docs/FULL_SYSTEM_AUDIT_AND_ROADMAP.md`,
`docs/backend-audit-report.md`, `docs/frontend-audit-report.md`,
`docs/PRODUCT_FEATURE_CATALOG.md`). Re-verify against current code before acting —
some items may be resolved since the audits.

## Product / UX

- **Branding inconsistency**: "RealTrackApp" (shell) vs "ListingPro" (login, DB).
- **Forgot-password**: `/forgot-password` page exists; no confirmed reset endpoint
  → **Needs verification**.
- **Multi-marketplace breadth**: Shopify/Amazon/Walmart are scaffolding;
  eBay is the only fully developed channel.

## API / backend

- **Double `/api` prefix**: `feature-flag.controller` and `export-rule.controller`
  resolve at `/api/api/...` (global prefix + declared `api/`). Confirm client
  expectations before changing.
- **Sparse tests**: 9 backend `.spec.ts`, 1 e2e; no meaningful frontend tests.
- **Logout is client-side only**: no token revocation/blacklist; JWT expiry/refresh
  policy unverified.
- **Tenant isolation**: row-level org scoping inconsistent per prior audit.

## Database

- TEXT-typed `startPrice` / `quantity` / cost columns (per audit) — numeric typing
  partially addressed by `Phase3PriceTypesMigration`; verify current state.
- Historically missing foreign keys (`listing_revisions`, `order_items`,
  `sales_records`, `inventory_events`).
- Dual channel-mapping tables (`channel_listings` + `listing_channel_instances`);
  `Phase3DeprecateChannelListings` began consolidation.
- Some tables historically created outside migrations — confirm full migration
  coverage now that 21 migrations exist.

## Operations / security

- Default credentials in `.env.example` (`postgres/postgres`) must be changed for
  any non-local deployment.
- `DB_SYNCHRONIZE` must stay `false` in production.
- Large CSV imports require elevated `NODE_OPTIONS` heap; OOM risk otherwise.
- See [/docs/operations/security-checklist.md](../operations/security-checklist.md)
  and [/docs/handover/risk-register.md](../handover/risk-register.md).

## Documentation

- This documentation set is new (2026-05-29). Older docs under `docs/` predate it
  and may be stale; they are preserved as reference, not authority.
