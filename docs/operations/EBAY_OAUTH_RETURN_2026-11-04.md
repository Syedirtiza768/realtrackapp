# B&I eBay OAuth return route — deployed 2026-11-04

**State:** Deployed and production-verified at `2026-11-04T18:51:55Z`.

## Cause and change

The production callback always redirected successful connections to
`/settings/integrations/ebay`, although the OAuth service had already resolved
the vertical-specific destination from OAuth state. That settings page requires
`ebay.view`, which the dedicated `business_industrial_admin` role does not
receive. B&I store creation succeeded, but the browser showed Access denied.

The backend now uses the `redirectUrl` returned by the OAuth service. B&I
connections return to `/business-industrial/stores`; the existing generic
settings destination remains the fallback. No permission was broadened.

## Release and rollback

- Candidate: `realtrackapp-backend:ebay-oauth-return-20261104-r1`
- Candidate image ID: `sha256:dbac822548524edfa5fdd10da1b8365162b7fffc89a86528d963e970f9d3da7b`
- Base image: `realtrackapp-backend:inventory-photo-review-20261104`
- Retained rollback tag: `realtrackapp-backend:rollback-ebay-oauth-return-20261104-r1`
- Rollback image ID: `sha256:b0f2e7caf2d17deffe3449907affc471bc7e6b3a36189c5b12d251da4ab400f2`
- Release directory: `/home/ubuntu/realtrackapp-ebay-oauth-return-20261104`
- Only `/app/dist/src/integrations/ebay/controllers/integrations-ebay.controller.js`
  was overlaid on the active image. The OAuth service already returned the
  B&I store-page destination.
- The saved 44-file production Compose chain was preserved, with one backend
  image override appended. The temporary shell-only Compose probe confirmed
  `SELLERPUNDIT_PASSWORD` matched the running container byte-for-byte; its value
  was not displayed.
- Previous backend container `ce1be82ddc8b` was replaced by `861828324e5f`.
  Frontend, PostgreSQL, Redis, and PgBouncer container IDs did not change.
- Rollback override:
  `/home/ubuntu/realtrackapp-ebay-oauth-return-20261104/compose-backend.rollback.yml`.
  Append it to the Compose files recorded on the active backend container and
  recreate only `backend` with `--no-deps --no-build --pull never`.

## Verification

- Offline callback smoke check passed for both the B&I destination and the
  existing generic fallback.
- The deployed backend reports healthy; public `/api/health` returned HTTP 200.
- The deployed controller uses `result.redirectUrl`, and the service contains
  `/business-industrial/stores`.
- Recent startup logs contained no migration failure or fatal error. The image
  overlay made no schema change.

Two successful B&I OAuth connections made by the admin before this release
remain active in the B&I workspace. No additional connection was created during
the rollout.
