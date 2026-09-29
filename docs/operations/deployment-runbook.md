> ⚠️ MOVED → [/docs/operations/TROUBLESHOOTING.md](TROUBLESHOOTING.md) and [/docs/architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md) (2026-06-06)

# Deployment Runbook

Architecture context: [/docs/architecture/deployment.md](../architecture/deployment.md).

## Prerequisites

- Host with Docker + Docker Compose.
- A populated `.env` (copied from `.env.example`) with **real** secrets:
  `JWT_SECRET` (required), DB creds, `OPENAI_API_KEY`, eBay creds, AWS S3 creds.
  For public-folder B&I intake, also set `GOOGLE_DRIVE_API_KEY`; Compose passes it
  into the backend container without storing the key in the repository.
- DNS / reverse proxy for the public host (`app.omnicoreholding.com`) if external.

## Standard deploy (Docker Compose)

```bash
# 1. Pull latest code
git pull

# 2. Ensure env is current
diff .env.example .env   # add any new vars

# 3. Build & start. This also removes stale Compose one-off backend
#    containers so an old queue consumer cannot process publish jobs.
bash scripts/deploy-production.sh

# 4. Watch boot (migrations run automatically: DB_MIGRATIONS_RUN=true)
docker compose logs -f backend

# 5. Verify health
curl -f http://localhost:4191/api/health
curl -f http://localhost:8050/        # frontend
```

Backend healthcheck has a 120s `start_period` (migrations + warmup). Wait for it
to report healthy before sending traffic.

## Migrations

- Default: run automatically on backend boot.
- Manual / out-of-band:
  ```bash
  docker compose exec backend sh -lc "cd /app && node -e 0"  # shell in
  # or run from a dev checkout against the same DB:
  cd backend && npm run migration:run
  ```
- After editing entities, generate a migration in dev (`npm run migration:generate`),
  review the SQL, commit it. Never enable `DB_SYNCHRONIZE` in production.

## Database seed / restore

- First-run only: `listingpro.dump` auto-restores into a fresh `pgdata` volume.
- To re-seed RBAC: `RBAC_SYNC_PERMISSIONS=true` on boot, or run
  `backend/src/scripts/seed-rbac.ts`.

## PM2 alternative (non-Docker backend)

```bash
cd backend && npm ci && npm run build
pm2 start ecosystem.config.cjs       # realtrackapp-backend on :4191
pm2 logs realtrackapp-backend
```
Serve the built frontend (`npm run build` → `dist/`) via nginx (`nginx.conf`).

## Rollback

1. `git checkout <previous-tag>` and `bash scripts/deploy-production.sh`.
2. **DB migrations**: roll forward preferred. To revert the last migration:
   `cd backend && npm run migration:revert` (only if the migration is reversible
   and no dependent data changes occurred). Take a `pg_dump` backup first.
3. Restore from backup if a migration corrupted data (see backup step below).

## Backups

- Before any risky migration: `docker compose exec postgres pg_dump -U $DB_USER
  -Fc $DB_NAME > backup-$(date +%F).dump`.
- Redis is queue/cache state — generally rebuildable, but `redisdata` persists.

## Common issues

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Backend OOM during catalog import | Heap too small | Raise `NODE_OPTIONS=--max-old-space-size` to fit RAM |
| Backend won't start, "JWT_SECRET is required" | Missing env | Set `JWT_SECRET` in `.env` |
| 401 loops in UI | Expired/invalid JWT | Re-login; check `JWT_SECRET` unchanged across restarts |
| CORS errors | Origin not allow-listed | Add to `CORS_ORIGIN` |
| Migration fails midway | Non-reversible/partial | `migrationsTransactionMode: 'each'` isolates each; fix + re-run |
| Publish results disagree with current backend logs | Duplicate/stale backend queue consumer | Run `bash scripts/deploy-production.sh`; do not use detached `docker compose run -d backend` |

### Targeted eBay publish recovery

After the deployment helper has removed stale backend consumers, inspect one
publish job without changing data:

```bash
docker compose exec backend node /app/scripts/requeue-ebay-publish-job.mjs \
  --job-id=<publish-job-uuid>
```

The utility is dry-run by default. Its apply mode requires the exact same job
UUID twice and requeues only the incident classes covered by the current
publisher (Inventory-managed 21919474/21919233 projection errors, EPS
transport or invalid-source-image failures, invalid legacy fitment, missing
UPC, and stale generic Engine category failures):

```bash
docker compose exec backend node /app/scripts/requeue-ebay-publish-job.mjs \
  --job-id=<publish-job-uuid> \
  --apply --confirm-job-id=<publish-job-uuid>
```

Policy, condition, SKU-collision, duplicate-listing, and unknown failures
remain failed for separate review. Each apply run writes a JSON backup
under `/app/output` before resetting the selected targets.

### S3 canonical WebP migration

The idempotent scripts/migrate-images-to-webp.js runner converts every first-party
non-WebP source under the configured S3 prefix to a sibling .webp object. Run
these phases in order from the backend container and review the report between
phases:

~~~bash
# Inventory only; no S3 mutation.
docker compose exec backend node /app/scripts/migrate-images-to-webp.js --report

# Create missing canonical WebPs. Safe to rerun after interruption.
docker compose exec backend node /app/scripts/migrate-images-to-webp.js --convert

# Re-run --report and require missingWebp=0 before cleanup.
docker compose exec backend node /app/scripts/migrate-images-to-webp.js --cleanup
~~~

Cleanup writes a deletion manifest under /app/output, preserves originals
referenced by active or out-of-stock ebay_published_listings, retains every
WebP object, and refuses to run while any source image lacks its WebP sibling.
The frontend proxy and eBay publish resolver keep the original URL as a runtime
fallback, so an incomplete legacy object cannot turn a listing into a broken
image.
### Febi / Lemforder single-image backfill

The production-only maintenance runner
`backend/src/scripts/backfill-brand-images.ts` applies the shared
resolution-aware primary-image policy to existing `listing_records` and
`catalog_products`. It then updates published Inventory API listings and,
when a legacy `ebayListingId` is not present in the modern channel tables,
discovers the seller account and revises that listing through the Trading API.
Every eBay update is read back and must contain exactly one image before it is
counted as successful. The runner does not delete source objects and writes a
JSON backup before database changes:

```bash
# Report selected images and discover legacy published item IDs; no mutation.
docker compose exec backend node /app/dist/src/scripts/backfill-brand-images.js \
  --discover-legacy

# Apply the reviewed report to local records and published eBay listings.
docker compose exec backend node /app/dist/src/scripts/backfill-brand-images.js \
  --apply --discover-legacy
```

Use `--skip-ebay` only when intentionally updating local records without
revising the live eBay listings. Any legacy IDs that cannot be matched to a
connected production account remain reported as failures and are not guessed.

## Post-deploy checklist

- [ ] `/api/health` green
- [ ] Login works; `/api/auth/me` returns permissions
- [ ] Migrations applied (`npm run migration:show`)
- [ ] eBay OAuth callback reachable (if integrations used)
- [ ] Background queues processing (check logs for processor activity)
- [ ] Only Compose-managed backend consumers exist (`docker compose ps backend` and the deployment helper completed without an unexpected-container error)
- [ ] Update CHANGELOG.md and [/docs/handover/current-state.md](../handover/current-state.md)
