> ⚠️ MOVED → [/docs/context/NEXT_STEPS.md](../context/NEXT_STEPS.md) (2026-06-06)

# Next Steps

Recommended, roughly prioritized. Verify each against current code first — some
may already be in progress in the uncommitted working tree.

## High priority

1. **Resolve the double-`/api` prefix** in `feature-flag.controller.ts` and
   `export-rule.controller.ts`. Confirm what the frontend clients call, then make
   routes consistent (drop the leading `api/`). Update [api-map.md](../architecture/api-map.md).
2. **Commit / triage the working tree.** A large number of modified files are
   uncommitted; reconcile and commit in coherent chunks.
3. **Raise test coverage on auth/RBAC and eBay publish/sync** — the riskiest,
   least-tested paths. Add e2e for login → permissioned route → 403/200.
4. **Verify production secrets & config**: strong `JWT_SECRET`, non-default DB
   creds, Redis password, correct `EBAY_ENVIRONMENT`. Run the
   [security-checklist](../operations/security-checklist.md).

## Medium priority

5. **Standardize branding** (RealTrackApp vs ListingPro) across login, shell, DB.
6. **Confirm DB hygiene** from prior audit: numeric price/quantity columns,
   missing FKs, channel-mapping table consolidation. Add migrations where needed.
7. **Finish or clearly flag forgot-password** (add reset endpoint or hide UI).
8. **Tenant isolation review**: ensure org-scoped queries are enforced.

## Lower priority / longer term

9. Flesh out non-eBay channels (Shopify/Amazon/Walmart) or remove dead scaffolding.
10. Add frontend tests for protected routing and core flows.
11. Document remaining module DTO request/response shapes inline in api-map as
    they stabilize.

## Process

- Follow the [agent-workflow](../development/agent-workflow.md) and
  [task-completion-checklist](../development/task-completion-checklist.md).
- Every meaningful change updates the relevant docs (Continuous Documentation
  Protocol) and adds a CHANGELOG entry.
