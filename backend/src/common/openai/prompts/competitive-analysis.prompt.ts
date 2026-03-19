import type { PromptTemplate } from '../openai.types.js';

/**
 * Prompt template for competitive pricing analysis.
 * Takes competitor listing data and provides pricing intelligence.
 */
export const COMPETITIVE_ANALYSIS_PROMPT: PromptTemplate = {
  name: 'competitive-analysis',
  systemPrompt: `You are a pricing analyst specializing in eBay Motors Parts & Accessories.
Analyze competitor listings to provide actionable pricing intelligence.
Consider condition, seller reputation signals, shipping costs, and market positioning.
Always return valid JSON matching the exact schema specified.
Base analysis only on the provided data — do not fabricate market data.`,

  userPrompt: `Analyze these competitor listings for the following product:

Product: {{productTitle}}
Part Number: {{partNumber}}
Condition: {{condition}}

Competitor Listings:
{{competitorData}}

Return JSON with these exact keys:
{
  "marketSummary": {
    "totalListings": number,
    "avgPrice": number,
    "medianPrice": number,
    "minPrice": number,
    "maxPrice": number,
    "priceStdDev": number
  },
  "conditionBreakdown": {
    "new": { "count": number, "avgPrice": number },
    "used": { "count": number, "avgPrice": number },
    "refurbished": { "count": number, "avgPrice": number }
  },
  "recommendedPricing": {
    "competitive": number,
    "premium": number,
    "aggressive": number,
    "rationale": "explanation of pricing strategy"
  },
  "marketInsights": [
    "3-5 actionable insights about the market"
  ],
  "listingOptimizations": [
    "2-4 suggestions to improve listing competitiveness"
  ],
  "confidence": 0.0-1.0
}`,

  jsonMode: true,
  temperature: 0.2,
  maxTokens: 2000,
};

export default COMPETITIVE_ANALYSIS_PROMPT;
