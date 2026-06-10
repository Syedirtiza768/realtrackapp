/**
 * Compact Motors enrichment prompts — shared token budget with backend.
 */

export const PROMPT_VERSION = 'enrichment-v2-compact';

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
    "compatibility": [{ "yearStart": 2015, "yearEnd": 2020, "make": "", "model": "", "chassisCode": "", "trim": "", "engine": "", "notes": "" }],
    "technicalNotes": ""
  }]
}`;

export function buildMotorsEnrichmentSystemPrompt() {
  return `Automotive parts interchange specialist for eBay Motors. Return JSON only: ${JSON_SCHEMA}

Rules:
- Use provided MPN only; never fabricate.
- Title: YearRange Make Model Chassis PartName MPN Used OEM.
- Description: HTML (Details, Compatibility, Condition) + "Please verify part number compatibility before purchasing".
- Brand: Mercedes→Mercedes-Benz; standard OEM names.
- Cross-platform fits only when same MPN applies; research beyond donor vehicle when profile=full.

profile per item:
- compact (price < low-value threshold): compatibility MUST be []. Title/description/specifics only; donor vehicle in input is sufficient.
- full: compatibility uses yearStart/yearEnd ranges (NOT one row per year). Max 25 range rows per part. Include chassis codes.`;
}

export function buildMotorsEnrichmentUserPrompt(partsForPrompt) {
  return `Analyze ${partsForPrompt.length} parts. Respect each item's profile field.
${JSON.stringify(partsForPrompt)}`;
}
