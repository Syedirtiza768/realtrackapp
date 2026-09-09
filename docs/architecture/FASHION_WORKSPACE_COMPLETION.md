# Fashion workspace completion — 2026-09-09

## Corrected production baseline (2026-09-09, later verification)

The earlier Fashion-only baseline assumption below is superseded: Docker labels and runtime files prove the active release is `/home/ubuntu/realtrackapp-bi-release-20260909-01`, including deployed Business & Industrial code. The candidate has been overlaid onto that live source snapshot to preserve B&I. Do not deploy commit `9e0d797` by itself. GitHub push was blocked by automatic approval review pending explicit authorization for `Syedirtiza768/realtrackapp`. No live services, database or passwords have been changed by this completion session.

## Implemented in this release candidate

The Fashion route tree in `src/App.tsx` uses a parent Outlet and relative child routes. The former nested absolute routes rendered an empty shell. Screens now cover overview, listing list/create/detail/edit, bulk import, authenticity review, dedicated seller stores, users, quarantine incidents, workspace rules and first-login password change.

`FashionUsersService` creates Fashion-only accounts, replaces scoped roles, assigns dedicated stores and deactivates eligible accounts. It rejects self-modification and shared/platform accounts. `FashionListingsService` provides transactional draft editing, review reset, explicit authenticity approval, private review records and local quarantine. Catalog imports now scope Fashion sessions by organization/owner/permission, preview source rows, validate mappings, claim starts atomically and create/reset pending reviews in the import transaction.

The Fashion eBay controller exposes scoped seller accounts, category suggestions/metadata, policy cache/sync, validation, publish jobs/targets, publication records and end operations. Both editor and store-account response aliases are supported. Normalized item-specific keys are emitted using eBay's canonical localized aspect names. The publish worker checks approval immediately before sending and attempts withdrawal if approval changed during the remote request.

## Authentication and schema

Migration `1790700000000-AddPasswordChangeRequired.ts` adds `users.password_change_required` with default false. Existing accounts remain unchanged until explicitly flagged. Global JWT enforcement returns `403 PASSWORD_CHANGE_REQUIRED`; only current-user profile and password change are allowed for flagged sessions. Password change verifies the old password, requires 12+ characters / at most 72 UTF-8 bytes, rejects reuse, and uses compare-and-swap.

Seed variables: `FASHION_SEED_ADMIN_EMAIL`, `FASHION_SEED_ADMIN_PASSWORD`, optional `FASHION_SEED_ADMIN_NAME`, `FASHION_SEED_ADMIN_ORGANIZATION_NAME`. Do not commit their values. Reruns do not reset existing passwords. `--require-password-change` flags only a verified existing Fashion administrator.

## Verification recorded

- Isolated frontend TypeScript build and backend Nest build passed before final worker safeguard.
- Browser fixture checks passed for all ten Fashion screen routes, explicit unchecked authenticity confirmation, password redirect, restricted navigation, anonymous redirect and no runtime errors.
- Backend password/configuration/variant unit suites: 22 tests passed.
- Fixture tests do not prove live seller authorization or successful marketplace publication.

## Remaining requirements — not represented as complete

- Variation-family editor/approval and bulk scheduling are not implemented by these screens.
- Evidence inputs reference existing private records; there is no evidence upload/verification workflow.
- Automated counterfeit notifications, durable takedown retry/escalation and the 60-second response objective are not implemented. Manual quarantine attempts tracked Inventory API offer withdrawal; unknown/Trading API offers require manual removal.
- A network/database/process failure after remote publication can still require reconciliation. Pre/post publish checks are compensating safeguards, not an atomic transaction with eBay.
- Store policy configuration and cross-store inventory behavior still need live seller verification.
- Job APIs exist; full persistent job-monitoring UI remains to be completed.
- List/review/incident screens currently cap at the latest 200 products.

## Release procedure

Use the isolated `.codex-fashion-release` worktree based on the deployed source snapshot. Do not deploy the root dirty tree: it contains unrelated unfinished Business & Industrial changes. Preserve the current live images and database backup; validate backup before migrations. Build candidate images, then replace only backend/frontend services, preserving volumes and other applications. Record actual commit, migration, health and browser checks after deployment. This document is not evidence that deployment has occurred.
