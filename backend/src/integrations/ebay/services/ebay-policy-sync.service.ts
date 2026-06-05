import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayAccountTokenService } from './ebay-account-token.service.js';
import {
  EbaySellAccountApiService,
  type EbayPolicyListItem,
} from './ebay-sell-account-api.service.js';
import { ListingActionLogWriterService } from './listing-action-log-writer.service.js';
import { SellerpunditPolicySyncService } from '../../sellerpundit/sellerpundit-policy-sync.service.js';
import { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import { EbayAuthService } from '../../../channels/ebay/ebay-auth.service.js';
import {
  coalesceValidPolicyId,
  isLikelyEbayRestPolicyId,
  pickReturnPolicyIdForListing,
} from './ebay-business-policy.util.js';

@Injectable()
export class EbayPolicySyncService {
  private readonly logger = new Logger(EbayPolicySyncService.name);

  constructor(
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
    private readonly tokens: EbayAccountTokenService,
    private readonly sellAccount: EbaySellAccountApiService,
    private readonly logWriter: ListingActionLogWriterService,
    private readonly sellerpunditPolicies: SellerpunditPolicySyncService,
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly ebayAuth: EbayAuthService,
  ) {}

  private baseUrl(env: ConnectedEbayAccount['environment']): string {
    return env === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
  }

  /**
   * Pull payment / return / fulfillment policies from eBay Account API,
   * inventory locations from Inventory API, persist into `ebay_business_policies`,
   * and hydrate missing defaults on `ebay_account_marketplaces`.
   */
  async syncPolicies(
    ebayAccountId: string,
    organizationId: string,
    userId?: string | null,
  ): Promise<{ ok: boolean; synced: number; message: string }> {
    const account = await this.accountRepo.findOne({
      where: { id: ebayAccountId, organizationId },
      relations: ['marketplaces'],
    });
    if (!account) {
      throw new NotFoundException('eBay account not found');
    }

    if (account.connectionSource === 'sellerpundit') {
      const spResult = await this.sellerpunditPolicies.syncPolicies(
        ebayAccountId,
        organizationId,
        userId,
      );
      const overlaySynced = await this.overlaySellerpunditPoliciesFromEbayApi(
        account,
      );
      await this.hydrateInventoryLocationsFromStore(account);
      return {
        ...spResult,
        synced: spResult.synced + overlaySynced,
        message:
          overlaySynced > 0
            ? `${spResult.message} Overlaid ${overlaySynced} row(s) from eBay Account API.`
            : spResult.message,
      };
    }

    const rel = account.marketplaces ?? [];
    let marketplaces = rel.length
      ? rel
      : await this.mpRepo.find({ where: { ebayAccountId } });
    marketplaces = marketplaces.filter((m) => m.enabled);

    if (!marketplaces.length) {
      return {
        ok: false,
        synced: 0,
        message: 'No enabled marketplace rows for this account — connect OAuth with a marketplace first.',
      };
    }

    const token = await this.tokens.getValidAccessToken(ebayAccountId);
    const baseUrl = this.baseUrl(account.environment);
    let synced = 0;

    for (const mp of marketplaces) {
      await this.policyRepo.delete({
        ebayAccountId,
        marketplaceId: mp.marketplaceId,
      });

      let fulfill: EbayPolicyListItem[] = [];
      let payment: EbayPolicyListItem[] = [];
      let ret: EbayPolicyListItem[] = [];
      try {
        [fulfill, payment, ret] = await Promise.all([
          this.sellAccount.listFulfillmentPolicies(token, baseUrl, mp.marketplaceId),
          this.sellAccount.listPaymentPolicies(token, baseUrl, mp.marketplaceId),
          this.sellAccount.listReturnPolicies(token, baseUrl, mp.marketplaceId),
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Policy fetch failed for account=${ebayAccountId} mp=${mp.marketplaceId}: ${msg}`,
        );
        throw err;
      }

      for (const p of fulfill) {
        await this.policyRepo.save(
          this.policyRepo.create({
            ebayAccountId,
            marketplaceId: mp.marketplaceId,
            policyType: 'fulfillment',
            ebayPolicyId: p.ebayPolicyId,
            name: p.name,
            rawPayload: p.raw,
            isDefault: p.isDefault,
          }),
        );
        synced++;
      }
      for (const p of payment) {
        await this.policyRepo.save(
          this.policyRepo.create({
            ebayAccountId,
            marketplaceId: mp.marketplaceId,
            policyType: 'payment',
            ebayPolicyId: p.ebayPolicyId,
            name: p.name,
            rawPayload: p.raw,
            isDefault: p.isDefault,
          }),
        );
        synced++;
      }
      for (const p of ret) {
        await this.policyRepo.save(
          this.policyRepo.create({
            ebayAccountId,
            marketplaceId: mp.marketplaceId,
            policyType: 'return',
            ebayPolicyId: p.ebayPolicyId,
            name: p.name,
            rawPayload: p.raw,
            isDefault: p.isDefault,
          }),
        );
        synced++;
      }

      let locations: { merchantLocationKey: string; name: string }[] = [];
      try {
        locations = await this.sellAccount.listInventoryLocations(
          token,
          baseUrl,
          mp.marketplaceId,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Inventory locations fetch failed account=${ebayAccountId} mp=${mp.marketplaceId}: ${msg}`,
        );
      }

      const pick = (items: EbayPolicyListItem[]) =>
        items.find((x) => x.isDefault)?.ebayPolicyId ?? items[0]?.ebayPolicyId ?? null;

      if (!mp.defaultFulfillmentPolicyId) {
        mp.defaultFulfillmentPolicyId = pick(fulfill);
      }
      if (!mp.defaultPaymentPolicyId) {
        mp.defaultPaymentPolicyId = pick(payment);
      }
      if (!mp.defaultReturnPolicyId) {
        mp.defaultReturnPolicyId = pick(ret);
      }
      if (!mp.defaultInventoryLocationKey && locations.length) {
        mp.defaultInventoryLocationKey = locations[0].merchantLocationKey;
      }
      await this.mpRepo.save(mp);
    }

    account.lastVerifiedAt = new Date();
    account.lastPoliciesFetchedCount = synced;
    account.lastSuccessfulSyncAt = new Date();
    await this.accountRepo.save(account);

    await this.logWriter.write({
      organizationId,
      userId: userId ?? null,
      ebayAccountId,
      action: 'ebay_policies_synced',
      result: 'success',
      afterSnapshot: {
        synced,
        marketplaces: marketplaces.map((m) => m.marketplaceId),
      },
    });

    return {
      ok: true,
      synced,
      message: `Synced ${synced} policy rows across ${marketplaces.length} marketplace(s).`,
    };
  }

  /**
   * When SellerPundit policy sync stores internal ids, overlay authoritative eBay
   * Account API policies using the linked store OAuth token.
   */
  private async overlaySellerpunditPoliciesFromEbayApi(
    account: ConnectedEbayAccount,
  ): Promise<number> {
    if (!account.primaryStoreId) return 0;

    let token: string;
    try {
      token = await this.ebayAuth.getAccessToken(account.primaryStoreId, {
        forceRefresh: true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `SellerPundit Account API policy overlay skipped (token): ${msg}`,
      );
      return 0;
    }

    const baseUrl = this.baseUrl(account.environment);
    const marketplaces = await this.mpRepo.find({
      where: { ebayAccountId: account.id, enabled: true },
    });
    let synced = 0;

    for (const mp of marketplaces) {
      try {
        const [fulfill, payment, ret] = await Promise.all([
          this.sellAccount.listFulfillmentPolicies(
            token,
            baseUrl,
            mp.marketplaceId,
          ),
          this.sellAccount.listPaymentPolicies(
            token,
            baseUrl,
            mp.marketplaceId,
          ),
          this.sellAccount.listReturnPolicies(token, baseUrl, mp.marketplaceId),
        ]);
        if (!fulfill.length && !payment.length && !ret.length) continue;

        await this.policyRepo.delete({
          ebayAccountId: account.id,
          marketplaceId: mp.marketplaceId,
        });

        for (const p of fulfill) {
          if (!isLikelyEbayRestPolicyId(p.ebayPolicyId)) continue;
          await this.policyRepo.save(
            this.policyRepo.create({
              ebayAccountId: account.id,
              marketplaceId: mp.marketplaceId,
              policyType: 'fulfillment',
              ebayPolicyId: p.ebayPolicyId,
              name: p.name,
              rawPayload: p.raw,
              isDefault: p.isDefault,
            }),
          );
          synced++;
        }
        for (const p of payment) {
          if (!isLikelyEbayRestPolicyId(p.ebayPolicyId)) continue;
          await this.policyRepo.save(
            this.policyRepo.create({
              ebayAccountId: account.id,
              marketplaceId: mp.marketplaceId,
              policyType: 'payment',
              ebayPolicyId: p.ebayPolicyId,
              name: p.name,
              rawPayload: p.raw,
              isDefault: p.isDefault,
            }),
          );
          synced++;
        }
        for (const p of ret) {
          if (!isLikelyEbayRestPolicyId(p.ebayPolicyId)) continue;
          await this.policyRepo.save(
            this.policyRepo.create({
              ebayAccountId: account.id,
              marketplaceId: mp.marketplaceId,
              policyType: 'return',
              ebayPolicyId: p.ebayPolicyId,
              name: p.name,
              rawPayload: p.raw,
              isDefault: p.isDefault,
            }),
          );
          synced++;
        }

        const pick = (items: EbayPolicyListItem[]) =>
          items.find((x) => x.isDefault)?.ebayPolicyId ?? items[0]?.ebayPolicyId;
        const fulfillmentPolicyId = coalesceValidPolicyId(pick(fulfill));
        const paymentPolicyId = coalesceValidPolicyId(pick(payment));
        const returnPolicyId = coalesceValidPolicyId(
          pickReturnPolicyIdForListing(
            ret.map((r) => ({
              ebayPolicyId: r.ebayPolicyId,
              isDefault: r.isDefault,
              geoSite: null,
              rawPayload: r.raw,
            })),
            mp.marketplaceId,
          ),
        );

        if (fulfillmentPolicyId) {
          mp.defaultFulfillmentPolicyId = fulfillmentPolicyId;
        }
        if (paymentPolicyId) mp.defaultPaymentPolicyId = paymentPolicyId;
        if (returnPolicyId) mp.defaultReturnPolicyId = returnPolicyId;
        await this.mpRepo.save(mp);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Account API policy overlay failed for ${mp.marketplaceId}: ${msg}`,
        );
      }
    }

    return synced;
  }

  /**
   * SellerPundit policy sync does not return inventory locations — hydrate from eBay
   * Inventory API using the linked legacy store token (or create a default location).
   */
  private async hydrateInventoryLocationsFromStore(
    account: ConnectedEbayAccount,
  ): Promise<void> {
    if (!account.primaryStoreId) return;

    const key = await this.inventoryApi.ensureMerchantLocation(
      account.primaryStoreId,
    );
    if (!key) return;

    const marketplaces = await this.mpRepo.find({
      where: { ebayAccountId: account.id },
    });
    for (const mp of marketplaces) {
      if (!mp.defaultInventoryLocationKey) {
        mp.defaultInventoryLocationKey = key;
        await this.mpRepo.save(mp);
      }
    }
  }
}
