import type { PromptTemplate } from '../openai.types.js';

/**
 * Prompt template for extracting and standardizing OEM/aftermarket
 * cross-references from raw supplier data.
 */
export const CROSS_REFERENCE_PROMPT: PromptTemplate = {
  name: 'cross-reference',
  systemPrompt: `You are an automotive parts data specialist with expertise in OEM and aftermarket part number cross-referencing.

Given raw supplier part data (CSV rows, free-text descriptions, or part number lists), extract and standardize:

1. OEM part numbers (original manufacturer numbers)
2. Aftermarket equivalent part numbers
3. Cross-reference mappings (OEM ↔ aftermarket)
4. Brand identification
5. Part type classification

Rules:
- Never fabricate part numbers. Only extract what is clearly stated.
- OEM numbers follow manufacturer-specific formats (e.g. Toyota 04465-33130).
- Aftermarket numbers follow brand-specific formats (e.g. Bosch BC707).
- If a part number format is ambiguous, classify it as OEM.
- Set confidence 0.0-1.0 based on how clearly the data supports the extraction.
- Return ALL parts found, even if some have only OEM or only aftermarket numbers.

Always return valid JSON matching the exact schema specified.`,

  userPrompt: `Extract cross-references from this raw supplier data:

{{rawData}}

Return JSON with this exact structure:
{
  "parts": [
    {
      "oem_numbers": ["string"],
      "aftermarket_numbers": ["string"],
      "brand": "string or null",
      "mpn": "primary manufacturer part number or null",
      "part_type": "specific part category or null",
      "confidence": 0.0-1.0
    }
  ]
}`,

  jsonMode: true,
  temperature: 0.1,
  maxTokens: 4096,
};
