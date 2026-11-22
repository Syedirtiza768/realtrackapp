# Production rebuilt from `main` — 2026-11-22

**State:** deployed to production on 2026-11-22 (main `f33bbcdf`). Built from `main`; backend and frontend images replace the
whole compiled application rather than overlaying single files.

## Why

1. The Fashion catalog loaded slowly. On the live code, one Fashion facets request was about 25 s
   of database time (about 25 statements, each scanning `catalog_products`, with per-row
   publication checks) and the summary about 9.5 s.
2. Production had drifted from `main`. Since October each release was `FROM` the previous live
   image plus a few compiled files, some built from uncommitted code (see the
   `prod-deploy` history in `CHANGELOG.md`).

## Drift analysis (live image `realtrackapp-backend:sale-push-subscribe-20261121-0befd9ad` vs `main` 550ababd)

- Backend: the 702 live compiled files and the 721 files of a `nest build` of `main` were compared
  with CRs ignored. Result: 623 identical. Of the 78 that differ, an independent per-file review
  with two refutation votes per risky claim classified 68 as `main` being the newer version, 8 as
  compile noise, and 2 behaviours (3 files) as production-only:
  - USD→GBP price conversion for GBP listings (`EBAY_FX_USD_GBP`), from hotfix `fx-rate-20261117`
    (live-only `ebay-fx-rate.util.js` + `listing-builder.service.js`). **Ported.**
  - Per-run AI usage fields on B&I image-intake job summaries (`jobSummaryWithCost`), dropped from
    `main` by the 2026-11-11 workspace reconcile `cffc56d2`. **Ported.**
- Runtime dependencies in `package.json` are identical. `shared/` is identical. `main` adds
  `assets/new-condition-listing-images/` (3 files) that the live image lacked. The entrypoint is
  identical. Every migration on `main` is already recorded in `typeorm_migrations`.
- New environment variables read by `main` all have defaults or are only used by seed and repair
  scripts.
- Frontend: the live bundle `index-DFsxB-xW.js` and a build of `main` were compared by string
  literals. The live bundle has no UI text or API or route path that `main` lacks. `main` adds
  sorting hints, the manual-review hold messages, the save-timeout warning and Auto Parts catalog
  routes. `main`'s `nginx.conf` repeated the `/api/storage/napa-image/` location, so `nginx -t`
  failed (`duplicate location`) when the release image was tested on the compose network. The
  duplicate was removed in a follow-up commit; `main`'s config is now byte-identical to
  production's.

Behaviour that changes in production because it is already on `main` (not new in this release):
catalog publication rules also count an eBay item ID, an active mirror row or an eBay-linked
listing record as published (Fashion 2,378 → 9,605 published, automotive 622 → 831 when last
counted); facet status buckets add *unpublished* and *blocked*; B&I Drive intake imports every
folder and image and uses `BNI-<folder>` SKUs. See `docs/decisions.md` 2026-11-22.

## Catalog change in this release

See `docs/architecture/CATALOG_WORKSPACE.md` ("Facets and summary"). Verification ran the
`main` build without and with the change inside one-off backend containers on the production
network, connected straight to PostgreSQL with `default_transaction_read_only=on`. It used 18
variants: Fashion and B&I; no filter; text search; brand; each publication status; stock;
marketplace; attribute; a store owning 2,363 published channels; mixed stores; no stores; a
non-admin scope; and a repeated call that hits the cache.

- Output: identical in every variant (summary, search page, every facet). The only exception is
  which equal-count value fills the last slot of a list capped at 100 rows.
- Timings (Fashion, before → after): default facets 8.4 s → 2.5 s, summary 1.8 s → 0.75 s,
  published filter 30 s → 1.9 s, unpublished 22.6 s → 1.5 s, text search facets 146 s → 17 s.
  B&I stays under 0.2 s.
- Indexes created with `CREATE INDEX CONCURRENTLY` on production before the deploy:
  `idx_catalog_products_org_vertical_created` (0.3 s) and `idx_epl_catalog_product_id` (partial,
  about 1 minute). Both are valid. Migrations `1792000000000` and `1792000000001` are
  `IF NOT EXISTS` no-ops on production.

Remaining known cost: a typed search (`q`) still ranks every matching row with trigram
`similarity()` (about 12 s for the search page, about 17 s for facets on Fashion). A trigram index
or a narrower match field is a separate product decision.

Pre-existing test failures (also on `main` 550ababd): 32 tests in 6 suites (`stores.service`,
`ebay-publish.service`, `fitment-discovery.service`, `cleanup.processor`,
`single-listing-form.service`, `image-processor.service`).

## Deployment

Deployed 2026-11-22. The backend was recreated at 17:58:53 UTC and was healthy within about 20 s
(0 restarts). The frontend was recreated about a minute later. Built from `main` `f33bbcdf`
(`fd0d767b` plus the nginx fix).

- Backend `realtrackapp-backend:main-reconcile-20261122-f33bbcdf` (image `90a2facd7367`):
  `FROM sale-push-subscribe-20261121-0befd9ad`, which keeps only its `node_modules` and OS
  packages (runtime dependencies are identical to `main`). It replaces `/app/dist`, `/app/assets`,
  `/app/shared` and the package manifests with `main`'s build.
- Frontend `realtrackapp-frontend:main-reconcile-20261122-f33bbcdf` (image `afc7cfe5aa28`):
  `FROM publish-all-stores-20261119-b5dc7649` with the whole `dist/` (`index-BuVE5kBp.js`) and
  `main`'s `docker/nginx.conf`. `nginx -t` passed on the `realtrackapp_default` network. The test
  cannot run during the build, because `backend` does not resolve without the network.
- Release directory `/home/ubuntu/realtrackapp-main-reconcile-20261122-fd0d767b/`: build contexts,
  Dockerfiles, `compose-{backend,frontend}-main-reconcile.yml`, and `compose-args-{backend,frontend}.txt`.
  Each args file is that container's own `config_files` list plus the image override.
- Migrations `1792000000000` and `1792000000001` were run by hand with the new image
  (`migration:run`, `DB_HOST=$DB_MIGRATION_HOST`). Both are recorded, and both indexes are still
  valid (they already existed, so the runs were no-ops).
- Before recreating, the running images were checked again
  (`sale-push-subscribe-20261121-0befd9ad`, `publish-all-stores-20261119-b5dc7649`).

Verification: `/api/health` returned 200 locally and publicly. The homepage, `/fashion/catalog`
and the bundle returned 200. The Fashion catalog search, facets and summary and the B&I intake jobs
route returned 401 without a login. The sha256 of the running compiled catalog service, the
listing builder and the frontend bundle matched the local build. Nothing new appeared in the
backend log after startup (only the usual seed-password warnings). No query ran longer than 5 s.
The registry sync created 0 new permission keys.

Rollback (both are recreates, not restarts):

```bash
cd /home/ubuntu/realtrackapp
D=/home/ubuntu/realtrackapp-main-reconcile-20261122-fd0d767b
sudo docker compose -p realtrackapp $(cat $D/compose-args-backend.rollback.txt) up -d --no-deps --no-build --pull never backend
sudo docker compose -p realtrackapp $(cat $D/compose-args-frontend.rollback.txt) up -d --no-deps --no-build --pull never frontend
```

The rollback args resolve to the previous images, which are also tagged
`realtrackapp-backend:rollback-main-reconcile-20261122` and
`realtrackapp-frontend:rollback-main-reconcile-20261122`. The two indexes and the migration
rows can stay; the previous code ignores them. Note that rolling back the backend brings back
the previous publication rules and the slow facets.
