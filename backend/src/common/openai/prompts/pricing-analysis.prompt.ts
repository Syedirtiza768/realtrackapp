import type { PromptTemplate } from '../openai.types.js';

/**
 * Prompt for AI-powered pricing suggestions.
 * Takes product data + competitor prices → returns optimal pricing strategy.
 */
export const PRICING_ANALYSIS_PROMPT: PromptTemplate = {
  name: 'pricing-analysis',
  systemPrompt: `You are an expert eBay Motors Parts & Accessories pricing analyst.
Given product cost data and competitor pricing, suggest optimal pricing for maximum profit while remaining competitive.
Consider condition, shipping costs, seller competition density, and MAP constraints.
Always return valid JSON matching the exact schema specified.
Never suggest a price below the base cost or MAP price.`,

  userPrompt: `Analyze pricing for this auto part:

Product: {{productTitle}}
Part Number: {{partNumber}}
Brand: {{brand}}
Condition: {{condition}}
Base Cost: {{costPrice}} USD
Current Retail Price: {{retailPrice}} USD
MAP Price: {{mapPrice}} USD

Competitor Prices (last 7 days):
{{competitorData}}

Market Summary:
- Total active listings: {{totalListings}}
- Average price: {{avgPrice}} USD
- Median price: {{medianPrice}} USD
- Min price: {{minPrice}} USD
- Max price: {{maxPrice}} USD

Return JSON with these exact keys:
{
  "suggestedPrice": number,
  "reasoning": "detailed explanation of pricing strategy",
  "marketPosition": "below_average" | "average" | "above_average",
  "confidence": 0.0 to 1.0,
  "minViablePrice": number,
  "maxRecommendedPrice": number,
  "marginPercent": number,
  "competitorCount": number,
  "pricingStrategy": "undercut" | "match" | "premium" | "value",
  "actionItems": ["1-3 actionable pricing recommendations"]
}`,

  jsonMode: true,
  temperature: 0.2,
  maxTokens: 1500,
};

export default PRICING_ANALYSIS_PROMPT;
