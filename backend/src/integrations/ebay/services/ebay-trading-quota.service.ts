import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EbayAuthService } from '../../../channels/ebay/ebay-auth.service.js';

type AnalyticsRate = {
  limit?: number;
  remaining?: number;
  reset?: string;
};

type AnalyticsResponse = {
  rateLimits?: Array<{
    resources?: Array<{ name?: string; rates?: AnalyticsRate[] }>;
  }>;
};

@Injectable()
export class EbayTradingQuotaService {
  constructor(private readonly auth: EbayAuthService) {}

  /** eBay's application-wide Trading allowance, shared by publishing and reads. */
  async getPublishCapacity(): Promise<{
    remaining: number;
    limit: number;
    reset: Date;
  }> {
    try {
      const token = await this.auth.getApplicationToken();
      const baseUrl = this.auth.getApiConfig().baseUrl;
      const response = await fetch(
        `${baseUrl}/developer/analytics/v1_beta/rate_limit/?api_name=tradingapi`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) throw new Error(`Analytics HTTP ${response.status}`);
      const body = (await response.json()) as AnalyticsResponse;
      const rate = body.rateLimits
        ?.flatMap((api) => api.resources ?? [])
        .find((resource) => resource.name === 'AddFixedPriceItem')?.rates?.[0];
      const reset = new Date(rate?.reset ?? '');
      if (
        !rate ||
        !Number.isFinite(rate.limit) ||
        !Number.isFinite(rate.remaining) ||
        !Number.isFinite(reset.getTime())
      ) {
        throw new Error('AddFixedPriceItem quota is missing from Analytics');
      }
      return {
        remaining: Math.max(0, rate.remaining!),
        limit: rate.limit!,
        reset,
      };
    } catch {
      throw new ServiceUnavailableException(
        'eBay Trading API allowance is unavailable. Bulk publishing is paused until the allowance can be checked.',
      );
    }
  }
}
