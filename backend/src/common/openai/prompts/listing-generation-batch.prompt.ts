import type { PromptTemplate } from '../openai.types.js';

/**
 * Batch variant of LISTING_GENERATION_PROMPT — generates listing content for
 * multiple products in a single call instead of one call per product. Used
 * by ListingGenerationPipeline.generateBatch to cut per-product LLM
 * round-trips during bulk listing optimization.
 */
export const LISTING_GENERATION_BATCH_PROMPT: PromptTemplate = {
  name: 'listing-generation-batch',
  systemPrompt: `You are an expert eBay Motors copywriter. Create SEO-optimized listings — factual, no fluff, no ALL CAPS (except brand abbreviations). You will receive an array of multiple products. Return a JSON array of results with EXACTLY the same length and order as the input array — one listing object per product, matched by index. Return valid JSON only.`,

  userPrompt: `Generate eBay listings for this array of products:
{{itemsData}}

Each item has: index, productData, categoryName, condition.

TITLE RULE: The title MUST reflect that item's stated Condition. If Condition is Used/Refurbished, do NOT include "New" in the title. If Condition is New, do NOT include "Used". NEVER include VIN numbers or duplicate make/model in the title.
TITLE STRUCTURE (strictly follow): [Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used
Example: 2012-2018 Audi A6 C7 Front Left Fog Light 8T0941699E OEM Used
Max 80 characters. Put Year, Make, Model first. Include the OEM part number. Include position (Left/Right, Front/Rear) when applicable. Add 'OEM Used' at end if space permits.

Return JSON:
{
  "results": [
    {
      "index": 0,
      "title": "max 80 chars. Brand + Part Type + Key Spec + Fitment + Condition",
      "subtitle": "optional (max 55 chars) or null",
      "description": "HTML: <h3>Overview</h3>, <h3>Features</h3>, <h3>Specifications</h3>, <h3>Fitment</h3>, <h3>Condition Notes</h3>. <ul>/<p> tags.",
      "itemSpecifics": {"Brand":"","Manufacturer Part Number":"","Placement on Vehicle":"", ...},
      "bulletPoints": ["5-7 selling points"]
    }
  ]
}
"results" MUST contain exactly one entry per input item, in the same order, with "index" matching the input item's index.`,

  jsonMode: true,
  temperature: 0.3,
};

export default LISTING_GENERATION_BATCH_PROMPT;
