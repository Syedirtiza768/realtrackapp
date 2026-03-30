#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# RealTrackApp — Ubuntu Server Deploy / Fix Script
# Usage:  bash deploy.sh
# ───────────────────────────────────────────────────────────────
set -euo pipefail

BOLD=$(tput bold 2>/dev/null || true)
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

log()  { echo -e "${GREEN}${BOLD}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}${BOLD}[warn]${NC}   $*"; }
err()  { echo -e "${RED}${BOLD}[error]${NC}  $*"; }

# ── 1. Prerequisite checks ──────────────────────────────────────
log "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
  err "Docker not found. Install with:"
  echo "  curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker \$USER"
  echo "  Then log out/in and re-run this script."
  exit 1
fi

if ! docker compose version &>/dev/null 2>&1; then
  err "Docker Compose v2 not found. Install with:"
  echo "  sudo apt-get install docker-compose-plugin"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  err "Docker daemon is not running. Start it with: sudo systemctl start docker"
  exit 1
fi

log "Docker $(docker --version) — OK"

# ── 2. .env file setup ─────────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env not found — creating from .env.example"
  cp .env.example .env

  # Generate a secure random JWT_SECRET
  JWT=$(openssl rand -hex 32)
  sed -i "s|JWT_SECRET=CHANGE_ME_to_a_random_secret|JWT_SECRET=${JWT}|" .env
  log "Generated JWT_SECRET."

  # Set CORS to both localhost and production domain
  sed -i "s|CORS_ORIGIN=http://localhost:8050|CORS_ORIGIN=http://localhost:8050,https://mhn.realtrackapp.com,http://mhn.realtrackapp.com|" .env

  warn "Review .env and fill in any missing values (eBay keys, OpenAI, etc.):"
  echo "  nano .env"
else
  log ".env found."
  # Validate required secrets
  if grep -q "CHANGE_ME" .env; then
    err "JWT_SECRET is still set to CHANGE_ME. Fix it with:"
    echo "  sed -i \"s|JWT_SECRET=CHANGE_ME.*|JWT_SECRET=\$(openssl rand -hex 32)|\" .env"
    exit 1
  fi
fi

# ── 3. Pull / build ────────────────────────────────────────────
log "Building images..."
docker compose build --no-cache

# ── 4. Stop old containers (graceful) ─────────────────────────
log "Stopping old containers..."
docker compose down --remove-orphans || true

# ── 5. Start everything ────────────────────────────────────────
log "Starting services..."
docker compose up -d

# ── 6. Wait for backend health ─────────────────────────────────
log "Waiting for backend to be healthy..."
MAX_WAIT=60
WAITED=0
until curl -sf http://127.0.0.1:4191/api/health &>/dev/null; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    err "Backend did not become healthy in ${MAX_WAIT}s. Check logs:"
    echo "  docker compose logs backend --tail=50"
    docker compose logs backend --tail=30
    exit 1
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  echo -n "."
done
echo ""
log "Backend is healthy at http://127.0.0.1:4191/api/health"

# ── 7. Status summary ──────────────────────────────────────────
echo ""
log "Container status:"
docker compose ps

echo ""
log "Deploy complete!"
echo -e "  Frontend:  ${BOLD}http://mhn.realtrackapp.com${NC}  (or http://SERVER_IP:8050)"
echo -e "  Backend:   ${BOLD}http://127.0.0.1:4191${NC}"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f backend    # follow backend logs"
echo "  docker compose logs -f            # follow all logs"
echo "  docker compose restart backend    # restart backend only"
echo "  docker compose down               # stop everything"
