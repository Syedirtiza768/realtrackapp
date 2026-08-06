# Deployment & infra

**Last reviewed:** 2026-08-06

## Local dev
- Frontend: `npm run dev` (Vite, per `CLAUDE.md` proxies `/api` to the backend)
- Backend: `cd backend && npm run start:dev` (NestJS watch mode)

## Docker
- `docker-compose.yml` — full local/dev stack: `postgres:16-alpine`,
  `redis:7-alpine`, backend, frontend, plus other services (see the file directly
  for the current full list — not enumerated here to avoid drift)
- `docker-compose.prod.yml` — production compose overrides
- `Dockerfile` (root) and `backend/Dockerfile` — separate images for frontend and
  backend
- `nginx.conf` at the repo root — reverse proxy / static file serving config;
  there's git history of nginx location-block ordering issues affecting image
  proxying (e.g. `51c8f71 fix(nginx): add dedicated location for image proxy
  before static-file regex`) — check this file's location-block order before
  editing it
- `ecosystem.config.cjs` — PM2 process config (referenced but not verified how it
  relates to the Docker deployment path in this pass)

## Environment
- `.env.example` is the canonical list of environment variables and their
  recommended defaults (documented for an AWS t3.medium: 2 vCPU / 4 GB RAM,
  `NODE_OPTIONS=--max-old-space-size=1536`)
- Never commit `.env` — already gitignored

## Deep dives (pre-existing, more detail than this note)
- [[../operations/SETUP|Setup]], [[../architecture/deployment|Architecture: deployment]]
- [[../operations/deployment-runbook|Deployment runbook]]
- [[../operations/ENVIRONMENT_VARIABLES|Environment variables (operations)]] and
  [[../development/environment-variables|Environment variables (development)]] —
  two separate files; check dates, they may have drifted apart
- [[../SETUP_AND_DEPLOYMENT|Legacy SETUP_AND_DEPLOYMENT.md]] (root-level, older)
- [[../operations/TROUBLESHOOTING|Troubleshooting]]

## Open questions / TODO
- Not verified in this pass: whether the deploy process goes through a wrapper
  script analogous to PartsBazar360's `update.sh`, or a bare `docker compose up
  --build` / PM2 restart. Confirm and document here before assuming either way —
  PartsBazar360's own docs warn that a bare `docker compose up --build` can skip a
  necessary nginx reload, and this repo's `nginx.conf` has its own history of
  location-block ordering bugs, so the same class of mistake is plausible here.
- Two environment-variable docs (`operations/ENVIRONMENT_VARIABLES.md` and
  `development/environment-variables.md`) were not diffed against each other or
  against `.env.example` in this pass.
