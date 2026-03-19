import type { PromptTemplate } from '../openai.types.js';

/**
 * Prompt template for generating eBay-optimized listing content.
 * Takes product data and generates title, description, and item specifics.
 */
export const LISTING_GENERATION_PROMPT: PromptTemplate = {
  name: 'listing-generation',
  systemPrompt: `You are an expert eBay listing copywriter specializing in automotive parts.
Your goal is to create compelling, SEO-optimized listings that maximize visibility and conversion.
Follow eBay's best practices for titles and descriptions.
Never use ALL CAPS except for brand/part abbreviations.
Include relevant keywords naturally — no keyword stuffing.
Always return valid JSON matching the exact schema specified.`,

  userPrompt: `Generate a complete eBay Motors listing for this product:

{{productData}}

Target eBay category: {{categoryName}}
Condition: {{condition}}

Return JSON with these exact keys:
{
  "title": "eBay-optimized title (max 80 chars). Format: Brand + Part Type + Key Spec + Fitment + Condition",
  "subtitle": "optional compelling subtitle (max 55 chars) | null",
  "description": "rich HTML description with sections: Overview, Features, Specifications, Fitment, Condition Notes. Use <h3>, <ul>, <p> tags. 800-2000 chars.",
  "itemSpecifics": {
    "Brand": "value",
    "Manufacturer Part Number": "value",
    "Placement on Vehicle": "value",
    "Warranty": "value",
    ...additional category-specific specifics
  },
  "bulletPoints": ["5-7 key selling points for gallery description"],
  "searchTerms": ["8-12 high-volume search keywords"],
  "pricePositioning": {
    "suggestedPrice": number,
    "rationale": "brief pricing rationale based on condition and market"
  }
}`,

  jsonMode: true,
  temperature: 0.4,
  maxTokens: 3000,
};

export default LISTING_GENERATION_PROMPT;
