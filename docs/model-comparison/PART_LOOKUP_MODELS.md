# Single-listing part lookup — model recommendation

Applied **2026-06-27** after live OpenRouter benchmark (`scripts/model-comparison/run-part-lookup-comparison.mjs`).

## Recommended stack

| Role | Env var | Model | Why |
|------|---------|-------|-----|
| OEM text lookup | `OPENAI_MODEL_TEXT` | `openai/gpt-4o-mini` | Best cost/credibility balance (78% credibility, ~$0.00009/lookup measured) |
| Vision fallback | `OPENAI_VISION_MODEL` | `google/gemini-2.5-flash` | Strong multimodal; used only when OEM text fails |

Other OpenRouter vars (`OPENAI_CHAT_MODEL`, etc.) are unchanged and used elsewhere in the app.

## 15,000-part cost projections

Assumes every part triggers **Fetch details** once; vision only when OEM returns error, low confidence, or empty fields.

| Scenario | Approx. total |
|----------|---------------|
| Best case (100% OEM success) | **~$1.37** |
| Typical (90% OEM, 10% vision) | **~$5.00** |
| **Worst case** (100% need OEM attempt + vision) | **~$38–40** |

Worst case = 15,000 × (measured OEM cost + estimated vision cost per call). Vision cost is token-estimated (~2.8k prompt + ~650 completion on Gemini Flash); OEM uses benchmark median for `gpt-4o-mini`.

The form on `/listings/new` loads live estimates from `GET /api/pipeline/single-listing/lookup-pricing`.

## Benchmark reference

Full results: `docs/model-comparison/part-lookup-comparison.json`
