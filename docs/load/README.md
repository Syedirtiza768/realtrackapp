# Load testing baseline (k6)

Lightweight smoke/load script for multi-user readiness benchmarking.

## Prerequisites

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed locally
- Backend running (`npm run start:dev` in `backend/` or Docker on port 4191)

## Quick run

```bash
# Public endpoints only (health + runtime)
k6 run scripts/load/k6-baseline.mjs

# With auth — also hits GET /api/listings
K6_AUTH_EMAIL=admin@realtrack.local K6_AUTH_PASSWORD=ChangeMe123! \
  k6 run scripts/load/k6-baseline.mjs

# Custom target
BASE_URL=http://localhost:4191 k6 run --vus 25 --duration 3m scripts/load/k6-baseline.mjs
```

## Default profile

| Setting | Value |
|---------|-------|
| Ramp | 0 → 10 VUs over 30s |
| Steady | 10 VUs for 1m |
| Ramp down | 30s |
| Think time | 0.5–1s between iterations |

## Thresholds (fail run if exceeded)

- `http_req_failed` < 5%
- `health_duration` p95 < 500ms

## Export results

```bash
k6 run --summary-export=docs/load/baseline-latest.json scripts/load/k6-baseline.mjs
```

Compare `baseline-latest.json` across deploys to track regressions.

## Related endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | Public | Liveness (DB + heap) |
| `GET /api/health/runtime` | Public | Uptime, memory, pool stats |
| `GET /api/health/queues` | `users.view` | BullMQ queue depths |
