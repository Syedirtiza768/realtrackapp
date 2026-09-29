#!/bin/bash
# pricing-retry-watcher.sh — finish the pricing pass when the eBay quota frees.
#
# Runs on the EC2 host (not inside the container) and drives the backend
# container. Polls the Browse API every 15 minutes; on the first successful
# probe it re-prices only the rows a previous run could not evaluate
# (--retry-failed), regenerates the PartsBazar360 exports, and stops.
#
# Launch detached:
#   nohup /home/ubuntu/realtrackapp/scripts/pricing-retry-watcher.sh \
#     > /home/ubuntu/realtrackapp/output/pricing-retry-watcher.log 2>&1 &
set -u

CONTAINER=realtrackapp-backend-1
LOG=/home/ubuntu/realtrackapp/output/pricing-retry.log
MAX_POLLS=120          # 15 min apart -> gives up after ~30 hours
SLEEP_SECONDS=900

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG"; }

log "watcher started; polling the eBay Browse quota every ${SLEEP_SECONDS}s"

for attempt in $(seq 1 "$MAX_POLLS"); do
  # Capture the probe's own exit code: piping to tail here would mask it.
  probe_output=$(docker exec "$CONTAINER" sh -lc 'cd /app && node scripts/ebay-quota-probe.mjs' 2>&1)
  status=$?
  probe=$(printf '%s\n' "$probe_output" | tail -1)

  if [ "$status" -eq 0 ]; then
    log "quota available after ${attempt} poll(s) (${probe}) — starting --retry-failed"

    if docker exec "$CONTAINER" sh -lc 'cd /app && node scripts/price-enrich-catalog.mjs --retry-failed' >> "$LOG" 2>&1; then
      log "retry-failed finished"
    else
      log "RETRY FAILED (non-zero exit) — see the output above"
      log "WATCHER_DONE_WITH_ERRORS"
      exit 1
    fi

    if docker exec "$CONTAINER" sh -lc 'cd /app && node scripts/create-partsbazar360-csv.mjs' >> "$LOG" 2>&1; then
      log "PartsBazar360 exports regenerated"
    else
      log "EXPORT REGENERATION FAILED — see the output above"
      log "WATCHER_DONE_WITH_ERRORS"
      exit 1
    fi

    # Any row still unevaluated means the quota ran out again mid-retry.
    remaining=$(docker exec "$CONTAINER" sh -lc 'cd /app && node -e "const d=require(\"/app/output/ebay-pipeline/napa_pricing_evidence.json\");console.log(Object.values(d.items).filter(r=>r.lookupFailed).length)"' 2>/dev/null | tail -1)
    log "rows still unevaluated after this retry: ${remaining}"
    log "WATCHER_DONE"
    exit 0
  fi

  log "poll ${attempt}/${MAX_POLLS}: ${probe}"
  sleep "$SLEEP_SECONDS"
done

log "gave up after ${MAX_POLLS} polls without the quota freeing"
log "WATCHER_DONE_WITH_ERRORS"
exit 1
