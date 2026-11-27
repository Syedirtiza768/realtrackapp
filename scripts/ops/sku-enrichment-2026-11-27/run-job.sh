#!/bin/bash
# usage: [APPLY=1] [ENH_*=...] ./run-job.sh <script-in-/work> [args...]
# Runs ONE one-off backend container from the live compose file set (the running backend service is not touched).
# The scripts are mounted at /work from /home/ubuntu/sku-enrich-2026-11-27 on the server.
set -e
W=/home/ubuntu/sku-enrich-2026-11-27
LABEL=$(sudo docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' realtrackapp-backend-1)
FARGS=()
IFS=, read -ra FILES <<< "$LABEL"
for f in "${FILES[@]}"; do FARGS+=(-f "$f"); done
cd /home/ubuntu/realtrackapp
exec sudo docker compose -p realtrackapp "${FARGS[@]}" run --rm --no-deps -T -v "$W:/work" \
  -e APPLY="${APPLY:-0}" -e ENH_CONCURRENCY="${ENH_CONCURRENCY:-6}" -e ENH_LIMIT="${ENH_LIMIT:-0}" -e ENH_OUT="${ENH_OUT:-enh_results.jsonl}" \
  --entrypoint node backend "$@"
