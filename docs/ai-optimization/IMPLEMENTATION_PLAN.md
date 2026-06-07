# AI Listing Optimization System — Implementation Plan

**Status:** Phases 0–4 code complete (2026-06-07); Phase 5 ops ongoing  
**Last updated:** 2026-06-07  
**Operator guide:** [README.md](./README.md)  
**Related docs:**
- [Model comparison report](../model-comparison/REPORT.md) — benchmark evidence and model scores
- [Metrics summary](../model-comparison/metrics-summary.json) — raw per-model numbers
- [Sample payload](../model-comparison/sample-payload.json) — regression test fixture

---

## 1. Purpose

This plan defines how to implement a **production-grade, self-improving AI listing system** for eBay Motors enrichment in RealTrackApp. It combines:

1. **Multi-model routing** — assign the cheapest model that can succeed for each part
2. **Quality gates + escalation** — validate output; retry once with a stronger model on failure
3. **Deterministic guards** — code-level fixes (title length, MPN fidelity, brand normalization)
4. **eBay API truth layer** — category and fitment validation when credentials exist
5. **Self-learning optimizer** — learn from approve/reject/publish outcomes; tune routing over time

**Goal:** maximize listing quality, fitment coverage, and publish success while minimizing cost and manual cleanup — and **improve automatically** as production data accumulates.

### 1.1 Implementation snapshot

| Area | Status | Notes |
|------|--------|-------|
| Multi-model router | **Done** | `ModelRouter` (TS) + `scripts/lib/model-router.mjs`; policy `config/ai-routing-policy.json` |
| Deterministic guards | **Done** | `listing-guards.ts` + `scripts/lib/listing-quality.mjs` |
| Quality validator + escalation | **Done** | One retry → gemini; wired in pipeline + `EnrichmentPipeline` |
| Default model switch | **Done** | `openai/gpt-4.1-mini` (env + code); `OPENAI_CHAT_MODEL` is alias |
| `ai_run_logs` + migration | **Done** | `1775700000000-AiRunLogsAndRoutingPolicy.ts`; run `npm run migration:run` |
| Outcome backfill | **Done** | Approve/reject, publish, catalog + motors compliance scores → `ai_run_logs` |
| Advisor CLI | **Done** | `scripts/ai-optimize-routing.mjs` |
| Nightly optimizer | **Done (opt-in)** | `AiOptimizerService` @ 2am when `AI_OPTIMIZER_ENABLED=true` |
| eBay truth layer | **Done (opt-in)** | `EbayTaxonomyTruthService` when `AI_TAXONOMY_VALIDATION_ENABLED=true` + cached `ebay_categories` |
| Ingestion path parity | **Done** | `VisionEnrichmentPipeline` + ingestion processor use router/validator |
| Per-lane cost dashboard | **Done** | API `costByLane` + UI `/settings/ai-routing` |
| Production validation | **Ops** | Full 167-part run + ≥100 logged outcomes before enabling auto-tune |

**Deploy checklist:** apply migration → set `OPENAI_MODEL_DEFAULT` → run regression harness → run pipeline on sample file.

---

## 2. Evidence base (model comparison summary)

Benchmark run on **8 representative parts** from `docs/2008 Mercedes C350 AMG.xlsx` using the **exact production prompt** from `scripts/ebay-enrichment-pipeline.mjs`. Full details in [REPORT.md](../model-comparison/REPORT.md).

### 2.1 Working models (production-viable at batch size 8)

| Model | Composite | Fitment rows (avg) | Cost / listing | Cost / 1k | Latency (8 parts) | Role |
|---|---|---|---|---|---|---|
| `google/gemini-2.5-flash` | 100 | 30.3 | $0.0074 | $7.44 | 83s | Flagship / max fitment |
| `openai/gpt-4.1-mini` | 98 | 15.3 | $0.0021 | $2.10 | 121s | **Primary default** |
| `deepseek/deepseek-chat-v3-0324` | 94 | 18.8 | $0.0012 | $1.17 | 308s | Bulk / cost lane |
| `minimax/minimax-m3` | 88 | 9.5 | $0.0024 | $2.41 | 315s | Former default — replaced |
| `openai/gpt-4o-mini` | 80 | 3.1 | $0.0004 | $0.40 | 69s | Text-only cleanup only |

### 2.2 Failed models (blocked from structured batch enrichment)

| Model | Failure mode |
|---|---|
| `amazon/nova-lite-v1` | Truncates at ~5,120 output-token provider ceiling |
| `anthropic/claude-3.5-haiku` | Ignores JSON mode; interleaves prose; stops early |
| `meta-llama/llama-3.3-70b-instruct` | Truncated JSON; ~10 min latency |

### 2.3 Integrity findings (all working models)

- **100% MPN fidelity** — no fabricated part numbers
- **Zero cross-make fitment hallucination** on W204 Mercedes parts
- gpt-4.1-mini: one title exceeded 80 chars (86) — needs deterministic trim guard

### 2.4 Production gaps (updated 2026-06-07)

**Resolved by Phases 0–3:**

- Default model is now **`openai/gpt-4.1-mini`** via `ModelRouter` (replaces `minimax/minimax-m3`)
- Multi-lane routing, deterministic guards, quality gate, and one-shot escalation are live
- Learning dataset (`ai_run_logs`) + advisor CLI + opt-in nightly optimizer are in place

**Still open:**

- eBay API credentials **not configured** — category falls back to `262124`; fitment is model-asserted (Phase 4)
- DE marketplace: aspect names localized; title/description remain English (Phase 4 translation)
- `enhancement_id` not linked on enhancement *create* (only backfill on approve/reject)
- Guard auto-fixes not written to `compliance_audit_logs`
- No CI regression job; no UI dashboard for segment → model rewards
- Optimizer does not yet append rows to `ai_routing_policy_history` on each policy write

---

## 3. Target architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INPUT (GridX / parts row)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ModelRouter.select(part, context)                                       │
│  • Reads routing_policy.json (learned) + env fallbacks                   │
│  • Segments: partType × priceBand × runMode (default|bulk|flagship)      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AI Enrichment (production prompt, json_object)                          │
│  Lane: default | flagship | bulk | escalation                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Deterministic Guards (always code, never LLM)                            │
│  • Title ≤ 80 chars  • MPN match  • Brand normalize  • Disclaimer inject │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ListingQualityValidator (quality gate)                                  │
│  Hard fails → escalate | Soft fails → log | Pass → continue              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                          fail (max 1 escalation)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  eBay API Validation (when creds available)                              │
│  Category suggest • Required aspects • Compatibility check               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Marketplace Output (US / AU / DE)                                       │
│  generateUSMotorsOutput | generateAUOutput | generateDEOutput          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AiRunLog + outcome feedback (approve / reject / publish)                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                          nightly / post-batch
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AiOptimizer → routing_policy.json (versioned, canary rollout)           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Design principles

| Principle | Implementation |
|---|---|
| Route cheap first | Default lane before flagship; escalate only on failure |
| Never trust LLM output blindly | Validator + guards on every response |
| Learn offline | Nightly optimizer; no mid-request prompt mutation |
| Version everything | `promptVersion`, `routing_policy.version`, audit trail |
| Fail safe | Blocklist unreliable models; human override pins; rollback via env |
| Trust code over docs | Update this plan and REPORT.md when behavior changes |

---

## 4. Model assignment (task → model)

### 4.1 Primary lanes

| Task | Model | When |
|---|---|---|
| **Default full enrichment** (title + description + specifics + fitment) | `openai/gpt-4.1-mini` | 90%+ of parts |
| **Flagship enrichment** | `google/gemini-2.5-flash` | price ≥ threshold, engines, complete assemblies, fitment-critical high-value SKUs |
| **Bulk enrichment** | `deepseek/deepseek-chat-v3-0324` | Scheduled overnight runs; cost-sensitive catalogs; higher concurrency |
| **Text-only cleanup** | `openai/gpt-4o-mini` | Re-title, HTML polish — **never fitment generation** |
| **Escalation (one retry)** | `google/gemini-2.5-flash` | After hard validation fail on default/bulk |
| **Fitment/category truth** | eBay Taxonomy + Compatibility API | Not an LLM — validate and correct |

### 4.2 Routing rules (initial, before learning)

```typescript
function selectLane(part: PartContext, runMode: RunMode): Lane {
  if (runMode === 'bulk') return 'bulk';
  if (part.price >= FLAGSHIP_MIN_PRICE) return 'flagship';
  if (FLAGSHIP_PART_TYPES.some(t => part.partType.includes(t))) return 'flagship';
  return 'default';
}

// FLAGSHIP_MIN_PRICE = 200 (env, tunable by optimizer)
// FLAGSHIP_PART_TYPES = ['complete_engine', 'transmission', 'ecu', 'abs_module', ...]
```

Part type extracted from description keywords or AI `type` field (same taxonomy as comparison harness).

### 4.3 Escalation chain

```
default:  gpt-4.1-mini  →  (hard fail)  →  gemini-2.5-flash  →  manual queue
bulk:     deepseek      →  (hard fail)  →  gpt-4.1-mini      →  gemini  →  manual queue
flagship: gemini        →  (hard fail)  →  manual queue (no second escalation)
```

**Max one escalation per part** to control cost.

### 4.4 Blocklist (never assign)

- `amazon/nova-lite-v1`
- `anthropic/claude-3.5-haiku`
- `meta-llama/llama-3.3-70b-instruct`

`minimax/minimax-m3` — remove as default; optional fallback only if explicitly configured.

### 4.5 Per-model runtime tuning

| Model | Batch size | Concurrency | max_tokens |
|---|---|---|---|
| gpt-4.1-mini | 5–8 | 2 | uncapped (production default) |
| gemini-2.5-flash | 4–6 | 2 | uncapped or 40k+ for large fitment |
| deepseek-v3-0324 | 5–8 | 3–4 | uncapped |
| gpt-4o-mini | 8+ | 4 | 8k (text-only tasks) |

---

## 5. Quality gate and deterministic guards

### 5.1 Deterministic guards (post-AI, pre-validation)

Implement in `listing-guards.ts` / `listing-guards.mjs`:

| Guard | Rule |
|---|---|
| Title length | Hard-trim to ≤ 80 chars; preserve year, make, chassis, MPN suffix |
| MPN fidelity | Normalize spaces; must match input `partNumber` (no fabrication) |
| Brand | `Mercedes` → `Mercedes-Benz`; known OEM map |
| Condition language | Force "Used OEM" / "No Warranty" for salvage pipeline |
| Disclaimer | Inject "Please verify part number compatibility before purchasing" if missing |
| Fitment dedup | Collapse duplicate `Year\|Make\|Model` MVL rows |

Port logic from `scripts/model-comparison/run-comparison.mjs` → `scoreItem()` as the validator core.

### 5.2 Quality gate (ListingQualityValidator)

**Hard fails** (trigger escalation or reject):

- JSON parse failure / wrong item count in batch
- MPN mismatch vs input
- Title > 80 after guard (should not happen)
- Missing required specifics: Brand, MPN, Type, Placement on Vehicle
- Cross-make fitment (e.g. non-Mercedes on W204 Mercedes part)
- Implausible years (outside known platform range, e.g. W204 2008–2014)

**Soft fails** (log only; may trigger flagship routing learning):

- Fitment rows < `fitmentMinRows` (default 5)
- Description missing HTML structure or compatibility section
- No chassis code in title or fitment

**Composite score (0–100):** same weighting as comparison harness for consistency.

```typescript
interface ValidationResult {
  pass: boolean;
  score: number;
  hardFails: string[];
  softFails: string[];
  escalate: boolean;
}
```

---

## 6. Self-improving / self-learning system

### 6.1 Overview

Learning is **offline and aggregated** — not per-request prompt mutation.

```
Runtime:  Router → AI → Guards → Validator → Publish
                ↓         ↓         ↓          ↓
            AiRunLog ← outcomes (approve, reject, eBay errors)
                ↓
Nightly:  AiOptimizer → routing_policy.json (versioned)
                ↓
Next run: ModelRouter reads policy vN (with canary %)
```

### 6.2 Feedback signals

| Signal | Weight | Source (existing) |
|---|---|---|
| Human approved enhancement | Strong + | `ai_enhancements.approved_at` |
| Human rejected + reason | Strong − | `ai_enhancements.rejection_reason` |
| User edited field before approve | Gold | Diff: `{ field, aiValue, finalValue }` |
| Passed gate on first attempt | Medium + | `AiRunLog.passedGate` |
| Required escalation | Medium − | `AiRunLog.escalated` |
| eBay publish accepted | Strong + | Publish pipeline |
| eBay publish rejected (category/fitment) | Strong − | eBay API error payload |
| Listing views/sales (optional, later) | Weak + | eBay analytics |

**Do not learn from:** parse failures (reliability, not quality), unreviewed auto-publish until publish confirms, or runs with missing outcome data.

### 6.3 AiRunLog schema (new table)

```sql
CREATE TABLE ai_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Context
  sku VARCHAR(100),
  part_number VARCHAR(80),
  part_type VARCHAR(80),
  price NUMERIC(10,2),
  donor_vehicle JSONB,
  marketplace VARCHAR(10),          -- US | AU | DE
  batch_id UUID NULL,
  enhancement_id UUID NULL REFERENCES ai_enhancements(id),
  -- Routing
  lane VARCHAR(20) NOT NULL,        -- default | flagship | bulk | escalation | text
  model VARCHAR(80) NOT NULL,
  attempt SMALLINT NOT NULL DEFAULT 1,
  prompt_version VARCHAR(40) NOT NULL,
  routing_policy_version INT NULL,
  -- Metrics
  input_tokens INT,
  output_tokens INT,
  cost_usd NUMERIC(10,6),
  latency_ms INT,
  validation_score SMALLINT,
  hard_fails JSONB DEFAULT '[]',
  soft_fails JSONB DEFAULT '[]',
  escalated BOOLEAN DEFAULT FALSE,
  passed_gate BOOLEAN DEFAULT FALSE,
  fitment_row_count INT,
  -- Outcomes (backfilled async)
  human_approved BOOLEAN NULL,
  human_rejected BOOLEAN NULL,
  rejection_reason TEXT NULL,
  published BOOLEAN NULL,
  publish_error TEXT NULL,
  ebay_category_id VARCHAR(20) NULL,
  field_edits JSONB NULL,           -- [{ field, aiValue, finalValue }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_run_logs_part_type ON ai_run_logs(part_type);
CREATE INDEX idx_ai_run_logs_model ON ai_run_logs(model);
CREATE INDEX idx_ai_run_logs_created ON ai_run_logs(created_at);
CREATE INDEX idx_ai_run_logs_sku ON ai_run_logs(sku);
```

### 6.4 Optimizer algorithm

**Job:** `AiOptimizerService` (NestJS) + `scripts/ai-optimize-routing.mjs` (cron/CLI)

Run **nightly** or after each full pipeline file completes.

#### A. Segment statistics

Group by: `segment_key = partType | priceBand | marketplace | runMode`

For each segment × model, track:

- `attempts`, `firstPassRate`, `escalationRate`
- `avgCost`, `avgValidationScore`
- `humanApprovalRate`, `publishSuccessRate`
- `compositeReward`

#### B. Reward function

```
reward = 0.40 × humanApprovalRate
       + 0.30 × firstPassRate
       + 0.20 × publishSuccessRate
       + 0.10 × (1 - normalizedCost)
       - 0.50 × escalationRate
       - 1.00 × hardFailRate
```

#### C. Selection policy

- **ε-greedy** or **Thompson sampling** within allowed models only
- **Prior rewards** from model comparison (§2.1) until `AI_LEARNING_MIN_SAMPLES` (default 20) per segment
- Never select blocklisted models

#### D. Threshold tuning

| Threshold | Initial | Learns from |
|---|---|---|
| `flagshipMinPrice` | $200 | Approval + escalation on $150–250 band |
| `fitmentMinRows` | 5 | Publish rejections citing compatibility |
| `autoApproveMinScore` | 85 | Human rejection rate above score |
| Batch size per model | see §4.5 | Truncation / parse-fail rate |

Apply threshold changes only if ≥20 samples and improvement >5%.

#### E. Output: routing policy file

Path: `config/ai-routing-policy.json` (or DB table `ai_routing_policies`)

```json
{
  "version": 1,
  "generatedAt": "2026-06-07T12:00:00.000Z",
  "canaryPercent": 10,
  "segments": {
    "complete_engine|*": {
      "lane": "flagship",
      "model": "google/gemini-2.5-flash"
    },
    "window_regulator|50-100|US": {
      "lane": "default",
      "model": "openai/gpt-4.1-mini"
    },
    "door_hinge|*|bulk": {
      "lane": "bulk",
      "model": "deepseek/deepseek-chat-v3-0324"
    }
  },
  "thresholds": {
    "flagshipMinPrice": 200,
    "fitmentMinRows": 5,
    "autoApproveMinScore": 85
  },
  "escalationChain": [
    "openai/gpt-4.1-mini",
    "google/gemini-2.5-flash"
  ],
  "blocklist": [
    "amazon/nova-lite-v1",
    "anthropic/claude-3.5-haiku",
    "meta-llama/llama-3.3-70b-instruct"
  ]
}
```

### 6.5 Safety guardrails

| Guard | Rule |
|---|---|
| Policy versioning | Every change increments `version`; store history in `ai_routing_policy_history` |
| Canary rollout | New policy applies to `AI_OPTIMIZER_CANARY_PERCENT` (default 10%) first |
| Floor models | Optimizer cannot assign blocklisted models |
| Ceiling cost | If avg cost/listing > budget, force bulk lane |
| Human pins | Ops override `{ segment → model }` in config; optimizer cannot override pins |
| Rollback | `AI_ROUTING_POLICY_PATH` points to previous version file |
| Regression baseline | Monthly re-run `scripts/model-comparison/run-comparison.mjs` on frozen 8-part sample |

### 6.6 Prompt drift detection (weekly)

- Rolling 7-day validator score trend per model
- New hard-fail type frequency
- Human edit rate by field (title vs fitment vs specifics)

If gpt-4.1-mini title-edit rate jumps >15% week-over-week → alert and freeze policy updates until investigated.

---

## 7. eBay API integration (truth layer)

**Current state:** `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` not in `.env`; pipeline uses `fallbackCategoryMatch()` and default category `262124`.

### 7.1 Required when creds added

1. **Category suggestion** — replace default `262124` with Taxonomy API result
2. **Required aspects** — fetch per category; validator checks completeness
3. **Compatibility validation** — cross-check model fitment rows where API supports it
4. **Publish error feedback** — map eBay rejection codes → `AiRunLog.publish_error` for learning

### 7.2 Env vars (document in `docs/development/environment-variables.md`)

```
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_SANDBOX=false
```

---

## 8. Marketplace output (US / AU / DE)

Existing generators in `scripts/ebay-enrichment-pipeline.mjs`:

| Marketplace | Currency transform | Aspect language | Notes |
|---|---|---|---|
| US | USD × 1.0 | English | eBay Motors SiteID |
| AU | AUD × 1.55 | English | Same title/description as US today |
| DE | EUR × 0.92 | German aspect names | VAT 19%; EAN "Nicht zutreffend"; **title/description still English** |

**Future (Phase 4):** optional DE translation pass for title/description using a dedicated translation model or API — separate from enrichment routing.

---

## 9. Code changes — file map

### 9.1 New files (shipped)

| Path | Purpose | Status |
|---|---|---|
| `backend/src/common/openai/model-router.ts` | Lane selection; reads policy + env | Done |
| `backend/src/common/openai/listing-quality.validator.ts` | Quality gate (port from comparison harness) | Done |
| `backend/src/common/openai/listing-guards.ts` | Deterministic post-processors | Done |
| `backend/src/common/openai/entities/ai-run-log.entity.ts` | Learning dataset ORM entity | Done |
| `backend/src/common/openai/ai-run-log.service.ts` | Persist runs; backfill outcomes | Done |
| `backend/src/common/openai/ai-optimizer.service.ts` | Nightly bandit + threshold tuner | Done |
| `backend/src/common/openai/ai-routing-policy.types.ts` | Policy JSON schema | Done |
| `backend/src/migrations/1775700000000-AiRunLogsAndRoutingPolicy.ts` | `ai_run_logs` + `ai_routing_policy_history` | Done |
| `backend/src/migrations/1775710000000-AddComplianceScoreToAiRunLogs.ts` | `compliance_score` on `ai_run_logs` | Done |
| `backend/src/common/openai/ebay-taxonomy-truth.service.ts` | Cached eBay category/aspect validation | Done |
| `src/components/settings/AiRoutingDashboardPage.tsx` | Admin UI at `/settings/ai-routing` | Done |
| `src/lib/aiRoutingApi.ts` | Frontend API client for routing endpoints | Done |
| `scripts/lib/model-router.mjs` | Pipeline-side router (mirrors TS rules) | Done |
| `scripts/lib/listing-quality.mjs` | Pipeline-side validator + guards | Done |
| `scripts/ai-optimize-routing.mjs` | Standalone optimizer CLI / cron | Done |
| `config/ai-routing-policy.json` | Active routing policy (v0 seed) | Done |
| `config/ai-routing-policy.v0.seed.json` | Rollback / baseline policy | Done |
| `docs/ai-optimization/README.md` | Operator guide: rollback, canary, pins | Done |

### 9.2 Modified files (shipped)

| Path | Change | Status |
|---|---|---|
| `scripts/ebay-enrichment-pipeline.mjs` | `enrichBatchWithRouting()`: router → guards → validator → escalation; `output/ai-run-logs.json` | Done |
| `backend/src/common/openai/openai.module.ts` | Registers router, validator, run-log, optimizer services | Done |
| `backend/src/common/openai/openai.service.ts` | Default `gpt-4.1-mini`; `OPENAI_TIMEOUT_MS` (120s) | Done |
| `backend/src/common/openai/openai.types.ts` | Lane model pricing for cost estimation | Done |
| `backend/src/common/openai/pipelines/enrichment.pipeline.ts` | Routed model; guards + validator + escalation + DB log | Done |
| `backend/src/channels/ai-enhancement.service.ts` | Backfill on approve/reject; `enhancement_id` on enrich; routed model defaults | Done |
| `backend/src/common/openai/ai-routing.controller.ts` | `GET/POST /api/ai/routing/*` stats, policy, optimizer | Done |
| `backend/src/common/openai/listing-guard-audit.service.ts` | Guard fixes → `compliance_audit_logs` | Done |
| `backend/src/common/openai/entities/ai-routing-policy-history.entity.ts` | Policy version history ORM | Done |
| `backend/src/common/openai/pipelines/vision-enrichment.pipeline.ts` | Vision ingestion: router + guards + validator + log | Done |
| `scripts/model-comparison/regression-check.mjs` | Offline CI regression gate | Done |
| `.github/workflows/ai-routing-regression.yml` | PR regression on openai/pipeline paths | Done |
| `backend/src/catalog-import/services/ebay-compliance.service.ts` | `recordPublishOutcome()` + `recordComplianceOutcome()` | Done |
| `backend/src/motors-intelligence/services/compliance-engine.service.ts` | Motors validation → `compliance_score` on latest run log | Done |
| `backend/src/common/openai/*.spec.ts` | Unit tests: reward, canary, guards | Done |
| `backend/.env.example` | AI routing + optimizer env vars | Done |
| `docs/development/environment-variables.md` | Document new vars | Done |
| `docs/model-comparison/REPORT.md` | Link to this plan | Done |
| `CHANGELOG.md` | Phase 1–3 foundation entry | Done |

### 9.3 Reuse from comparison harness

| Source | Target | Status |
|---|---|---|
| `scripts/model-comparison/run-comparison.mjs` → `scoreItem()` | `listing-quality.validator.ts` + `scripts/lib/listing-quality.mjs` | Done |
| `docs/model-comparison/sample-payload.json` | Regression test fixture | Done; CI `ai-routing-regression.yml` |
| `scripts/model-comparison/catalog-pricing.json` | Cost estimation in `openai.types.ts` | Done |

### 9.4 Remaining ops / optional backlog

| Path | Purpose | Status |
|---|---|---|
| Full 167-part validation run | Manual review + publish outcome data for optimizer | **Ops** — run pipeline when API key available |
| DE translation pass | Optional localized title/description | Not started |
| eBay listing performance signal | Weak learning from live listing metrics | Not started |
| Blocklist optimizer unit test | Assert optimizer skips blocklisted models | Not started |

---

## 10. Environment variables

```env
# ── Model lanes (fallback when policy file absent) ──
OPENAI_MODEL_DEFAULT=openai/gpt-4.1-mini
OPENAI_MODEL_FLAGSHIP=google/gemini-2.5-flash
OPENAI_MODEL_BULK=deepseek/deepseek-chat-v3-0324
OPENAI_MODEL_TEXT=openai/gpt-4o-mini
OPENAI_MODEL_ESCALATION=google/gemini-2.5-flash

# ── Routing thresholds (initial; optimizer may override via policy file) ──
OPENAI_MODEL_FLAGSHIP_MIN_PRICE=200
AI_FITMENT_MIN_ROWS=5
AI_AUTO_APPROVE_MIN_SCORE=85

# ── Learning system ──
AI_ROUTING_POLICY_PATH=config/ai-routing-policy.json
AI_OPTIMIZER_ENABLED=false          # set true when ≥100 ai_run_logs with outcomes
AI_OPTIMIZER_CANARY_PERCENT=10
AI_LEARNING_MIN_SAMPLES=20
AI_PROMPT_VERSION=enrichment-v1
AI_TAXONOMY_VALIDATION_ENABLED=false   # requires cached ebay_categories rows

# ── Runtime ──
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_KEY=                     # never commit
# max_tokens: leave unset (uncapped) for enrichment lanes
```

**Migration from current default:** replace `OPENAI_CHAT_MODEL=minimax/minimax-m3` with `OPENAI_MODEL_DEFAULT=openai/gpt-4.1-mini`. Keep `OPENAI_CHAT_MODEL` as alias to `OPENAI_MODEL_DEFAULT` for backward compatibility during transition.

---

## 11. Integration with existing entities

| Existing | Integration | Status |
|---|---|---|
| `ai_enhancements` | Link `AiRunLog.enhancement_id`; copy model, tokens, cost on create | **Done** |
| `compliance_audit_logs` | Log auto-fixes from guards (title trim, brand normalize) | **Done** |
| `validation_results` | `overallComplianceScore` → `ai_run_logs.compliance_score` via motors + catalog compliance | **Done** |
| `ingestion` AI results | `VisionEnrichmentPipeline` + image enrichment text lane routing | **Done** |
| `OpenAiService.sessionCostUsd` | Per-lane cost via `getSessionCostByLane()` + pipeline JSON rollup | **Done** |

---

## 12. Implementation phases

### Phase 0 — Prerequisites (Day 0) ✅

- [x] Read [REPORT.md](../model-comparison/REPORT.md) and sign off on model lanes
- [ ] Add eBay API credentials to `.env` (optional but recommended before bulk publish)
- [x] Seed `config/ai-routing-policy.v0.seed.json` from benchmark priors

### Phase 1 — Foundation (Week 1) ✅ code complete; validation pending

**Goal:** Route + guard + validate + log; no auto-learning yet.

- [x] Create `listing-guards` + `listing-quality.validator` (shared TS + mjs)
- [x] Create `model-router` with env-based lanes (no optimizer)
- [x] Switch default model to `openai/gpt-4.1-mini`
- [x] Wire router into `ebay-enrichment-pipeline.mjs` (`enrichBatchWithRouting`)
- [x] Add escalation (one retry → gemini) on hard fail
- [x] Create `ai_run_logs` migration + entity
- [x] Log every enrichment attempt from pipeline (`output/ai-run-logs.json`) and `EnrichmentPipeline` (DB)
- [x] Hook `ai-enhancement.service` approve/reject → backfill outcomes
- [ ] Run full 167-part file; manual review 10–15 listings

**Exit criteria:** ≥95% parse success; zero MPN fabrication; titles ≤80 after guard; logs populated.

**Verify:**

```bash
cd backend && npm run migration:run
node scripts/model-comparison/run-comparison.mjs only=openai/gpt-4.1-mini
node scripts/ebay-enrichment-pipeline.mjs   # PIPELINE_INPUT_FILE=docs/2008 Mercedes C350 AMG.xlsx
```

### Phase 2 — Advisor mode (Week 2) ✅ code complete; data pending

**Goal:** Optimizer produces recommendations; human approves policy changes.

- [x] Implement `scripts/ai-optimize-routing.mjs`
- [x] Output `docs/ai-optimization/routing-recommendations-YYYY-MM-DD.json`
- [x] Dashboard: `/settings/ai-routing` — segment stats, recommendations, policy JSON (`ai.routing.view`)
- [x] Document operator workflow in [README.md](./README.md)

**Exit criteria:** ≥100 `ai_run_logs` with outcomes; recommendations align with benchmark expectations.

**Run advisor:**

```bash
node scripts/ai-optimize-routing.mjs          # report only
node scripts/ai-optimize-routing.mjs --apply  # human review first
```

### Phase 3 — Auto-tune (Week 3–4) ✅ code complete; enable when ready

**Goal:** Router reads generated policy; canary rollout.

- [x] `AiOptimizerService` in NestJS (cron `@ 2am` when enabled)
- [x] Write versioned `config/ai-routing-policy.json`
- [x] `ModelRouter` reads policy file; fall back to env
- [ ] Canary rollout in production: `AI_OPTIMIZER_CANARY_PERCENT=10` → 50 → 100
- [x] Policy history table (`ai_routing_policy_history`); optimizer append on write; rollback via `AI_ROUTING_POLICY_PATH` (see README)
- [ ] Enable `AI_OPTIMIZER_ENABLED=true` after ≥100 logged outcomes

**Exit criteria:** Canary shows ≥5% reward improvement or ≥10% cost reduction without approval drop.

### Phase 4 — eBay truth + DE localization (Week 5+) ✅ code complete

- [x] eBay Taxonomy + aspect validation in quality gate (`EbayTaxonomyTruthService`; `AI_TAXONOMY_VALIDATION_ENABLED`)
- [x] Feed publish errors into `AiRunLog` (`EbayComplianceService.recordPublishOutcome`)
- [x] Publish errors + compliance scores in optimizer reward (`compliance_score`, `publishErrorRate`, `hardFailRate`)
- [ ] Optional DE title/description translation pass
- [ ] Optional eBay listing performance as weak learning signal

### Phase 5 — Continuous improvement (Ongoing) ⏳

- [ ] Monthly: re-run model comparison harness on frozen 8-part sample
- [ ] Quarterly: re-evaluate blocklist and add new OpenRouter models
- [ ] Weekly: prompt drift report (validator score trend per model)
- [ ] gbrain sync: index `ai_run_logs` patterns for agent queries
- [x] CI: regression job on PRs touching `common/openai/` or enrichment pipeline (`.github/workflows/ai-routing-regression.yml`)

---

## 13. Testing strategy

### 13.1 Regression (automated)

```bash
# Frozen 8-part sample — must pass after any router/validator change
node scripts/model-comparison/run-comparison.mjs only=openai/gpt-4.1-mini
node scripts/model-comparison/rebuild-summary.mjs
# Assert: composite ≥ 95, mpnFidelity 8/8, schemaValid true
```

CI job: `.github/workflows/ai-routing-regression.yml` runs `regression-check.mjs` on PRs touching `common/openai/` or pipeline scripts.

### 13.2 Integration

- Full file: `docs/2008 Mercedes C350 AMG.xlsx` → 167 parts
- Compare output row count, category IDs, fitment row counts vs baseline
- Spot-check 15 listings: engine, regulator, door shell, hinge, speaker

### 13.3 Learning system

- [x] Unit test: reward function (`ai-optimizer.service.spec.ts`)
- [ ] Unit test: optimizer never selects blocklisted model
- [x] Unit test: canary splits traffic deterministically by SKU hash (`model-router.canary.spec.ts`)
- [x] Unit test: listing guards MPN + fitment dedupe (`listing-guards.spec.ts`)
- Integration: seed 30 fake `ai_run_logs` → run optimizer → verify policy shift direction

### 13.4 Rollback drill

1. Deploy policy v2
2. Simulate approval rate drop
3. Restore `AI_ROUTING_POLICY_PATH` to v1
4. Confirm router uses v1 on next batch

---

## 14. Observability and dashboards

### 14.1 Metrics to track

| Metric | Source |
|---|---|
| Cost per listing (by lane/model) | `ai_run_logs` |
| First-pass rate | `passed_gate && !escalated` |
| Escalation rate | `escalated` |
| Human approval rate | `human_approved` |
| Publish success rate | `published` |
| Avg validation score | `validation_score` |
| Fitment row count | `fitment_row_count` |
| Policy version in use | `routing_policy_version` |

### 14.2 Alerts

- Parse failure rate > 5% in 1 hour
- Escalation rate > 30% for a segment
- avg cost/listing > budget threshold
- Validator score drop > 10% week-over-week
- Optimizer proposes blocklisted model (should never happen — log bug)

---

## 15. Cost projections (167-part file)

Based on benchmark token usage, single-model vs hybrid:

| Strategy | Est. cost / file | Notes |
|---|---|---|
| All gpt-4.1-mini | ~$0.35 | Recommended default |
| Hybrid 90% gpt-4.1 + 10% gemini | ~$0.42 | Flagship SKUs only |
| Hybrid 70% deepseek + 30% gpt-4.1 | ~$0.25 | Bulk overnight |
| All gemini | ~$1.24 | Overkill for most parts |
| Current minimax-m3 | ~$0.40 | Worse fitment than gpt-4.1-mini |

Learning system target: **match gpt-4.1-mini quality at deepseek-ish cost** for low-value segments after 500+ logged outcomes.

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fitment model-asserted without eBay API | Enable creds; validator; human review sample; publish-error feedback |
| Optimizer overfits small samples | `AI_LEARNING_MIN_SAMPLES=20`; canary; human pins |
| gemini token cost spike | Cap flagship routing; budget ceiling in optimizer |
| deepseek latency blocks pipeline | Higher concurrency; bulk runs off-peak only |
| Policy bad deploy | Versioned policy + rollback env var + canary |
| DE English listings | Phase 4 translation; document limitation until then |
| Divergence pipeline vs backend | Parallel `scripts/lib/*.mjs` mirrors `backend/src/common/openai/*.ts`; both read `config/ai-routing-policy.json` |

---

## 17. Success criteria

| Milestone | Target | Status (2026-06-07) |
|---|---|---|
| Phase 1 complete | Default gpt-4.1-mini live; ≥95% valid JSON; title guard active | **Code shipped** — run 167-part validation |
| Phase 2 complete | Optimizer recommendations match manual intuition on 3+ segments | **CLI shipped** — needs ≥100 `ai_run_logs` |
| Phase 3 complete | Canary policy beats static routing on reward by ≥5% | **Service shipped** — `AI_OPTIMIZER_ENABLED=false` |
| 30 days production | Human approval rate ≥90% on auto-generated listings | Not started |
| 90 days production | ≥15% cost reduction vs all-default-gpt-4.1-mini with same approval rate | Not started |
| Ongoing | Monthly comparison harness shows no regression below composite 95 for default lane | Not started |

---

## 18. Final production recommendation (from benchmark)

| Role | Model |
|---|---|
| Best overall | `openai/gpt-4.1-mini` |
| Best low-cost | `deepseek/deepseek-chat-v3-0324` |
| Best fitment depth | `google/gemini-2.5-flash` |
| Best titles/descriptions | `gpt-4.1-mini` / `gemini-2.5-flash` |
| Best structured attributes | All working models; gpt-4.1-mini / gemini / deepseek preferred |
| Text-only cleanup | `openai/gpt-4o-mini` (no fitment) |
| Replace | `minimax/minimax-m3` as default |
| Block | nova-lite, claude-3.5-haiku, llama-3.3-70b |

**Estimated cost per listing:** ~$0.0021 (default) / ~$0.0012 (bulk) / ~$0.0074 (flagship)  
**Estimated cost per 1,000 listings:** ~$2.10 / ~$1.17 / ~$7.44

---

## 19. Appendix A — Initial routing policy seed ✅

Shipped as `config/ai-routing-policy.v0.seed.json` and active copy `config/ai-routing-policy.json`:

```json
{
  "version": 0,
  "generatedAt": "2026-06-07T00:00:00.000Z",
  "canaryPercent": 0,
  "source": "model-comparison-benchmark",
  "segments": {
    "complete_engine|*": { "lane": "flagship", "model": "google/gemini-2.5-flash" },
    "transmission|*": { "lane": "flagship", "model": "google/gemini-2.5-flash" },
    "*|200-*": { "lane": "flagship", "model": "google/gemini-2.5-flash" },
    "*|*|bulk": { "lane": "bulk", "model": "deepseek/deepseek-chat-v3-0324" },
    "*|*": { "lane": "default", "model": "openai/gpt-4.1-mini" }
  },
  "thresholds": {
    "flagshipMinPrice": 200,
    "fitmentMinRows": 5,
    "autoApproveMinScore": 85
  },
  "escalationChain": ["openai/gpt-4.1-mini", "google/gemini-2.5-flash"],
  "blocklist": [
    "amazon/nova-lite-v1",
    "anthropic/claude-3.5-haiku",
    "meta-llama/llama-3.3-70b-instruct"
  ]
}
```

---

## 20. Appendix B — Prompt version discipline

- Store `AI_PROMPT_VERSION=enrichment-v1` in env
- Log `prompt_version` on every `AiRunLog` row
- When changing `systemPrompt` in `ebay-enrichment-pipeline.mjs`, increment to `enrichment-v2`
- Optimizer segments stats by `prompt_version` so A/B of prompt changes is measurable
- Never change prompt and routing policy in the same deploy

---

## 21. Appendix C — Reproduce benchmark

```bash
node scripts/model-comparison/probe-models.mjs
node scripts/model-comparison/run-comparison.mjs
node scripts/model-comparison/rebuild-summary.mjs
node scripts/model-comparison/extract-qualitative.mjs
```

Results: `docs/model-comparison/REPORT.md`

---

## 22. Quick operations reference

| Task | Command / action |
|------|------------------|
| Apply DB migration | `cd backend && npm run migration:run` |
| Regression (8-part) | `node scripts/model-comparison/run-comparison.mjs only=openai/gpt-4.1-mini` |
| Full pipeline | `PIPELINE_INPUT_FILE="docs/2008 Mercedes C350 AMG.xlsx" node scripts/ebay-enrichment-pipeline.mjs` |
| View run logs | `output/ai-run-logs.json` (pipeline) or `SELECT * FROM ai_run_logs ORDER BY created_at DESC` |
| Advisor report | `node scripts/ai-optimize-routing.mjs` |
| Rollback policy | `AI_ROUTING_POLICY_PATH=config/ai-routing-policy.v0.seed.json` |
| Enable learning | `AI_OPTIMIZER_ENABLED=true` after ≥100 outcomes |

---

*This document is the single source of truth for the AI optimization system. Phases 0–3 are implemented in code; Phases 4–5 and production validation remain. Update when behavior or phase status changes.*
