import type { PromptTemplate } from '../openai.types.js';

/**
 * Batch extraction of eBay Motors title slots: Position + Part Name only.
 * Year / Make / Model / Generation / OEM / "OEM Used" stay deterministic.
 *
 * Caller JSON-stringifies the items array (same pattern as title-part-verification).
 */
export const TITLE_POSITION_PART_NAME_PROMPT: PromptTemplate = {
  name: 'title-position-part-name',
  systemPrompt: `You extract two short eBay Motors title segments from automotive part data.

For each item return:
- position: placement on the vehicle when known (e.g. "Front Left", "Rear", "Upper"). Empty string if unknown or not applicable (ECUs, filters, etc.).
- partName: concise buyer-facing part name only (e.g. "Fog Light", "Door Mirror Glass", "Brake Caliper"). No year, make, model, VIN, OEM number, or condition words (Used/OEM/New).

Rules:
- Factual only — do not invent a position that is not implied by the description or structured fields.
- Title Case English. No ALL CAPS. No HTML.
- Keep partName short enough for an 80-char eBay title (typically 2-6 words).
- Prefer refining hintPosition/hintPartName when they are already correct; rewrite when noisy or wrong.
- Return valid JSON only, with exactly one result per input id.`,

  userPrompt: `Extract position and partName for each item below (JSON array provided by the caller).

Return JSON:
{
  "results": [
    {
      "id": "string — must match the input item id exactly",
      "position": "string or empty",
      "partName": "string"
    }
  ]
}`,

  jsonMode: true,
  temperature: 0.2,
  maxTokens: 4096,
};

export default TITLE_POSITION_PART_NAME_PROMPT;
