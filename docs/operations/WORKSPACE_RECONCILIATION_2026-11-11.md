# Workspace reconciliation into main — 2026-11-11

## Why

The development checkout `F:\apps\realtrackapp` (branch `codex/auto-parts-image-save`,
branch point `b019ac72`) carried two months of uncommitted work from several sessions:
288 modified tracked files and 19,282 untracked files. Meanwhile `origin/main` moved 75
commits ahead and production was built from `main` plus overlay images. This record
explains how that work was brought into `main`, what was left out, and where every
local variant that lost a conflict can still be found.

## Method

Each candidate file was compared three ways: working copy (local), branch point
(`b019ac72`) and `origin/main` (`73e60d59`), with line endings normalised.

| Class | Files | Handling |
|---|---|---|
| Already identical on main | 45 | nothing to do |
| main unchanged since the branch point | 165 tracked + 82 untracked | local version taken |
| Changed on both sides | 99 tracked | 3-way merge (`git merge-file`) |
| Added on both sides with different content | 9 | 2-way merge |

The 3-way merges produced 38 clean files and 69 files with 280 conflict hunks. Hunks
where one side already contained everything the other side added were resolved to the
superset automatically (31). The remaining 109 hunks were reviewed:

- **Code: main wins where both sides rewrote the same code.** In nearly every case main
  and the checkout held parallel versions of the same feature (Fashion photo slots and
  image mirroring, Trading API publishing and relisting, catalog quick filters), and main
  is the version production runs. Local-only additions that main lacked were kept.
- **Docs and CHANGELOG: union.** main's text plus any local lines it lacked, without
  duplicate lines.
- Local kept: `storage.controller.ts` (NAPA image proxy + WebP fallbacks),
  `fashion.controller.ts` (shared `IMAGE_UPLOAD_MULTER_OPTIONS`).
- Both kept: `backend/Dockerfile`, `app.module.ts` imports, `listings.service.ts` and
  `search.service.ts` imports, `backend/.env.example`, multi-store listing spec tests.
- `.env.example`: main's version, because the checkout had deleted the S3 and
  exposed-port settings that docker-compose reads.

Files where clean parts of both sides duplicated the same functions, or produced
mismatched component props, were taken from main whole. Each was found by the
typecheck, not guessed.

## Files where main's version replaced the local one

Whole file from main (18):
`ebay-publish.service.spec.ts`, `single-listing-form.service(.spec).ts`,
`ebay-listing-validation.service(.spec).ts`, `enrichment-retry.service.ts`,
`fitment-discovery.service.spec.ts`, `published-listings-action.service.ts`,
`storage.service(.spec).ts`, `fashion-image-analysis.service.ts`, `fashion.config.ts`,
`CatalogProductQuickView.tsx`, `CatalogResultsTable.tsx`, `CatalogWorkspace.tsx`,
`FashionListingEditorPage.tsx`, `FashionPhotoSet.tsx`, `ebayIntegrationsApi.ts`.

Local copy was an older main version (6): `fashion-listings.service.ts`, `fashion.dto.ts`,
`ebay-trading-get-item.util.ts`, `fashionListingsApi.ts`, `FashionMeasurementChart.tsx`,
`fashion-intake.service.ts`.

At least one hunk resolved to main (17): `csv-import.processor.ts`,
`catalog-workspace.service.ts`, `ebay-publish.service.ts`, `ebay-trading-api.service(.spec).ts`,
`inventory-auto-trigger.service.ts`, `inventory-workbench.service.ts`,
`fashion-image-analysis.service.spec.ts`, `fashion.config.spec.ts`, `verticals.service.ts`,
`CatalogMobileFilterDrawer.tsx`, `CatalogQuickFilterBar.tsx`, `FashionPublishModal.tsx`,
`FashionCapturePage.tsx`, `imageUrl.ts`, `inventoryApi.ts`, `.env.example`.

Local-only behaviour that did not make it into main as a result, and remains in the
archive branch: `EBAY_LISTING_API_MODE` and FEBEST routing in `shouldUseTradingApi`;
the inline category-ID and image checks in the local Trading `addFixedPriceItem`; the
local `ebay-listing-validation.service.ts` (review-hold and Fashion-location checks; its
spec was already failing in the checkout); per-store marketplace selection in the local
`FashionPublishModal.tsx`; column sort/filter props in the local `CatalogResultsTable.tsx`.

Local-only specs left out because they test those dropped variants:
`enterprise-listing-intelligence.title-fitment.spec.ts` (already failing in the
checkout), `fashion-measurements.spec.ts`, `add-part-recovery.spec.ts`.

## Left out of main on purpose

- **410 untracked `scripts/` files.** One-off operations scripts; at least 70 hold live
  credentials in plain text (database URLs with passwords, eBay app keys, OpenRouter
  keys). They must not enter git. Rotate any credential that has ever been pasted into
  one of these files and shared.
- Generated or data output: `backend/dist-*` (six build folders), `.tmp/`,
  `.codex-fashion-*baseline/`, `workspaces/`, `deliverables/`, marketing media, and about
  70 scratch files at the repo root (`check_*.sql`, `tmp-*`, fragments).
- Branch commits whose content is already on main: `880eb325` (eBay 518 quota guard,
  99% of added lines on main), `6266107a`, and the stash (86%). The September branch
  `codex/fashion-workspace-completion-20260909` (`9e0d797f`, `475b7161`, `8d5eebab`) was
  not merged: its unmatched lines are code main has since rewritten; it stays on its
  remote branch.

## Archive

`archive/workspace-snapshot-20261111` (pushed to origin) is the checkout exactly as it
was — every modified tracked file and every untracked source/doc file, excluding the
credential-bearing scripts and generated output — committed on `b019ac72`. Use it to
recover any local variant listed above.

## Verification

- Backend `tsc -p tsconfig.build.json`: 0 errors. Frontend `tsc -p tsconfig.app.json`,
  `tsconfig.node.json`: 0 errors; `vite build` succeeds.
- Backend Jest on the reconciled tree: 915 passed, 32 failed, 32 skipped. On
  `origin/main` alone: 823 passed, 42 failed. No test fails on the reconciled tree that
  does not already fail on main; 10 tests that fail on main now pass.
- Secret scan of every committed file: no new credentials (two flags are a local test
  database URL and a documentation example already on main).
- Additionally applied: `b5a5fa47` (Fashion compliance keeps the colour "Off White" out
  of brand matching), which existed only on the local `feat/fashion-batch-publish`.
