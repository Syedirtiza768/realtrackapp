"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_CLASSIFICATION_PROMPT = void 0;
exports.CATEGORY_CLASSIFICATION_PROMPT = {
    name: 'category-classification',
    systemPrompt: `You are an expert in eBay Motors Parts & Accessories taxonomy.
Given product information, determine the most specific eBay category.
eBay Motors uses a hierarchical category tree. Always aim for the deepest (most specific) category.
Return valid JSON matching the exact schema specified.`,
    userPrompt: `Classify this automotive part into the correct eBay category:

Product Title: {{title}}
Brand: {{brand}}
Part Type: {{partType}}
Additional Info: {{additionalInfo}}

Return JSON with these exact keys:
{
  "suggestedCategories": [
    {
      "categoryPath": "eBay Motors > Parts & Accessories > Car & Truck Parts > Brakes > Brake Pads",
      "categoryName": "Brake Pads",
      "confidence": 0.0-1.0,
      "reasoning": "why this category is appropriate"
    }
  ],
  "requiredAspects": ["list of required item specifics for the top category"],
  "recommendedAspects": ["list of recommended item specifics"]
}`,
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 1500,
};
exports.default = exports.CATEGORY_CLASSIFICATION_PROMPT;
//# sourceMappingURL=category-classification.prompt.js.map