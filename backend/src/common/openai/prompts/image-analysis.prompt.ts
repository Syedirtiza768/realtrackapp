import type { PromptTemplate } from '../openai.types.js';

/**
 * Prompt template for image analysis of motor parts.
 * Extended version of the existing MOTOR_PARTS_PROMPT used in openai-vision.provider.ts.
 */
export const IMAGE_ANALYSIS_PROMPT: PromptTemplate = {
  name: 'image-analysis',
  systemPrompt: `You are an expert automotive parts identifier with deep knowledge of OEM and aftermarket parts.
Analyze the provided images to identify the part and extract all visible information.
Be conservative with confidence scores.
If something is partially visible or unclear, note it in defects/warnings.
Always return valid JSON matching the exact schema specified.`,

  userPrompt: `Analyze these motor part images and extract all identifiable information.

Return JSON with these exact keys:
{
  "title": "eBay-optimized title (max 80 chars)",
  "brand": "string | null",
  "mpn": "manufacturer part number | null",
  "oemNumber": "OEM/OE part number | null",
  "partType": "specific part category | null",
  "condition": "New | Used | Refurbished",
  "priceEstimate": number | null,
  "description": "detailed description (250-500 chars)",
  "features": ["array of key features visible in images"],
  "fitment": {
    "make": "string | null",
    "model": "string | null",
    "yearStart": number | null,
    "yearEnd": number | null,
    "engine": "string | null"
  } | null,
  "dimensions": {
    "length": "string | null",
    "width": "string | null",
    "height": "string | null",
    "weight": "string | null"
  } | null,
  "defects": ["array of visible defects or wear"],
  "visibleText": ["any text visible on the part (labels, stamps, engravings)"],
  "confidence": {
    "title": 0.0-1.0,
    "brand": 0.0-1.0,
    "mpn": 0.0-1.0,
    "partType": 0.0-1.0,
    "condition": 0.0-1.0,
    "overall": 0.0-1.0
  }
}`,

  jsonMode: true,
  temperature: 0.1,
  maxTokens: 2500,
};

export default IMAGE_ANALYSIS_PROMPT;
