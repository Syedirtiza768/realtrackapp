#!/usr/bin/env bash
set -euo pipefail

# Deploy the Compose-managed production stack without leaving a second backend
# queue consumer behind. A detached `docker compose run -d backend` gets a
# generated name and can continue consuming BullMQ jobs with stale code.
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-realtrackapp}"
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
SERVICE_PREFIX="${PROJECT_NAME}-backend-"

command -v docker >/dev/null 2>&1 || {
  echo "docker is required" >&2
  exit 1
}

mapfile -t stale_containers < <(
  docker ps -a \
    --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
    --filter "label=com.docker.compose.service=backend" \
    --format '{{.Names}}' \
    | while read -r name; do
        case "$name" in
          "${SERVICE_PREFIX}"[0-9]*) ;;
          *) printf '%s\n' "$name" ;;
        esac
      done
)

if ((${#stale_containers[@]})); then
  echo "Removing stale Compose backend containers: ${stale_containers[*]}"
  docker rm -f "${stale_containers[@]}"
fi

docker compose -p "$PROJECT_NAME" "${COMPOSE_FILES[@]}" up -d --build --remove-orphans

mapfile -t unexpected_containers < <(
  docker ps -a \
    --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
    --filter "label=com.docker.compose.service=backend" \
    --format '{{.Names}}' \
    | while read -r name; do
        case "$name" in
          "${SERVICE_PREFIX}"[0-9]*) ;;
          *) printf '%s\n' "$name" ;;
        esac
      done
)

if ((${#unexpected_containers[@]})); then
  echo "Unexpected Compose backend containers remain: ${unexpected_containers[*]}" >&2
  exit 1
fi

docker compose -p "$PROJECT_NAME" "${COMPOSE_FILES[@]}" ps
