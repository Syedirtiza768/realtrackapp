import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';
import { EbayAccountTokenService } from './ebay-account-token.service.js';

export type ValidationStatus = 'ready' | 'warnings' | 'blocked';

export interface ListingValidationResult {
  status: ValidationStatus;
  errors: string[];
  warnings: string[];
  requiredActions: string[];
}

@Injectable()
export class EbayListingValidationService {
  constructor(
    private readonly marketplaceConfig: EbayMarketplaceConfigService,
    private readonly tokens: EbayAccountTokenService,
    @InjectRepository(CatalogProduct)
    private readonly catalogRepo: Repository<CatalogProduct>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
  ) {}

  async validatePublish(params: {
    organizationId: string;
    catalogProductId: string;
    ebayAccountId: string;
    marketplaceId: string;
  }): Promise<ListingValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredActions: string[] = [];

    const mp = this.marketplaceConfig.get(params.marketplaceId);
    if (!mp) {
      errors.push(`Unsupported marketplace ${params.marketplaceId}`);
    }

    const account = await this.accountRepo.findOne({
      where: { id: params.ebayAccountId, organizationId: params.organizationId },
      relations: ['oauthToken'],
    });
    if (!account) {
      errors.push('eBay account not found for organization');
      return { status: 'blocked', errors, warnings, requiredActions };
    }

    if (account.connectionStatus === 'disabled') {
      errors.push('eBay account is disabled');
    }
    if (
      account.connectionStatus === 'reconnect_required' ||
      account.connectionStatus === 'token_expired' ||
      account.oauthToken?.reconnectRequired
    ) {
      errors.push('eBay account requires reconnection');
      requiredActions.push('reconnect_oauth');
    }

    const mpRow = await this.mpRepo.findOne({
      where: {
        ebayAccountId: params.ebayAccountId,
        marketplaceId: params.marketplaceId,
      },
    });
    if (mpRow && !mpRow.enabled) {
      errors.push('Marketplace is disabled for this account');
    }

    if (!mpRow) {
      errors.push(
        'Marketplace is not configured for this eBay account — reconnect or add a marketplace row.',
      );
    } else {
      if (!mpRow.defaultFulfillmentPolicyId) {
        errors.push('Default fulfillment policy is required — sync policies from eBay or map defaults.');
        requiredActions.push('map_fulfillment_policy');
      }
      if (!mpRow.defaultPaymentPolicyId) {
        errors.push('Default payment policy is required — sync policies from eBay or map defaults.');
        requiredActions.push('map_payment_policy');
      }
      if (!mpRow.defaultReturnPolicyId) {
        errors.push('Default return policy is required — sync policies from eBay or map defaults.');
        requiredActions.push('map_return_policy');
      }
      if (!mpRow.defaultInventoryLocationKey) {
        errors.push(
          'Default inventory location is required — sync policies from eBay or map a merchant location key.',
        );
        requiredActions.push('map_inventory_location');
      }
    }

    const product = await this.catalogRepo.findOne({
      where: { id: params.catalogProductId },
    });
    if (!product) {
      errors.push('Catalog product not found');
    } else {
      if (!product.sku?.trim()) {
        errors.push('Catalog product is missing SKU');
      }
      if (product.price == null || Number(product.price) <= 0) {
        errors.push('Catalog product has invalid price');
      }
      if (product.quantity == null || product.quantity < 0) {
        errors.push('Catalog product has invalid quantity');
      }
      if (!product.imageUrls?.length) {
        errors.push('Catalog product requires at least one image');
      }
      if (!product.categoryId?.trim()) {
        warnings.push('Category not set on catalog product — eBay publish may fail');
      }
      if (mp?.requiresLocalizedDescription) {
        if (!product.description?.trim()) {
          errors.push('Localized description required for this marketplace');
        } else if (params.marketplaceId === 'EBAY_DE') {
          const deHint = /[äöüßÄÖÜ]/.test(product.description);
          if (!deHint) {
            warnings.push(
              'German marketplace: description may need German-language content',
            );
          }
        }
      }
    }

    try {
      await this.tokens.getValidAccessToken(params.ebayAccountId);
    } catch {
      errors.push('Unable to obtain a valid OAuth token for this account');
    }

    let status: ValidationStatus = 'ready';
    if (errors.length) status = 'blocked';
    else if (warnings.length || requiredActions.length) status = 'warnings';

    return { status, errors, warnings, requiredActions };
  }
}
