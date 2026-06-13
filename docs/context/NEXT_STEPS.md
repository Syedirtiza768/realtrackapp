# Next Steps

> **Source**: Moved from `docs/handover/next-steps.md` (2026-05-29).
> Recommended, roughly prioritized. Verify each against current code first — some may already be in progress.

## Critical

1. **Resolve the double-`/api` prefix** in `feature-flag.controller.ts` and `export-rule.controller.ts`. Remove `api/` from `@Controller()` decorators. Update [/docs/architecture/API_CONTRACTS.md](../architecture/API_CONTRACTS.md).
2. **Remove DEBUG JWT logging** in `auth.service.ts` and `jwt.strategy.ts`. Gate behind `NODE_ENV=development` or remove entirely. Exposes full tokens in log output.
3. **Verify production secrets & config**: strong `JWT_SECRET`, non-default DB creds, Redis password, correct `EBAY_ENVIRONMENT`. Run the security checklist in [/docs/architecture/SECURITY.md](../architecture/SECURITY.md).

## High Priority

4. **Commit / triage the working tree.** A large number of modified files were uncommitted as of 2026-05-29; reconcile and commit in coherent chunks.
5. **Raise test coverage on auth/RBAC and eBay publish/sync** — the riskiest, least-tested paths. Add e2e for login → permissioned route → 403/200.
6. **Add permission checks to 4 unprotected settings routes** (`/settings/client`, `/settings/users`, `/settings/permissions`, `/settings/ai-routing`).
7. **Standardize branding** (RealTrackApp vs ListingPro) across login, shell, DB.
8. **Confirm DB hygiene** from prior audit: numeric price/quantity columns, missing FKs, channel-mapping table consolidation. Add migrations where needed.
9. **Finish or clearly flag forgot-password** (add reset endpoint or hide UI).
10. **Tenant isolation review**: ensure org-scoped queries are enforced.

## Medium Priority

11. Flesh out non-eBay channels (Shopify/Amazon/Walmart) or remove dead scaffolding.
12. Add frontend tests for protected routing and core flows.
13. Document SellerPundit integration and AI routing system as standalone guides.
14. Document remaining module DTO request/response shapes inline in API contracts as they stabilize.

## Low Priority / Longer Term

15. JWT refresh token rotation and server-side revocation.
16. PostgreSQL partitioning for high-volume tables (`inventory_events`, `audit_logs`).
17. API v2 with standardized response shapes.
18. Comprehensive performance testing and optimization.

## Process

- Follow the Continuous Documentation Protocol (update docs with every change).
- Every meaningful change updates the relevant docs and adds a CHANGELOG entry.
- Definition of done: see [/docs/operations/TESTING.md](../operations/TESTING.md).

---

*Last updated: 2026-06-11. Reorganized: 2026-06-06.*
