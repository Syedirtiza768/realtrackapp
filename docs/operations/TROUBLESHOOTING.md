# Troubleshooting

> **Source**: Extracted from `docs/operations/deployment-runbook.md` (2026-05-29).
> For deployment architecture, see [/docs/architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md).
> For setup instructions, see [SETUP.md](SETUP.md).

---

## Common Issues

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Backend OOM during catalog import | Heap too small | Raise `NODE_OPTIONS=--max-old-space-size` to fit RAM |
| Backend won't start, "JWT_SECRET is required" | Missing env | Set `JWT_SECRET` in `.env` |
| 401 loops in UI | Expired/invalid JWT | Re-login; check `JWT_SECRET` unchanged across restarts |
| CORS errors | Origin not allow-listed | Add to `CORS_ORIGIN` |
| Migration fails midway | Non-reversible/partial | `migrationsTransactionMode: 'each'` isolates each; fix + re-run |

---

## Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose ps

# Check logs
docker compose logs postgres

# Verify connection
docker compose exec postgres pg_isready -U postgres
```

## Migration Failures

```bash
# Check migration status
cd backend
npm run migration:show

# If stuck, revert and retry
npm run migration:revert
npm run migration:run
```

## Redis Connection Issues

```bash
# Check Redis
docker compose logs redis
docker compose exec redis redis-cli ping
```

## Backend Won't Start

```bash
# Check for port conflicts
lsof -i :4191

# Check logs
docker compose logs backend

# Verify environment
docker compose exec backend env | grep DB_
```

## Frontend Won't Connect to API

```bash
# Check Vite proxy config (vite.config.ts)
# Verify backend is running
curl http://localhost:4191/api/health

# Check browser console for CORS errors
```

## eBay Integration Issues

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| OAuth callback fails | Wrong `EBAY_REDIRECT_URI` | Verify RuName matches eBay app config |
| Token refresh fails | Expired/invalid token | Reconnect eBay account; check `EBAY_ENVIRONMENT` |
| Publish fails with policy errors | Missing/stale business policies | Sync policies via `/api/integrations/ebay/:id/sync` |
| SellerPundit 504 errors | Timeout on SP API | Published via `auto` fallback mode; extends nginx/Vite timeouts |

---

## Rollback Procedure

1. `git checkout <previous-tag>` and `docker compose up -d --build`
2. **DB migrations**: roll forward preferred. To revert last migration: `cd backend && npm run migration:revert`
3. Take a `pg_dump` backup first: `docker compose exec postgres pg_dump -U postgres -Fc listingpro > backup-$(date +%F).dump`
4. Restore from backup if migration corrupted data

---

## Post-Deploy Verification Checklist

- [ ] `/api/health` returns 200
- [ ] Login works; `/api/auth/me` returns permissions
- [ ] Migrations applied (`npm run migration:show`)
- [ ] eBay OAuth callback reachable (if integrations used)
- [ ] Background queues processing (check logs for processor activity)
- [ ] Update CHANGELOG.md and [/docs/context/CURRENT_STATE.md](../context/CURRENT_STATE.md)

---

*Consolidated & reorganized: 2026-06-06.*
