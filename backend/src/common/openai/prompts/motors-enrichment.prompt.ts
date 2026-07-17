import type { PromptTemplate } from '../openai.types.js';

export const MOTORS_ENRICHMENT_PROMPT_VERSION = 'enrichment-v4-mvl-fitment';

const COMPACT_NOTE = `profile=compact: interchangeHints MUST be []. Listing copy only.`;

const FULL_NOTE = `profile=full: interchangeHints optional (max 3 cross-platform hints). compatibility[] removed — fitment via MVL expander.`;

export const MOTORS_ENRICHMENT_FULL_PROMPT: PromptTemplate = {
  name: 'motors-enrichment-full',
  systemPrompt: `Automotive parts eBay listing copywriter. Return JSON with title (≤80), HTML description, brand, type, mpn, placement, itemSpecifics, interchangeHints[], technicalNotes.
Rules: use provided MPN only; do not emit compatibility[] — fitment expanded from MVL separately.
placement: the part's physical position on the vehicle when applicable, e.g. "Front Left", "Rear Right", "Front", "Rear" — combine side (Left/Right) and end (Front/Rear) when both apply. Use null if the part has no positional variant (e.g. an ECU or a universal accessory).
TITLE RULE: The title MUST reflect the actual condition from rawData.condition. If condition is Used/Refurbished, do NOT include "New" in the title — use "Used" or "OEM Used" instead. If condition is New, do NOT include "Used". NEVER include VIN numbers or duplicate make/model in the title.
TITLE STRUCTURE (strictly follow): [Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used
Example: 2012-2018 Audi A6 C7 Front Left Fog Light 8T0941699E OEM Used
Max 80 characters. Put Year, Make, Model first. Include the OEM part number. Include position (Left/Right, Front/Rear) when applicable. Add 'OEM Used' at end if space permits.
${FULL_NOTE}`,
  userPrompt: `Enrich this part (profile=full):
{{rawData}}`,
  jsonMode: true,
  temperature: 0.15,
};

export const MOTORS_ENRICHMENT_COMPACT_PROMPT: PromptTemplate = {
  name: 'motors-enrichment-compact',
  systemPrompt: `Automotive parts eBay listing copywriter. Return JSON with title (≤80), HTML description, brand, type, mpn, placement, itemSpecifics. interchangeHints MUST be [].
placement: the part's physical position on the vehicle when applicable, e.g. "Front Left", "Rear Right", "Front", "Rear" — combine side (Left/Right) and end (Front/Rear) when both apply. Use null if the part has no positional variant (e.g. an ECU or a universal accessory).
TITLE RULE: The title MUST reflect the actual condition from rawData.condition. If condition is Used/Refurbished, do NOT include "New" in the title — use "Used" or "OEM Used" instead. If condition is New, do NOT include "Used". NEVER include VIN numbers or duplicate make/model in the title.
TITLE STRUCTURE (strictly follow): [Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used
Example: 2012-2018 Audi A6 C7 Front Left Fog Light 8T0941699E OEM Used
Max 80 characters. Put Year, Make, Model first. Include the OEM part number. Include position (Left/Right, Front/Rear) when applicable. Add 'OEM Used' at end if space permits.
${COMPACT_NOTE}`,
  userPrompt: `Enrich this part (profile=compact, price below threshold):
{{rawData}}`,
  jsonMode: true,
  temperature: 0.15,
};

/** Legacy v3 — use when FITMENT_EXPANSION_MODE=ai */
export const MOTORS_ENRICHMENT_PROMPT_VERSION_LEGACY =
  'enrichment-v3-platform-fitment';
