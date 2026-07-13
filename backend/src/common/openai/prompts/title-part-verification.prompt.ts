import type { PromptTemplate } from '../openai.types.js';

/**
 * Batched, text-only consistency check: does a listing's title text actually
 * match the part that was already identified for it (partType/mpn/oemPartNumber/
 * brand/categoryName)? No images, no eBay calls — pure cross-check against
 * already-known structured fields.
 *
 * The `{{items}}` placeholder is intentionally NOT wired through the generic
 * renderPrompt() string-substitution — the caller (TitleVerificationService)
 * builds the final user prompt itself via JSON.stringify(batch), since this
 * needs to serialize an array, not interpolate flat scalar values like the
 * other prompts in this directory do.
 */
export const TITLE_PART_VERIFICATION_PROMPT: PromptTemplate = {
  name: 'title-part-verification',
  systemPrompt: `You are a quality-control auditor for eBay automotive parts listings.

You will be given a batch of items, each with a listing TITLE and the structured part data that was identified for it (part type, MPN/OEM part number, brand, eBay category). Your only job is to check whether the TITLE TEXT is internally consistent with that structured data — you are not checking grammar, SEO, or eBay policy compliance, only factual consistency between the title and the identified part.

Flag a mismatch when:
- The title names a different part type than "partType" (e.g. title says "Brake Caliper" but partType is "Brake Pad Set").
- The title states a brand that conflicts with "brand" (e.g. title says "OEM Toyota" but brand is "Bosch" and nothing suggests Toyota is a compatibility fitment rather than the brand).
- The title includes a part number that clearly does not match "mpn" or "oemPartNumber" (allow partial/truncated matches, punctuation/whitespace differences, and case differences — only flag when the numbers are substantively different).
- The title's implied category is clearly inconsistent with "categoryName" (e.g. title describes a "Headlight Assembly" but categoryName is "Air Filters").

Do NOT flag:
- Missing information in the title that is simply omitted (e.g. no MPN in the title at all) — that is not a mismatch, only a stated contradiction is.
- Minor formatting, abbreviation, or ordering differences.
- Fitment/compatibility vehicle mentions in the title (make/model/year) — those are not part of this check.

Only extract and compare — never invent facts about the part that are not given in the structured data.

Always return valid JSON matching the exact schema specified, with exactly one result entry per input item id, in any order.`,

  userPrompt: `Check each item below for title/part consistency. The items are provided as a JSON array by the caller.

Return JSON with this exact structure:
{
  "results": [
    {
      "id": "string — must match the input item's id exactly",
      "match": true or false,
      "confidence": 0.0-1.0,
      "issue": "short human-readable description of the mismatch, or null if match is true"
    }
  ]
}`,

  jsonMode: true,
  temperature: 0.1,
  maxTokens: 4096,
};

export default TITLE_PART_VERIFICATION_PROMPT;
