import type { PromptTemplate } from '../openai.types.js';

/**
 * Prompt template for generating eBay-optimized listing content.
 * Takes product data and generates title, description, and item specifics.
 * Kept compact to minimize token consumption — generating 3 fields
 * (title, subtitle, description, itemSpecifics, bulletPoints).
 */
export const LISTING_GENERATION_PROMPT: PromptTemplate = {
  name: 'listing-generation',
  systemPrompt: `You are an expert eBay Motors copywriter. Create SEO-optimized listings — factual, no fluff, no ALL CAPS (except brand abbreviations). Return valid JSON.`,

  userPrompt: `eBay listing for:
{{productData}}
Category: {{categoryName}} | Condition: {{condition}}

TITLE RULE: The title MUST reflect the stated Condition. If Condition is Used/Refurbished, do NOT include "New" in the title. If Condition is New, do NOT include "Used". NEVER include VIN numbers or duplicate make/model in the title.
TITLE STRUCTURE (strictly follow): [Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] OEM Used
Example: 2012-2018 Audi A6 C7 Front Left Fog Light 8T0941699E OEM Used
Max 80 characters. Put Year, Make, Model first. Include the OEM part number. Include position (Left/Right, Front/Rear) when applicable. Add 'OEM Used' at end if space permits.

Return JSON:
{
  "title": "max 80 chars. Brand + Part Type + Key Spec + Fitment + Condition",
  "subtitle": "optional (max 55 chars) or null",
  "description": "HTML: <h3>Overview</h3>, <h3>Features</h3>, <h3>Specifications</h3>, <h3>Fitment</h3>, <h3>Condition Notes</h3>. <ul>/<p> tags.",
  "itemSpecifics": {"Brand":"","Manufacturer Part Number":"","Placement on Vehicle":"", ...},
  "bulletPoints": ["5-7 selling points"]
}`,

  jsonMode: true,
  temperature: 0.3,
};

export default LISTING_GENERATION_PROMPT;
