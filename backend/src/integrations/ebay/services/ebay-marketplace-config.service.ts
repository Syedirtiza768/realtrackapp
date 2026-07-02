import { Injectable } from '@nestjs/common';
import type { EbayMarketplaceConfig } from './ebay-marketplace-config.types.js';

@Injectable()
export class EbayMarketplaceConfigService {
  private readonly configs: Record<string, EbayMarketplaceConfig> = {
    EBAY_US: {
      marketplaceId: 'EBAY_US',
      currency: 'USD',
      locale: 'en_US',
      categoryTreeId: '0',
      defaultLanguage: 'en',
      supportsMotorsFitment: true,
      requiresLocalizedDescription: false,
    },
    EBAY_MOTORS_US: {
      marketplaceId: 'EBAY_MOTORS_US',
      currency: 'USD',
      locale: 'en_US',
      categoryTreeId: '0',
      defaultLanguage: 'en',
      supportsMotorsFitment: true,
      requiresLocalizedDescription: false,
    },
    EBAY_GB: {
      marketplaceId: 'EBAY_GB',
      currency: 'GBP',
      locale: 'en_GB',
      categoryTreeId: '3',
      defaultLanguage: 'en',
      supportsMotorsFitment: false,
      requiresLocalizedDescription: false,
    },
    EBAY_DE: {
      marketplaceId: 'EBAY_DE',
      currency: 'EUR',
      locale: 'de_DE',
      categoryTreeId: '77',
      defaultLanguage: 'de',
      supportsMotorsFitment: false,
      requiresLocalizedDescription: true,
    },
    EBAY_AU: {
      marketplaceId: 'EBAY_AU',
      currency: 'AUD',
      locale: 'en_AU',
      categoryTreeId: '15',
      defaultLanguage: 'en',
      supportsMotorsFitment: true,
      requiresLocalizedDescription: false,
    },
  };

  all(): EbayMarketplaceConfig[] {
    return Object.values(this.configs);
  }

  get(marketplaceId: string): EbayMarketplaceConfig | null {
    return this.configs[marketplaceId] ?? null;
  }

  require(marketplaceId: string): EbayMarketplaceConfig {
    const c = this.get(marketplaceId);
    if (!c) {
      throw new Error(`Unsupported marketplace: ${marketplaceId}`);
    }
    return c;
  }
}
