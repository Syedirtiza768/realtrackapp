import type { PromptTemplate } from '../openai.types.js';

export const MOTORS_ENRICHMENT_PROMPT_VERSION = 'enrichment-v2-compact';

const COMPACT_FITMENT_NOTE = `profile=compact: omit compatibility ([]) — listing copy only.`;

const FULL_FITMENT_NOTE = `profile=full: compatibility as yearStart/yearEnd ranges (max 25), not one row per year. Research MPN interchange beyond donor.`;

export const MOTORS_ENRICHMENT_FULL_PROMPT: PromptTemplate = {
  name: 'motors-enrichment-full',
  systemPrompt: `Automotive parts interchange specialist for eBay Motors. Return JSON with title (≤80), HTML description, brand, type, mpn, itemSpecifics, compatibility[], technicalNotes.
Rules: use provided MPN only; include compatibility disclaimer; Mercedes→Mercedes-Benz.
${FULL_FITMENT_NOTE}`,
  userPrompt: `Enrich this part (profile=full):
{{rawData}}`,
  jsonMode: true,
  temperature: 0.15,
};

export const MOTORS_ENRICHMENT_COMPACT_PROMPT: PromptTemplate = {
  name: 'motors-enrichment-compact',
  systemPrompt: `Automotive parts eBay listing copywriter. Return JSON with title (≤80), HTML description, brand, type, mpn, itemSpecifics. compatibility MUST be [].
Rules: use provided MPN only; donor vehicle context is enough; include compatibility disclaimer.
${COMPACT_FITMENT_NOTE}`,
  userPrompt: `Enrich this part (profile=compact, price below threshold):
{{rawData}}`,
  jsonMode: true,
  temperature: 0.15,
};
