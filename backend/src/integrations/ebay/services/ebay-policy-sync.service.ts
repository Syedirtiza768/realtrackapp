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
}
