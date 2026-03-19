import type { PromptTemplate } from '../openai.types.js';

/**
 * Prompt template for enriching raw listing data with AI.
 * Takes partial product data and fills in missing fields.
 */
export const DATA_ENRICHMENT_PROMPT: PromptTemplate = {
  name: 'data-enrichment',
  systemPrompt: `You are an expert automotive parts specialist and eBay listing optimizer.
Given partial product data, enrich it with accurate, complete information.
Focus on eBay Motors Parts & Accessories best practices.
Always return valid JSON matching the exact schema specified.
Be conservative — if you're not confident about a value, set it to null.
Never fabricate part numbers or brand names.`,

  userPrompt: `Enrich this automotive part listing data:

{{rawData}}

Fill in any missing fields. For existing fields, validate and improve them if possible.

Return JSON with these exact keys:
{
  "title": "eBay-optimized title (max 80 chars, include brand + part type + fitment keywords)",
  "brand": "string | null",
  "mpn": "manufacturer part number | null",
  "oemNumber": "OEM/OE part number | null",
  "partType": "specific part category (e.g. 'Brake Pad Set', 'Oil Filter')",
  "condition": "New | Used | Refurbished",
  "description": "detailed HTML description (500-1000 chars, include specs and fitment)",
  "features": ["array of key selling points"],
  "suggestedCategory": "eBay category name suggestion",
  "itemSpecifics": {
    "Brand": "value",
    "Manufacturer Part Number": "value",
    ...additional relevant specifics
  },
  "searchKeywords": ["array of 5-10 relevant search terms"],
  "confidence": {
    "title": 0.0-1.0,
    "brand": 0.0-1.0,
    "mpn": 0.0-1.0,
    "partType": 0.0-1.0,
    "overall": 0.0-1.0
  }
}`,

  jsonMode: true,
  temperature: 0.15,
  maxTokens: 2000,
};

export default DATA_ENRICHMENT_PROMPT;
