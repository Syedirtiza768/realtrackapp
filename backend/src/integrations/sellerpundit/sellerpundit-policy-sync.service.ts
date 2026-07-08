import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayBusinessPolicy } from '../ebay/entities/ebay-business-policy.entity.js';
import { EbayAccountMarketplace } from '../ebay/entities/ebay-account-marketplace.entity.js';
import { ListingActionLogWriterService } from '../ebay/services/listing-action-log-writer.service.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import {
  extractEbayRestPolicyId,
  hasValidDefaultPolicyIds,
  pickPolicyIdForMarketplace,
  pickReturnPolicyIdForListing,
  readPolicyGeoSite,
  type EbayPolicyKind,
} from '../ebay/services/ebay-business-policy.util.js';

type SpPolicyType = 'shipping' | 'payment' | 'return';

interface ParsedPolicy {
  ebayPolicyId: string;
  name: string;
  raw: Record<string, unknown>;
  isDefault: boolean;
  geoSite: string | null;
}

@Injectable()
export class SellerpunditPolicySyncService {
  private readonly logger = new Logger(SellerpunditPolicySyncService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly auth: SellerpunditAuthService,
    private readonly http: SellerpunditHttpClient,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
    private readonly logWriter: ListingActionLogWriterService,
  ) {}

  policyMaxAgeMs(): number {
    const hours = Number(
      this.config.get('SELLERPUNDIT_POLICY_SYNC_MAX_AGE_HOURS', 24),
    );
    return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000;
  }

  async ensurePoliciesFresh(
    ebayAccountId: string,
    organizationId: string,
    marketplaceId: string,
  ): Promise<{ ok: boolean; synced: number; message: string }> {
    const account = await this.accountRepo.findOne({
      where: {
        id: ebayAccountId,
        organizationId,
        connectionSource: 'sellerpundit',
      },
    });
    if (!account) {
      throw new NotFoundException('SellerPundit eBay account not found');
    }

    const mpRow = await this.mpRepo.findOne({
      where: { ebayAccountId, marketplaceId },
    });
    const policyCount = await this.policyRepo.count({
      where: { ebayAccountId, marketplaceId },
    });

    const stale =
      !account.sellerpunditLastPolicySyncAt ||
      Date.now() - new Date(account.sellerpunditLastPolicySyncAt).getTime() >
        this.policyMaxAgeMs();

    const missingDefaults =
      !mpRow?.defaultFulfillmentPolicyId ||
      !mpRow?.defaultPaymentPolicyId ||
      !mpRow?.defaultReturnPolicyId ||
      !mpRow?.defaultInventoryLocationKey;
    const invalidDefaults = !hasValidDefaultPolicyIds(mpRow);

    if (policyCount === 0 || stale || missingDefaults || invalidDefaults) {
      return this.syncPolicies(
        ebayAccountId,
        organizationId,
        null,
        marketplaceId,
      );
    }

    return {
      ok: true,
      synced: policyCount,
      message: 'Policies are up to date',
    };
  }

  async syncPolicies(
    ebayAccountId: string,
    organizationId: string,
    userId?: string | null,
    onlyMarketplaceId?: string,
  ): Promise<{ ok: boolean; synced: number; message: string }> {
    const account = await this.accountRepo.findOne({
      where: { id: ebayAccountId, organizationId },
      relations: ['marketplaces'],
    });
    if (!account) throw new NotFoundException('eBay account not found');
    if (account.connectionSource !== 'sellerpundit') {
      throw new NotFoundException('Account is not a SellerPundit connection');
    }
    if (!account.sellerpunditAccountName) {
      return {
        ok: false,
        synced: 0,
        message: 'Missing SellerPundit account name',
      };
    }

    let marketplaces = account.marketplaces ?? [];
    if (!marketplaces.length) {
      marketplaces = await this.mpRepo.find({ where: { ebayAccountId } });
    }
    if (onlyMarketplaceId) {
      marketplaces = marketplaces.filter(
        (m) => m.marketplaceId === onlyMarketplaceId,
      );
    }
    marketplaces = marketplaces.filter((m) => m.enabled);
    if (!marketplaces.length) {
      return {
        ok: false,
        synced: 0,
        message: 'No enabled marketplace rows for this account',
      };
    }

    const jwt = await this.auth.getJwt(organizationId);
    const accountName = account.sellerpunditAccountName;
    let synced = 0;

    for (const mp of marketplaces) {
      // Fetch from API FIRST — if this fails, existing policies are untouched
      const [fulfill, payment, ret] = await Promise.all([
        this.fetchPolicies(jwt, accountName, 'shipping'),
        this.fetchPolicies(jwt, accountName, 'payment'),
        this.fetchPolicies(jwt, accountName, 'return'),
      ]);

      // Atomic replace: delete old + insert new in a single transaction
      await this.policyRepo.manager.transaction(async (trx) => {
        await trx.delete(EbayBusinessPolicy, {
          ebayAccountId,
          marketplaceId: mp.marketplaceId,
        });

        for (const p of fulfill) {
          await trx.save(
            trx.create(EbayBusinessPolicy, {
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
          await trx.save(
            trx.create(EbayBusinessPolicy, {
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
          await trx.save(
            trx.create(EbayBusinessPolicy, {
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
      });

      const fulfillPick = pickPolicyIdForMarketplace(fulfill, mp.marketplaceId);
      const paymentPick = pickPolicyIdForMarketplace(payment, mp.marketplaceId);
      const returnPick = pickReturnPolicyIdForListing(
        ret.map((p) => ({
          ebayPolicyId: p.ebayPolicyId,
          isDefault: p.isDefault,
          geoSite: p.geoSite,
          rawPayload: p.raw,
        })),
        mp.marketplaceId,
      );

      mp.defaultFulfillmentPolicyId = fulfillPick ?? null;
      mp.defaultPaymentPolicyId = paymentPick ?? null;
      mp.defaultReturnPolicyId = returnPick ?? null;
      await this.mpRepo.save(mp);
    }

    account.lastPoliciesFetchedCount = synced;
    account.lastSuccessfulSyncAt = new Date();
    account.sellerpunditLastPolicySyncAt = new Date();
    account.lastVerifiedAt = new Date();
    await this.accountRepo.save(account);

    await this.logWriter.write({
      organizationId,
      userId: userId ?? null,
      ebayAccountId,
      action: 'sellerpundit_policies_synced',
      result: 'success',
      afterSnapshot: {
        synced,
        marketplaces: marketplaces.map((m) => m.marketplaceId),
      },
    });

    return {
      ok: synced > 0,
      synced,
      message: `Synced ${synced} SellerPundit policy row(s).`,
    };
  }

  private async fetchPolicies(
    jwt: string,
    accountName: string,
    policyType: SpPolicyType,
  ): Promise<ParsedPolicy[]> {
    try {
      const raw = await this.http.get<unknown>(
        jwt,
        '/master/get-all-policies',
        { accountName, policyType },
      );
      const kind: EbayPolicyKind =
        policyType === 'shipping'
          ? 'fulfillment'
          : policyType === 'payment'
            ? 'payment'
            : 'return';
      return this.parsePolicies(raw, kind);
    } catch (e) {
      const msg =
        e instanceof HttpException
          ? ((e.getResponse() as Record<string, unknown>)?.message ?? e.message)
          : (e as Error).message;
      this.logger.error(`SP policies ${policyType} failed: ${msg}`);
      throw e;
    }
  }

  private parsePolicies(raw: unknown, kind?: EbayPolicyKind): ParsedPolicy[] {
    const list = this.unwrapArray(raw);
    const out: ParsedPolicy[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const policyKind: EbayPolicyKind =
        kind ??
        (o.fulfillmentPolicyId != null || o.policyType === 'shipping'
          ? 'fulfillment'
          : o.paymentPolicyId != null
            ? 'payment'
            : 'return');
      const ebayPolicyId = extractEbayRestPolicyId(o, policyKind);
      if (!ebayPolicyId) continue;
      out.push({
        ebayPolicyId,
        name: String(
          o.name ?? o.policyName ?? o.title ?? `Policy ${ebayPolicyId}`,
        ),
        raw: o,
        isDefault: Boolean(o.default ?? o.isDefault ?? o.is_default),
        geoSite: readPolicyGeoSite(o),
      });
    }
    return out;
  }

  private unwrapArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      if (Array.isArray(o.data)) return o.data;
      if (Array.isArray(o.policies)) return o.policies;
      if (o.data && typeof o.data === 'object') {
        const d = o.data as Record<string, unknown>;
        if (Array.isArray(d.policies)) return d.policies;
        if (Array.isArray(d.data)) return d.data;
      }
    }
    return [];
  }
}
