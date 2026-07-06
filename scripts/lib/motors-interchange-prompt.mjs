/**
 * Compact micro-prompt for cross-platform interchange when MVL expansion is thin.
 */

export const INTERCHANGE_PROMPT_VERSION = 'interchange-v1-mvl-hints';

export function buildInterchangeSystemPrompt() {
  return `Automotive parts interchange specialist. Return JSON only:
{
  "items": [{
    "index": N,
    "interchangeHints": [{
      "make": "",
      "model": "",
      "yearStart": 2015,
      "yearEnd": 2020,
      "confidence": "low|medium",
      "reason": "same MPN / shared platform"
    }]
  }]
}
Rules: max 5 hints per part; only legitimate cross-platform fits for the MPN; never fabricate MPNs.`;
}

export function buildInterchangeUserPrompt(partsForPrompt) {
  return `Cross-platform interchange hints for ${partsForPrompt.length} parts (MVL expansion insufficient):
${JSON.stringify(partsForPrompt)}`;
}
