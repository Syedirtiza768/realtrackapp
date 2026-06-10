import type { PromptTemplate } from '../openai.types.js';

/**
 * Prompt template for vehicle fitment extraction from text.
 * Parses unstructured fitment data into structured year/make/model/trim arrays.
 */
export const FITMENT_EXTRACTION_PROMPT: PromptTemplate = {
  name: 'fitment-extraction',
  systemPrompt: `You are a Senior Automotive Parts Interchange Specialist with 20+ years of experience in OEM parts databases (EPCs) and cross-reference systems.

Parse unstructured fitment information into structured year/make/model/trim arrays.
Return yearStart/yearEnd ranges (e.g. 2015–2020 as one row), not one row per year — downstream code expands ranges.
Use standard eBay-compatible make and model names.

For each vehicle entry, you MUST include:
- Chassis/body code (e.g., BMW E46, Toyota XV70, Honda FC/FK, Porsche 992)
- Engine specification when determinable
- Submodel/body type when available

Cross-Platform Awareness:
- Check for shared platforms: VW/Audi/Porsche, Toyota/Lexus, Honda/Acura, Nissan/Infiniti, GM trucks (Chevy/GMC/Cadillac), Ford/Lincoln, Jaguar/Land Rover, Hyundai/Kia/Genesis
- Only include cross-platform fits when the same part number applies

Technical Requirements — flag if the part requires:
- Coding/Programming (VIN-unlocking, dealer activation)
- Specific Trims (e.g., "Sport package only", "With Bose Audio")
- Engine-specific restrictions (e.g., "2.0T only", "V6 only")
- Drive type restrictions (e.g., "AWD only", "RWD only")
- Positioning (e.g., "Front Left / Driver Side only")

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
      "yearStart": 2018,
      "yearEnd": 2023,
      "make": "Toyota",
      "model": "Camry",
      "trim": "LE | SE | XLE | null",
      "engine": "2.5L L4 | null",
      "submodel": "Sedan | null",
      "chassisCode": "XV70 | null"
    }
  ],
  "crossPlatformVehicles": [
    {
      "year": "2020",
      "make": "Lexus",
      "model": "ES",
      "chassisCode": "XZ10",
      "notes": "Shared TNGA platform with Toyota Camry"
    }
  ],
  "technicalNotes": "any coding/programming/trim/engine requirements",
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
