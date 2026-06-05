# Risk Register

Likelihood/Impact: Low / Med / High. Re-verify status before acting.

| # | Risk | Area | Likelihood | Impact | Mitigation / status |
|---|------|------|-----------|--------|---------------------|
| R1 | Double-`/api` prefix breaks or confuses routing | API | Med | Med | Confirm client calls; fix `feature-flag` + `export-rule` controllers ([api-map](../architecture/api-map.md)) |
| R2 | Low automated test coverage hides regressions | Quality | High | High | Add auth/RBAC + eBay e2e/unit tests |
| R3 | Production secrets left as defaults | Security | Med | High | Enforce [security-checklist](../operations/security-checklist.md) pre-deploy |
| R4 | Catalog CSV import OOM | Ops | Med | Med | `NODE_OPTIONS` heap + concurrency cap (already applied); monitor |
| R5 | Migration failure on boot (auto-run) | DB/Ops | Low | High | `migrationsTransactionMode: 'each'`; backup before deploy; review generated SQL |
| R6 | TEXT-typed price/quantity columns cause math/precision bugs | DB | Med | Med | Verify `Phase3PriceTypesMigration` coverage; migrate remaining |
| R7 | Missing foreign keys → orphaned rows | DB | Med | Med | Audit FKs (revisions, order_items, sales_records, inventory_events) |
| R8 | Weak tenant/org row-level isolation | Security/Data | Med | High | Review org-scoped queries; add guards/filters |
| R9 | No JWT revocation; long-lived tokens | Security | Med | Med | Add short expiry + refresh or revocation list |
| R10 | eBay token refresh/OAuth fragility against live API | Integration | Med | High | Test refresh path; monitor `EbayApiError` logs |
| R11 | Dual channel-mapping tables cause inconsistency | DB/Logic | Low | Med | Complete `channel_listings` deprecation |
| R12 | Non-eBay channels are scaffolding presented as features | Product | Med | Med | Flag clearly or complete |
| R13 | Uncommitted working tree could be lost | Process | Med | Med | Commit/triage modified files |
| R14 | Branding inconsistency (RealTrackApp/ListingPro) | Product | High | Low | Standardize naming |
| R15 | Docs drift from code over time | Process | High | Med | Continuous Documentation Protocol enforced in CLAUDE.md/AGENTS.md |

Sources: code inspection (2026-05-29), `docs/FULL_SYSTEM_AUDIT_AND_ROADMAP.md`,
`docs/backend-audit-report.md`, `docs/frontend-audit-report.md`.
