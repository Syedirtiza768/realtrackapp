import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayAuthService } from '../../../channels/ebay/ebay-auth.service.js';
import { Store } from '../../../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import { isEbayInvalidAccessTokenError } from '../../../channels/ebay/ebay-api-error.util.js';
import {
  buildPaCompliantReturnPolicyRequest,
  isLikelyEbayRestPolicyId,
  isPartsAccessoriesCompliantReturnPolicy,
  listingRequiresPartsAccessoriesReturnPolicy,
  paReturnPolicyBlockedMessage,
  partsAccessoriesReturnPolicyGuidance,
  canEvaluateReturnPolicyCompliance,
  pickReturnPolicyIdForListing,
  pickReturnPolicyUpgradeCandidate,
  readPolicyGeoSite,
} from './ebay-business-policy.util.js';
import {
  EbaySellAccountApiService,
  type EbayPolicyListItem,
} from './ebay-sell-account-api.service.js';

export type PaReturnPolicyEnsureResult = {
  returnPolicyId: string | null;
  action?: 'picked' | 'upgraded' | 'created' | 'unchanged' | 'blocked';
  blockedMessage?: string;
  accountApiUnavailable?: boolean;
};

@Injectable()
export class EbayPaReturnPolicyService {
  private readonly logger = new Logger(EbayPaReturnPolicyService.name);

  constructor(
    private readonly ebayAuth: EbayAuthService,
    private readonly sellAccount: EbaySellAccountApiService,
    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
  ) {}

  /**
   * For P&A/Motors listings: pick a compliant return policy, upgrade the closest
   * match (30+ days, buyer-paid shipping), or create a new compliant policy.
   */
  async ensureCompliantReturnPolicy(params: {
    store: Store;
    account: ConnectedEbayAccount;
    marketplaceId: string;
    categoryId?: string;
    condition?: string;
    currentReturnPolicyId?: string | null;
  }): Promise<PaReturnPolicyEnsureResult> {
    const {
      store,
      account,
      marketplaceId,
      categoryId,
      condition,
      currentReturnPolicyId,
    } = params;

    if (
      !listingRequiresPartsAccessoriesReturnPolicy(
        marketplaceId,
        categoryId,
        condition,
      )
    ) {
      return {
        returnPolicyId: currentReturnPolicyId ?? null,
        action: 'unchanged',
      };
    }

    const cachedCurrent = currentReturnPolicyId
      ? await this.policyRepo.findOne({
          where: {
            ebayAccountId: account.id,
            marketplaceId,
            policyType: 'return',
            ebayPolicyId: currentReturnPolicyId,
          },
        })
      : null;
    if (
      isPartsAccessoriesCompliantReturnPolicy(cachedCurrent?.rawPayload ?? {})
    ) {
      return { returnPolicyId: currentReturnPolicyId!, action: 'picked' };
    }

    let token: string;
    let baseUrl: string;
    let accountApiUnavailable = false;
    try {
      token = await this.ebayAuth.getAccessToken(store.id, {
        forceRefresh: account.connectionSource === 'sellerpundit',
      });
      baseUrl = await this.ebayAuth.getApiBaseUrlForStore(store.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Cannot ensure P&A return policy for "${store.storeName}": ${msg}`,
      );
      return this.blockNonCompliant(
        currentReturnPolicyId,
        cachedCurrent?.rawPayload,
        store.storeName,
        accountApiUnavailable,
        marketplaceId,
        condition,
      );
    }

    let policies: EbayPolicyListItem[] = [];
    try {
      policies = await this.sellAccount.listReturnPolicies(
        token,
        baseUrl,
        marketplaceId,
      );
    } catch (err: unknown) {
      accountApiUnavailable = isEbayInvalidAccessTokenError(err);
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Return policy list failed for "${store.storeName}": ${msg}`,
      );
      return this.blockNonCompliant(
        currentReturnPolicyId,
        cachedCurrent?.rawPayload,
        store.storeName,
        accountApiUnavailable,
        marketplaceId,
        condition,
      );
    }

    const candidates = policies.map((p) => ({
      ebayPolicyId: p.ebayPolicyId,
      isDefault: p.isDefault,
      geoSite: readPolicyGeoSite(p.raw),
      rawPayload: p.raw,
    }));

    const picked = pickReturnPolicyIdForListing(
      candidates,
      marketplaceId,
      categoryId,
      condition,
    );
    if (picked) {
      await this.persistReturnPolicy(
        account.id,
        marketplaceId,
        policies,
        picked,
      );
      await this.updateMarketplaceDefault(account.id, marketplaceId, picked);
      return { returnPolicyId: picked, action: 'picked' };
    }

    const upgrade = pickReturnPolicyUpgradeCandidate(
      candidates,
      marketplaceId,
      currentReturnPolicyId,
    );
    if (upgrade) {
      try {
        const body = buildPaCompliantReturnPolicyRequest(
          marketplaceId,
          upgrade.rawPayload ?? {},
        );
        await this.sellAccount.updateReturnPolicy(
          token,
          baseUrl,
          marketplaceId,
          upgrade.ebayPolicyId,
          body,
        );
        const refreshed = await this.sellAccount.listReturnPolicies(
          token,
          baseUrl,
          marketplaceId,
        );
        const upgradedRaw = refreshed.find(
          (p) => p.ebayPolicyId === upgrade.ebayPolicyId,
        )?.raw;
        if (!isPartsAccessoriesCompliantReturnPolicy(upgradedRaw ?? {})) {
          throw new Error(
            `eBay did not persist seller-paid return shipping on policy ${upgrade.ebayPolicyId}`,
          );
        }
        await this.persistReturnPolicy(
          account.id,
          marketplaceId,
          refreshed,
          upgrade.ebayPolicyId,
        );
        await this.updateMarketplaceDefault(
          account.id,
          marketplaceId,
          upgrade.ebayPolicyId,
        );
        this.logger.log(
          `Upgraded return policy ${upgrade.ebayPolicyId} to P&A-compliant (seller-paid, 30+ days) for "${store.storeName}"`,
        );
        return { returnPolicyId: upgrade.ebayPolicyId, action: 'upgraded' };
      } catch (err: unknown) {
        if (isEbayInvalidAccessTokenError(err)) {
          accountApiUnavailable = true;
        }
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Return policy upgrade failed for ${upgrade.ebayPolicyId} on "${store.storeName}": ${msg}`,
        );
      }
    }

    try {
      const template =
        upgrade?.rawPayload ??
        candidates.find((c) =>
          canEvaluateReturnPolicyCompliance(c.rawPayload ?? {}),
        )?.rawPayload;
      const body = buildPaCompliantReturnPolicyRequest(marketplaceId, template);
      body.name = 'P&A Compliant Return (RealTrack)';
      const created = await this.sellAccount.createReturnPolicy(
        token,
        baseUrl,
        marketplaceId,
        body,
      );
      const refreshed = await this.sellAccount.listReturnPolicies(
        token,
        baseUrl,
        marketplaceId,
      );
      await this.persistReturnPolicy(
        account.id,
        marketplaceId,
        refreshed,
        created.returnPolicyId,
      );
      await this.updateMarketplaceDefault(
        account.id,
        marketplaceId,
        created.returnPolicyId,
      );
      this.logger.log(
        `Created P&A-compliant return policy ${created.returnPolicyId} for "${store.storeName}"`,
      );
      return { returnPolicyId: created.returnPolicyId, action: 'created' };
    } catch (err: unknown) {
      if (isEbayInvalidAccessTokenError(err)) {
        accountApiUnavailable = true;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Create P&A return policy failed for "${store.storeName}": ${msg}`,
      );
    }

    return this.blockNonCompliant(
      currentReturnPolicyId,
      cachedCurrent?.rawPayload,
      store.storeName,
      accountApiUnavailable,
      marketplaceId,
      condition,
    );
  }

  private blockNonCompliant(
    returnPolicyId: string | null | undefined,
    raw: Record<string, unknown> | undefined,
    storeName: string,
    accountApiUnavailable: boolean,
    marketplaceId?: string,
    condition?: string,
  ): PaReturnPolicyEnsureResult {
    if (!returnPolicyId) {
      return {
        returnPolicyId: null,
        action: 'blocked',
        blockedMessage: partsAccessoriesReturnPolicyGuidance(),
        accountApiUnavailable,
      };
    }
    return {
      returnPolicyId: null,
      action: 'blocked',
      accountApiUnavailable,
      blockedMessage: paReturnPolicyBlockedMessage({
        returnPolicyId,
        raw,
        storeName,
        marketplaceId,
        condition,
        accountApiUnavailable,
      }),
    };
  }

  private async persistReturnPolicy(
    ebayAccountId: string,
    marketplaceId: string,
    policies: EbayPolicyListItem[],
    returnPolicyId: string,
  ): Promise<void> {
    const match = policies.find((p) => p.ebayPolicyId === returnPolicyId);
    if (!match || !isLikelyEbayRestPolicyId(returnPolicyId)) return;

    const existing = await this.policyRepo.findOne({
      where: {
        ebayAccountId,
        marketplaceId,
        policyType: 'return',
        ebayPolicyId: returnPolicyId,
      },
    });
    if (existing) {
      existing.name = match.name;
      existing.rawPayload = match.raw;
      existing.isDefault = match.isDefault;
      await this.policyRepo.save(existing);
      return;
    }

    await this.policyRepo.save(
      this.policyRepo.create({
        ebayAccountId,
        marketplaceId,
        policyType: 'return',
        ebayPolicyId: returnPolicyId,
        name: match.name,
        rawPayload: match.raw,
        isDefault: match.isDefault,
      }),
    );
  }

  private async updateMarketplaceDefault(
    ebayAccountId: string,
    marketplaceId: string,
    returnPolicyId: string,
  ): Promise<void> {
    const mp = await this.mpRepo.findOne({
      where: { ebayAccountId, marketplaceId },
    });
    if (!mp) return;
    mp.defaultReturnPolicyId = returnPolicyId;
    await this.mpRepo.save(mp);
  }
}
