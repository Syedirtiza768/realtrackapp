# Next Steps

> **Source**: Moved from `docs/handover/next-steps.md` (2026-05-29).
> Recommended, roughly prioritized. Verify each against current code first — some may already be in progress.

## Critical

1. **Resolve the double-`/api` prefix** in `feature-flag.controller.ts` and `export-rule.controller.ts`. Confirm what the frontend clients call, then make routes consistent (drop the leading `api/`). Update [/docs/architecture/API_CONTRACTS.md](../architecture/API_CONTRACTS.md).
2. **Verify production secrets & config**: strong `JWT_SECRET`, non-default DB creds, Redis password, correct `EBAY_ENVIRONMENT`. Run the security checklist in [/docs/architecture/SECURITY.md](../architecture/SECURITY.md).

## High Priority

3. **Commit / triage the working tree.** A large number of modified files were uncommitted as of 2026-05-29; reconcile and commit in coherent chunks.
4. **Raise test coverage on auth/RBAC and eBay publish/sync** — the riskiest, least-tested paths. Add e2e for login → permissioned route → 403/200.
5. **Standardize branding** (RealTrackApp vs ListingPro) across login, shell, DB.
6. **Confirm DB hygiene** from prior audit: numeric price/quantity columns, missing FKs, channel-mapping table consolidation. Add migrations where needed.
7. **Finish or clearly flag forgot-password** (add reset endpoint or hide UI).
8. **Tenant isolation review**: ensure org-scoped queries are enforced.

## Medium Priority

9. Flesh out non-eBay channels (Shopify/Amazon/Walmart) or remove dead scaffolding.
10. Add frontend tests for protected routing and core flows.
11. Document remaining module DTO request/response shapes inline in API contracts as they stabilize.

## Low Priority / Longer Term

12. JWT refresh token rotation and server-side revocation.
13. PostgreSQL partitioning for high-volume tables (`inventory_events`, `audit_logs`).
14. API v2 with standardized response shapes.
15. Comprehensive performance testing and optimization.

## Process

- Follow the Continuous Documentation Protocol (update docs with every change).
- Every meaningful change updates the relevant docs and adds a CHANGELOG entry.
- Definition of done: see [/docs/operations/TESTING.md](../operations/TESTING.md).

---

*Last updated: 2026-05-29. Reorganized: 2026-06-06.*
