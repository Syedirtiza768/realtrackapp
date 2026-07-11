/**
 * Compact Motors enrichment prompts — listing copy only (fitment via MVL expander).
 */

export const PROMPT_VERSION = 'enrichment-v4-mvl-fitment';

const JSON_SCHEMA = `{
  "items": [{
    "index": N,
    "title": "≤80 chars",
    "description": "HTML",
    "brand": "",
    "type": "",
    "mpn": "",
    "oemNumber": "",
    "placement": "",
    "material": "",
    "warranty": "No Warranty",
    "fitmentType": "Direct Replacement",
    "color": "",
    "interchangeNumber": "",
    "itemSpecifics": { "Brand": "", "Manufacturer Part Number": "", "Type": "", "Placement on Vehicle": "" },
    "technicalNotes": "",
    "interchangeHints": [{ "make": "", "model": "", "yearStart": 2015, "yearEnd": 2020, "confidence": "low|medium", "reason": "" }]
  }]
}`;

export function buildMotorsEnrichmentSystemPrompt() {
  return `Automotive parts listing specialist for eBay Motors. Return JSON only: ${JSON_SCHEMA}

Rules:
- Use provided MPN only; never fabricate.
- If an item has a non-empty verifiedPartType, that is the authoritative component identity from eBay's live catalog for this part number. Set "type" to it and use it as the PartName in the title; do NOT substitute a different component inferred from partName/note (note may still be used for placement/material only).
- Title (≤80 chars): YearRange Make Model [ChassisCode] [Variant] PartName [Placement] MPN Used OEM.
- Chassis codes MUST match year range (e.g. Lexus RX AL20 = 2015-2022 only).
- Description: HTML (Details, Compatibility note, Condition) — do NOT list Year/Make/Model tables (fitment added separately).
- Item specifics: always fill Brand, Manufacturer Part Number, Type, Placement on Vehicle.
- Brand: Mercedes→Mercedes-Benz; standard OEM names.
- compatibility field is REMOVED — fitment is expanded from MVL after this step.

profile per item:
- compact (price < low-value threshold): interchangeHints MUST be []. Title/description/specifics only.
- full: interchangeHints optional, max 3 hints for cross-platform only when MPN research supports it; leave [] when unsure.`;
}

export function buildMotorsEnrichmentUserPrompt(partsForPrompt) {
  return `Analyze ${partsForPrompt.length} parts. Respect each item's profile field.
${JSON.stringify(partsForPrompt)}`;
}

/** @deprecated v3 schema — kept for FITMENT_EXPANSION_MODE=ai */
export const PROMPT_VERSION_LEGACY = 'enrichment-v3-platform-fitment';

export function buildMotorsEnrichmentSystemPromptLegacy() {
  const legacySchema = `{
  "items": [{
    "index": N,
    "title": "≤80 chars",
    "description": "HTML",
    "brand": "", "type": "", "mpn": "", "placement": "",
    "itemSpecifics": { "Brand": "", "Manufacturer Part Number": "", "Type": "", "Placement on Vehicle": "" },
    "compatibility": [{ "yearStart": 2015, "yearEnd": 2020, "make": "", "model": "", "chassisCode": "", "trim": "", "engine": "", "notes": "" }],
    "technicalNotes": ""
  }]
}`;
  return `Automotive parts interchange specialist for eBay Motors. Return JSON only: ${legacySchema}
profile=full: compatibility as yearStart/yearEnd ranges (max 25). profile=compact: compatibility [].`;
}
