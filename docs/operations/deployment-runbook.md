# Deployment Runbook

Architecture context: [/docs/architecture/deployment.md](../architecture/deployment.md).

## Prerequisites

- Host with Docker + Docker Compose.
- A populated `.env` (copied from `.env.example`) with **real** secrets:
  `JWT_SECRET` (required), DB creds, `OPENAI_API_KEY`, eBay creds, AWS S3 creds.
- DNS / reverse proxy for the public host (`mhn.realtrackapp.com`) if external.

## Standard deploy (Docker Compose)

```bash
# 1. Pull latest code
git pull

# 2. Ensure env is current
diff .env.example .env   # add any new vars

# 3. Build & start
docker compose up -d --build

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

1. `git checkout <previous-tag>` and `docker compose up -d --build`.
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

## Post-deploy checklist

- [ ] `/api/health` green
- [ ] Login works; `/api/auth/me` returns permissions
- [ ] Migrations applied (`npm run migration:show`)
- [ ] eBay OAuth callback reachable (if integrations used)
- [ ] Background queues processing (check logs for processor activity)
- [ ] Update CHANGELOG.md and [/docs/handover/current-state.md](../handover/current-state.md)
