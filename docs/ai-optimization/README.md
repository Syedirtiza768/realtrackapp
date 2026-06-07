# AI Listing Optimization — Operator Guide

Production multi-model routing, quality gates, and self-learning for eBay Motors
enrichment. Full architecture: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Pipeline enrichment report

After `scripts/ebay-enrichment-pipeline.mjs` (or UI upload → BullMQ job), read
`output/pipeline-*/enrichment-report-*.json`:

| Field | Meaning |
|-------|---------|
| `totalAiEnriched` / `totalProcessed` | Parts enriched by OpenRouter (structured JSON) |
| `totalFallbackEnrichment` / `totalFailedEnrichment` | Parts that used rule-based fallback titles/descriptions |
| `totalListingsGenerated` | Parts written to US/AU/DE templates (includes fallback) |
| `enrichmentMode` | `ai`, `fallback`, `mixed`, or `none` |

If OpenRouter validation fails, the pipeline still emits listings using fallback
logic — check `errors[]` for probe details. GridX Connect inputs map the
**Description** column through `extractPartNameFromDescription()` so fallback
titles are not the raw donor paragraph.

**AU/DE localization:** After AI enrichment, a second pass localizes AU and DE
template copy (titles, HTML descriptions, marketplace-specific policy tabs). Report
field `localization` tracks AI-translated vs rule-only counts per marketplace.

**UI:** Pipeline job detail (`/pipeline`) shows `enrichmentMode`, OpenRouter probe
errors, and localization stats in the Enrichment status panel (sourced from job
`stageDetails` after the report is written).

Docker Compose mounts `./.env` at `/app/.env` so the pipeline child process and
script file loader see `OPENAI_*` / `EBAY_*` keys in container runs.

## Quick reference

| Lane | Default model | Use when |
|------|---------------|----------|
| `default` | `openai/gpt-4.1-mini` | 90%+ of parts |
| `flagship` | `google/gemini-2.5-flash` | Price ≥ $200, engines, transmissions |
| `bulk` | `deepseek/deepseek-chat-v3-0324` | Overnight / cost-sensitive runs |
| `escalation` | `google/gemini-2.5-flash` | One retry after hard validation fail |

## Configuration

Policy file: `config/ai-routing-policy.json` (seed: `config/ai-routing-policy.v0.seed.json`).

Env fallbacks when policy is absent — see
[environment-variables.md](../development/environment-variables.md).

## Rollback

1. Set `AI_ROUTING_POLICY_PATH` to a previous policy file (e.g. `config/ai-routing-policy.v0.seed.json`).
2. Restart backend / re-run pipeline.
3. Or set `OPENAI_MODEL_DEFAULT=openai/gpt-4.1-mini` and remove policy file.

## Canary rollout

When `AI_OPTIMIZER_ENABLED=true`, new policies apply to `AI_OPTIMIZER_CANARY_PERCENT`
(default 10%) of SKUs first (deterministic hash). Increase 10 → 50 → 100 after review.

## Human pins

Add ops overrides in policy `pins` — optimizer will not override pinned segments:

```json
"pins": {
  "complete_engine|*": { "lane": "flagship", "model": "google/gemini-2.5-flash" }
}
```

## Advisor mode (Phase 2)

```bash
node scripts/ai-optimize-routing.mjs
```

Writes `docs/ai-optimization/routing-recommendations-YYYY-MM-DD.json`.
Use `--apply` to write an updated `config/ai-routing-policy.json` (human review first).

## Regression check

```bash
# Offline gate (CI-safe, uses cached benchmark artifact)
node scripts/model-comparison/regression-check.mjs

# Live re-run (requires OPENAI_API_KEY)
node scripts/model-comparison/run-comparison.mjs only=openai/gpt-4.1-mini
node scripts/model-comparison/rebuild-summary.mjs
```

Expect composite ≥ 95, MPN fidelity 8/8. CI workflow: `.github/workflows/ai-routing-regression.yml`.

## Observability

- Backend: `ai_run_logs` table (migration `1775700000000-AiRunLogsAndRoutingPolicy`)
- Pipeline: `output/ai-run-logs.json` per run
- Metrics: cost/listing, first-pass rate, escalation rate, validation score
- API (requires `ai.routing.view`):
  - UI: `/settings/ai-routing` (`ai.routing.view`) — segment table, recommendations, policy
  - `GET /api/ai/routing/stats` — segment × model rewards + session cost by lane
  - `GET /api/ai/routing/recommendations` — advisor recommendations
  - `GET /api/ai/routing/policy` — active policy JSON
  - `POST /api/ai/routing/optimize` — run optimizer (`ai.routing.manage`)
- Policy history: `ai_routing_policy_history` table (optimizer writes on each version);
  CLI `--apply` also appends to `config/ai-routing-policy-history.json`

## Blocklist (never assigned)

- `amazon/nova-lite-v1`
- `anthropic/claude-3.5-haiku`
- `meta-llama/llama-3.3-70b-instruct`
