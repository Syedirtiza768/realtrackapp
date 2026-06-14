import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';
import { EbayAccountTokenService } from './ebay-account-token.service.js';
import { SellerpunditPolicySyncService } from '../../sellerpundit/sellerpundit-policy-sync.service.js';
import { SellerpunditTokenSyncService } from '../../sellerpundit/sellerpundit-token-sync.service.js';
import { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import {
  buildEbayListingTitle,
  EBAY_OFFER_DESCRIPTION_MAX_LENGTH,
  EBAY_TITLE_MAX_LENGTH,
  normalizeListingText,
  stripListingHtmlBoilerplate,
} from '../../../channels/ebay/ebay-listing-text.util.js';
import { CatalogPublishResolverService } from './catalog-publish-resolver.service.js';

export type ValidationStatus = 'ready' | 'warnings' | 'blocked';

export interface ListingValidationResult {
  status: ValidationStatus;
  errors: string[];
  warnings: string[];
  requiredActions: string[];
}

@Injectable()
export class EbayListingValidationService {
  private readonly logger = new Logger(EbayListingValidationService.name);

  constructor(
    private readonly marketplaceConfig: EbayMarketplaceConfigService,
    private readonly tokens: EbayAccountTokenService,
    private readonly sellerpunditPolicies: SellerpunditPolicySyncService,
    private readonly sellerpunditTokens: SellerpunditTokenSyncService,
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly publishResolver: CatalogPublishResolverService,
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
    const isSellerpundit = account.connectionSource === 'sellerpundit';
    if (
      account.connectionStatus === 'reconnect_required' ||
      account.connectionStatus === 'token_expired' ||
      account.oauthToken?.reconnectRequired
    ) {
      errors.push(
        isSellerpundit
          ? `eBay rejected the OAuth token for "${account.accountDisplayName ?? account.ebayUsername ?? 'this store'}". Re-sync in RealTrackApp only refreshes what SellerPundit has — reconnect eBay for this store inside SellerPundit admin, then Re-sync stores here.`
          : 'eBay account requires reconnection',
      );
      requiredActions.push(isSellerpundit ? 'reconnect_sellerpundit_ebay' : 'reconnect_oauth');
    } else if (isSellerpundit) {
      const tokenOk = await this.sellerpunditTokens.validateAccountEbayToken(
        params.ebayAccountId,
        params.marketplaceId,
      );
      if (!tokenOk) {
        errors.push(
          `eBay rejected the OAuth token for "${account.accountDisplayName ?? account.ebayUsername ?? 'this store'}". SellerPundit still lists this store as connected, but its eBay authorization is invalid. Reconnect eBay in SellerPundit for this account, then Re-sync stores in Settings → eBay Integrations.`,
        );
        requiredActions.push('reconnect_sellerpundit_ebay');
      }
    }

    if (isSellerpundit) {
      try {
        const pr = await this.sellerpunditPolicies.ensurePoliciesFresh(
          params.ebayAccountId,
          params.organizationId,
          params.marketplaceId,
        );
        if (!pr.ok) {
          errors.push(pr.message || 'SellerPundit policy sync failed');
          requiredActions.push('sync_sellerpundit_policies');
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`SellerPundit policy refresh failed: ${msg}`);
        requiredActions.push('sync_sellerpundit_policies');
      }

      // Hydrate inventory location — SellerPundit policy sync only handles
      // policy IDs, not inventory locations. Auto-resolve via eBay Inventory API.
      if (account.primaryStoreId) {
        try {
          const key = await this.inventoryApi.ensureMerchantLocation(account.primaryStoreId);
          if (key) {
            await this.mpRepo
              .createQueryBuilder()
              .update()
              .set({ defaultInventoryLocationKey: key })
              .where('ebay_account_id = :accountId', { accountId: params.ebayAccountId })
              .andWhere('default_inventory_location_key IS NULL')
              .execute();
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`Inventory location hydration failed for ${params.ebayAccountId}: ${msg}`);
        }
      }
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
        errors.push(
          isSellerpundit
            ? 'Default fulfillment policy is required — sync policies from SellerPundit.'
            : 'Default fulfillment policy is required — sync policies from eBay or map defaults.',
        );
        requiredActions.push('map_fulfillment_policy');
      }
      if (!mpRow.defaultPaymentPolicyId) {
        errors.push(
          isSellerpundit
            ? 'Default payment policy is required — sync policies from SellerPundit.'
            : 'Default payment policy is required — sync policies from eBay or map defaults.',
        );
        requiredActions.push('map_payment_policy');
      }
      if (!mpRow.defaultReturnPolicyId) {
        errors.push(
          isSellerpundit
            ? 'Default return policy is required — sync policies from SellerPundit.'
            : 'Default return policy is required — sync policies from eBay or map defaults.',
        );
        requiredActions.push('map_return_policy');
      }
      if (!mpRow.defaultInventoryLocationKey) {
        errors.push(
          isSellerpundit
            ? 'Default inventory location is required — needed when SellerPundit publish falls back to direct eBay. Sync policies from eBay or map a merchant location key.'
            : 'Default inventory location is required — sync policies from eBay or map a merchant location key.',
        );
        requiredActions.push('map_inventory_location');
      }
    }

    const resolved = await this.publishResolver.resolve(params.catalogProductId);
    if (!resolved) {
      errors.push('Catalog product or listing record not found');
    } else {
      const { snapshot } = resolved;
      warnings.push(...resolved.warnings);

      if (!snapshot.sku?.trim()) {
        errors.push('Listing is missing SKU');
      }
      if (snapshot.price == null || Number(snapshot.price) <= 0) {
        errors.push('Listing has invalid price');
      }
      if (snapshot.quantity == null || snapshot.quantity < 0) {
        errors.push('Listing has invalid quantity');
      }
      if (!snapshot.imageUrls.length) {
        errors.push(
          'Listing requires at least one valid image URL (http/https) — add itemPhotoUrl or catalog images',
        );
      }
      const rawTitle = normalizeListingText(snapshot.title ?? '');
      if (!rawTitle) {
        const fallback = buildEbayListingTitle({
          brand: snapshot.brand,
          partType: snapshot.partType,
          mpn: snapshot.mpn,
          sku: snapshot.sku,
        });
        if (!fallback.title) {
          errors.push('Listing is missing a title');
        } else {
          warnings.push(
            'Listing title is empty — publish will use generated title from brand/part type/MPN or SKU',
          );
        }
      } else if (rawTitle.length > EBAY_TITLE_MAX_LENGTH) {
        warnings.push(
          `Listing title is ${rawTitle.length} characters — it will be truncated to ${EBAY_TITLE_MAX_LENGTH} for eBay`,
        );
      }
      if (!snapshot.categoryId?.trim()) {
        warnings.push('Category not set — eBay publish may fail');
      }
      const rawDesc = snapshot.description?.trim() ?? '';
      if (rawDesc) {
        const stripped = stripListingHtmlBoilerplate(rawDesc);
        if (stripped.length > EBAY_OFFER_DESCRIPTION_MAX_LENGTH) {
          warnings.push(
            `Description is ${stripped.length} characters — it will be truncated to ${EBAY_OFFER_DESCRIPTION_MAX_LENGTH} for eBay`,
          );
        }
      } else {
        warnings.push(
          'Description is empty — a short fallback will be generated at publish time',
        );
      }
      if (mp?.requiresLocalizedDescription) {
        if (!snapshot.description?.trim()) {
          errors.push('Localized description required for this marketplace');
        } else if (params.marketplaceId === 'EBAY_DE') {
          const deHint = /[äöüßÄÖÜ]/.test(snapshot.description);
          if (!deHint) {
            warnings.push(
              'German marketplace: description may need German-language content',
            );
          }
          if (snapshot.title && /\b(gebraucht OE|Genuine OEM|for \d{4})\b/i.test(snapshot.title)) {
            warnings.push(
              'German marketplace: title contains non-native phrasing — regenerate DE optimization',
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
