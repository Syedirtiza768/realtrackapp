import { Injectable, Logger } from '@nestjs/common';
import type {
  AiRawResponse,
  AiVisionProvider,
  NormalizedAiFields,
} from './ai-provider.interface.js';
import { OpenAiVisionProvider } from './openai-vision.provider.js';

/**
 * AI service abstraction — routes to the preferred provider
 * and normalizes results into a standard shape.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providers: Map<string, AiVisionProvider>;

  constructor(private readonly openaiProvider: OpenAiVisionProvider) {
    this.providers = new Map<string, AiVisionProvider>();
    this.providers.set('openai', openaiProvider);
    // Future: this.providers.set('google', googleVisionProvider);
  }

  getProvider(name?: string): AiVisionProvider {
    const key = name ?? 'openai';
    const provider = this.providers.get(key);
    if (!provider) {
      this.logger.warn(`Unknown provider "${key}", falling back to openai`);
      return this.openaiProvider;
    }
    return provider;
  }

  /**
   * Analyze images using the specified provider and return the raw response.
   */
  async analyzeImages(
    imageUrls: string[],
    preferredProvider?: string,
  ): Promise<AiRawResponse> {
    const provider = this.getProvider(preferredProvider);
    this.logger.log(
      `Analyzing ${imageUrls.length} image(s) with provider=${provider.name}`,
    );

    try {
      return await provider.analyzeImages(imageUrls, '');
    } catch (err) {
      // If primary fails and we have a fallback, try it
      if (preferredProvider === 'openai' && this.providers.has('google')) {
        this.logger.warn('Primary provider failed, trying fallback (google)');
        const fallback = this.providers.get('google')!;
        return fallback.analyzeImages(imageUrls, '');
      }
      throw err;
    }
  }

  /**
   * Normalize an AI raw response into standardized fields.
   */
  normalizeResponse(response: AiRawResponse): NormalizedAiFields {
    const raw = response.raw as Record<string, unknown>;

    // Safely extract confidence sub-object
    const conf = (raw['confidence'] ?? {}) as Record<string, number>;

    return {
      title: this.str(raw['title']),
      brand: this.str(raw['brand']),
      mpn: this.str(raw['mpn']),
      oemNumber: this.str(raw['oemNumber']),
      partType: this.str(raw['partType']),
      condition: this.str(raw['condition']),
      priceEstimate: this.num(raw['priceEstimate']),
      description: this.str(raw['description']),
      features: Array.isArray(raw['features'])
        ? (raw['features'] as string[]).filter((f) => typeof f === 'string')
        : [],
      fitmentRaw:
        raw['fitment'] && typeof raw['fitment'] === 'object'
          ? (raw['fitment'] as Record<string, unknown>)
          : null,
      confidenceTitle: this.clamp(conf['title']),
      confidenceBrand: this.clamp(conf['brand']),
      confidenceMpn: this.clamp(conf['mpn']),
      confidencePartType: this.clamp(conf['partType']),
      confidenceOverall: this.clamp(conf['overall']),
    };
  }

  private str(val: unknown): string | null {
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null;
  }

  private num(val: unknown): number | null {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }

  private clamp(val: unknown): number {
    const n = Number(val);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }
}
