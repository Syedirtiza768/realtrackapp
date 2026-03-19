import type { PromptTemplate } from '../openai.types.js';

/**
 * Prompt template for vehicle fitment extraction from text.
 * Parses unstructured fitment data into structured year/make/model/trim arrays.
 */
export const FITMENT_EXTRACTION_PROMPT: PromptTemplate = {
  name: 'fitment-extraction',
  systemPrompt: `You are an expert in automotive vehicle fitment data.
Parse unstructured fitment information into structured year/make/model/trim arrays.
Be precise with years — expand ranges (e.g. "2015-2020" → individual years).
Use standard eBay-compatible make and model names.
If fitment data is ambiguous, mark confidence as low.
Always return valid JSON matching the exact schema specified.`,

  userPrompt: `Extract structured vehicle fitment data from this text:

{{fitmentText}}

Additional context (if available):
Part Type: {{partType}}
Brand: {{brand}}

Return JSON with these exact keys:
{
  "vehicles": [
    {
      "year": "2020",
      "make": "Toyota",
      "model": "Camry",
      "trim": "LE | SE | XLE | null",
      "engine": "2.5L L4 | null",
      "submodel": "Sedan | null"
    }
  ],
  "fitmentNotes": "any additional fitment notes or restrictions",
  "isUniversal": false,
  "confidence": 0.0-1.0,
  "warnings": ["any ambiguities or issues with the extraction"]
}`,

  jsonMode: true,
  temperature: 0.1,
  maxTokens: 4000,
};

export default FITMENT_EXTRACTION_PROMPT;
