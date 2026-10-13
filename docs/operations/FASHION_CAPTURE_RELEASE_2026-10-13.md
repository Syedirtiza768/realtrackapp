# Fashion camera and automatic SKU release — 2026-10-13

## Follow-up: full screen camera (2026-10-13, 11:16 UTC / 16:16 Pakistan time)

Commit `a84fa885` is on main and deployed as
`realtrackapp-frontend:fashion-fullscreen-camera-20261013-a84fa885`, image
`sha256:d64a2ab790f17838c5e0e9f70e341cc2e9fe9107f4ed5675776e160cce9a1a8e`.
The camera uses the full app viewport with overlaid controls and a matching
centered capture crop. Review/retake also fill the viewport. The browser's own
chrome is unchanged, and Save & Next remains in normal form flow.

Main and cumulative production frontend builds and scoped camera lint passed.
The complete synthetic-camera browser suite passed locally and against production,
including exact camera/video viewport coverage, all controls visible without
scrolling at 390×844, 844×390 and 1280×900, review dimensions, captured aspect
ratio, switching/releasing streams, continuous capture, retake, uploads, save
retry and timeout recovery. Separate deployed mobile/desktop checks confirm the
Save & Next panel is still static. Physical iOS/Android camera testing remains manual.

Only the frontend container was recreated. The current backend at rollout was
`realtrackapp-backend:add-part-recovery-20261013-r1`, and its container ID was
verified unchanged. The saved Compose list merges both currently running
services' overrides, preserving newer backend hotfixes. Public health returned
`ok`; backend, PostgreSQL, Redis and PgBouncer are healthy. The new JS
`/assets/index-BNFV9A6R.js` and CSS `/assets/index-kxJyMCbP.css` return HTTP 200.

The initial immediate HTTP check received a transient 502 while Nginx was starting
and automatically restored the preceding frontend image. The retry added a
bounded 20-second readiness check and then completed successfully. Backend
containers and data were preserved through both attempts.

The current release directory is
`/home/ubuntu/realtrackapp-fashion-fullscreen-camera-20261013-a84fa885/`, containing
assets, `frontend-source.tgz`, Dockerfile, saved `compose-args.json`, `rollback.yml`
and `verification.json`. Use this latest saved argument list to recreate the
current release. For frontend-only rollback, replace its final override path
with `rollback.yml` and run `up -d --no-deps frontend`. The retained preceding
image is `realtrackapp-frontend:rollback-fullscreen-camera-20261013`.
The older rollout records below are retained as historical context.

## Follow-up: normal-flow Save & Next (2026-10-13)

Commit `611f1018` removes sticky positioning from the capture action panel.
It was pushed to main and deployed as
`realtrackapp-frontend:fashion-save-flow-20261013-611f1018` (image
`sha256:b1969141cd0ba3afb49640b47000e322ff1d398432363702ffa528e838fdea32`).
The frontend alone was recreated; the backend container ID was verified unchanged.
Both main and cumulative production frontend builds passed. Browser checks against
the local build and deployed bundle at 390px and 1280px verify static positioning,
normal scrolling and no horizontal overflow. Public health is healthy; the new
asset `/assets/index-A74EIELL.js` returns HTTP 200.

The follow-up directory is
`/home/ubuntu/realtrackapp-fashion-save-flow-20261013-611f1018/`, including assets,
`frontend-source.tgz`, Dockerfile, `compose-args.json` and `rollback.yml`.
Use its saved arguments for current recreation. To roll back just this follow-up,
replace the final override path with its `rollback.yml` and run
`up -d --no-deps frontend`; the retained image is
`realtrackapp-frontend:rollback-save-flow-20261013`. The original rollout below is
preserved as historical context; its backend image remained current at that rollout.

## Release

- Source commit: `45d396e41e97e93ffa9baef563c38c02f0f3f7c0`, pushed normally to `main`.
- Server: `ec2-34-196-184-100.compute-1.amazonaws.com`; SSH uses `ubuntu` with sudo
  (the server explicitly rejects root login).
- Application: https://app.omnicoreholding.com/fashion/capture
- Backend: `realtrackapp-backend:fashion-camera-sku-20261013-45d396e4`, image
  `sha256:f7e13c2b52361b42215778cd3508876a2947845abaa3f1eae00191b4746d95dc`.
- Frontend: `realtrackapp-frontend:fashion-camera-sku-20261013-45d396e4`, image
  `sha256:33423fa001818475008f405cd34270df5623c97a024faf320eb1151e546df35d`.
- Verified again at 07:09 UTC / 12:09 Pakistan time on 2026-10-13.

## Scope and preservation

The source change came from a clean managed worktree based on `origin/main`;
unrelated changes in the original working directory were not staged or released.
The backend image layers only `fashion-intake.service`, `fashion-listings.service`,
`fashion.config` and `fashion.dto` compiled JS/maps over the previously running
`primemotive-catalog-data-r3-20261013` image. Other production hotfixes remain.

The frontend was rebuilt from the retained cumulative production source at
`/home/ubuntu/realtrackapp-catalog-publication-destination-20261010/frontend`,
with the eight changed/new Fashion frontend files applied. Its Fashion files
matched the main baseline before the overlay. Other cumulative frontend fixes
remain. Build output was layered over the preceding frontend image, retaining
older hashed assets for already-open browser sessions.

The release directory is
`/home/ubuntu/realtrackapp-fashion-camera-sku-20261013-45d396e4/` and contains
runtime assets, the retained `frontend-source.tgz`, overlay Dockerfiles, deployment
script, saved Compose arguments, prior Compose file list, and smoke results.
The effective Compose configuration merges the prior frontend/backend overrides
and this release's `compose-override.yml`; build contexts/arguments point to the
retained release so a later rebuild includes the fix. Only backend/frontend were
recreated. PostgreSQL, Redis and PgBouncer remained running. No migrations ran.

The pre-deploy environment comparison accounted for Docker Compose's escaping
of dollar signs in JSON output. Effective running environment values were
preserved; no integration credentials were changed. A preliminary Windows line
ending error and the initial escaped-value comparison stopped before service
changes. No rollback was needed.

## Verification

- Main and cumulative production frontend builds passed; backend build passed.
- 26 focused Fashion backend tests passed, including concurrent create replay,
  actor/organization boundaries and unavailable queue recovery.
- Disposable PostgreSQL: existing SKU seeding and 30 concurrent reservations
  across three organizations passed with unique consecutive allocated numbers.
- Chromium synthetic-camera suite passed locally and against the deployed
  frontend with mocked authenticated API responses: continuous front/back/label
  capture, retake, bounded uploads, local previews, failed-upload recovery, size
  correction, exact create retry, next garment, mobile fit, camera/SKU/upload
  deadlines, late camera grants, stream cleanup, and Add Item automatic SKUs.
- The deployed backend allocator passed through the actual production database
  connection; its counter change was rolled back and the original value verified.
  Deployed create DTOs accept valid capture UUIDs and reject invalid UUIDs.
- An actual deployed Fashion upload service check converted a generated JPEG to
  WebP, wrote/read S3, and loaded it through `/api/storage/serve/` with HTTP 200.
  Organization membership was checked. One unlinked 674-byte smoke image remains;
  its key/result is recorded in `storage-smoke-result.json`. No catalog item,
  stock event or AI job was created by this check.
- Public/direct health, Fashion capture HTML and the new
  `/assets/index-DXUoZNB3.js` asset return HTTP 200. Unauthenticated SKU allocation
  returns 401. Backend, PostgreSQL, Redis and PgBouncer are healthy.
- Physical iPhone/Android camera testing remains manual. Browser fixtures prove
  UI behavior, separately from the actual storage smoke above.

Broader tests remain limited by unrelated baseline failures: 86 suites/704 tests
passed, 9 suites/47 tests failed, and 19 tests were skipped. Root lint lacks its
ESLint 9 configuration; existing backend formatting/type-lint findings remain.
The changed frontend files pass scoped ESLint. These unrelated files were not changed.

## Rollback and recreation

Previous images are retained as
`realtrackapp-backend:rollback-fashion-camera-20261013` and
`realtrackapp-frontend:rollback-fashion-camera-20261013`.
Use the saved exact Compose argument list; do not omit cumulative overrides or
run a bare build from the old server checkout.

```python
# Run on the server from the release directory. Recreates only application services.
import json
import pathlib
import subprocess

root = pathlib.Path('/home/ubuntu/realtrackapp-fashion-camera-sku-20261013-45d396e4')
args = json.loads((root / 'compose-args.json').read_text())
args[-1] = str(root / 'rollback.yml')  # Omit this line to recreate the current release.
subprocess.check_call(args + ['up', '-d', '--no-deps', 'backend', 'frontend'])
```

Verify public health and Fashion login/capture after recreation. Do not use
`--build` with the rollback image tags; the retained tags are the rollback artifacts.
