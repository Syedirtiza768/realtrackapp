import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AiRawResponse, AiVisionProvider } from './ai-provider.interface.js';

/**
 * Structured prompt for motor parts image analysis.
 */
const MOTOR_PARTS_PROMPT = `Analyze this motor part image and extract:
1. Part title (max 80 chars, eBay-optimized)
2. Brand name
3. Manufacturer Part Number (MPN)
4. OE/OEM Part Number
5. Part type/category
6. Condition (New/Used/Refurbished)
7. Estimated market value (USD)
8. Description (250 chars)
9. Key features (array)
10. Vehicle fitment (make, model, year range, engine if visible)
11. Dimensions if measurable
12. Any visible defects or wear

Return JSON only with these exact keys:
{
  "title": string,
  "brand": string | null,
  "mpn": string | null,
  "oemNumber": string | null,
  "partType": string | null,
  "condition": "New" | "Used" | "Refurbished",
  "priceEstimate": number | null,
  "description": string,
  "features": string[],
  "fitment": { "make": string, "model": string, "yearStart": number, "yearEnd": number, "engine": string | null } | null,
  "dimensions": { "length": string, "width": string, "height": string, "weight": string } | null,
  "defects": string[],
  "confidence": {
    "title": number,
    "brand": number,
    "mpn": number,
    "partType": number,
    "overall": number
  }
}

Include confidence 0.0-1.0 for each field. Be conservative with confidence scores.`;

@Injectable()
export class OpenAiVisionProvider implements AiVisionProvider {
  readonly name = 'openai_vision';
  private readonly logger = new Logger(OpenAiVisionProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY', ''),
    });
    this.model = this.config.get<string>('OPENAI_VISION_MODEL', 'gpt-4o');
  }

  async analyzeImages(
    imageUrls: string[],
    prompt?: string,
  ): Promise<AiRawResponse> {
    const startMs = Date.now();
    const finalPrompt = prompt ?? MOTOR_PARTS_PROMPT;

    // Build content array with images
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: 'text', text: finalPrompt },
      ...imageUrls.map(
        (url) =>
          ({
            type: 'image_url' as const,
            image_url: { url, detail: 'high' as const },
          }),
      ),
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content }],
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const latencyMs = Date.now() - startMs;
      const tokensUsed = response.usage?.total_tokens ?? 0;
      const rawText = response.choices[0]?.message?.content ?? '{}';

      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        this.logger.warn('Failed to parse AI JSON response, wrapping raw text');
        raw = { _raw: rawText };
      }

      return {
        raw,
        provider: this.name,
        model: this.model,
        tokensUsed,
        latencyMs,
        estimatedCostUsd: this.estimateCostFromTokens(tokensUsed),
      };
    } catch (err) {
      this.logger.error('OpenAI Vision API call failed', err);
      throw err;
    }
  }

  estimateCost(imageCount: number): number {
    // Rough estimate: $0.01-0.04 per image for GPT-4o Vision
    return imageCount * 0.025;
  }

  private estimateCostFromTokens(tokens: number): number {
    // GPT-4o pricing: ~$5/1M input, ~$15/1M output
    // Rough average: $10/1M tokens
    return (tokens / 1_000_000) * 10;
  }
}
