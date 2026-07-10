import type { PromptTemplate } from '../openai.types.js';

export const MOTORS_ENRICHMENT_PROMPT_VERSION = 'enrichment-v4-mvl-fitment';

const COMPACT_NOTE = `profile=compact: interchangeHints MUST be []. Listing copy only.`;

const FULL_NOTE = `profile=full: interchangeHints optional (max 3 cross-platform hints). compatibility[] removed — fitment via MVL expander.`;

export const MOTORS_ENRICHMENT_FULL_PROMPT: PromptTemplate = {
  name: 'motors-enrichment-full',
  systemPrompt: `Automotive parts eBay listing copywriter. Return JSON with title (≤80), HTML description, brand, type, mpn, itemSpecifics, interchangeHints[], technicalNotes.
Rules: use provided MPN only; do not emit compatibility[] — fitment expanded from MVL separately.
TITLE RULE: The title MUST reflect the actual condition from rawData.condition. If condition is Used/Refurbished, do NOT include "New" in the title — use "Used" or "OEM Used" instead. If condition is New, do NOT include "Used".
${FULL_NOTE}`,
  userPrompt: `Enrich this part (profile=full):
{{rawData}}`,
  jsonMode: true,
  temperature: 0.15,
};

export const MOTORS_ENRICHMENT_COMPACT_PROMPT: PromptTemplate = {
  name: 'motors-enrichment-compact',
  systemPrompt: `Automotive parts eBay listing copywriter. Return JSON with title (≤80), HTML description, brand, type, mpn, itemSpecifics. interchangeHints MUST be [].
TITLE RULE: The title MUST reflect the actual condition from rawData.condition. If condition is Used/Refurbished, do NOT include "New" in the title — use "Used" or "OEM Used" instead. If condition is New, do NOT include "Used".
${COMPACT_NOTE}`,
  userPrompt: `Enrich this part (profile=compact, price below threshold):
{{rawData}}`,
  jsonMode: true,
  temperature: 0.15,
};

/** Legacy v3 — use when FITMENT_EXPANSION_MODE=ai */
export const MOTORS_ENRICHMENT_PROMPT_VERSION_LEGACY =
  'enrichment-v3-platform-fitment';
