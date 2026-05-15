import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { ListingActionLogWriterService } from './listing-action-log-writer.service.js';

@Injectable()
export class EbayIntegrationAccountService {
  constructor(
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
    private readonly logWriter: ListingActionLogWriterService,
  ) {}

  async listForOrganization(organizationId: string) {
    const rows = await this.accountRepo.find({
      where: { organizationId },
      relations: ['marketplaces'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((a) => ({
      id: a.id,
      organizationId: a.organizationId,
      internalStoreId: a.internalStoreId,
      ebayUserId: a.ebayUserId,
      ebayUsername: a.ebayUsername,
      accountDisplayName: a.accountDisplayName,
      environment: a.environment,
      connectionStatus: a.connectionStatus,
      connectedAt: a.connectedAt,
      lastVerifiedAt: a.lastVerifiedAt,
      primaryStoreId: a.primaryStoreId,
      marketplaces: (a.marketplaces ?? []).map((m) => ({
        id: m.id,
        marketplaceId: m.marketplaceId,
        currency: m.currency,
        locale: m.locale,
        enabled: m.enabled,
        defaultPaymentPolicyId: m.defaultPaymentPolicyId,
        defaultReturnPolicyId: m.defaultReturnPolicyId,
        defaultFulfillmentPolicyId: m.defaultFulfillmentPolicyId,
        defaultInventoryLocationKey: m.defaultInventoryLocationKey,
      })),
    }));
  }

  async getOne(id: string, organizationId: string) {
    const a = await this.accountRepo.findOne({
      where: { id, organizationId },
      relations: ['marketplaces'],
    });
    if (!a) throw new NotFoundException('Account not found');
    return {
      id: a.id,
      organizationId: a.organizationId,
      internalStoreId: a.internalStoreId,
      ebayUserId: a.ebayUserId,
      ebayUsername: a.ebayUsername,
      accountDisplayName: a.accountDisplayName,
      environment: a.environment,
      connectionStatus: a.connectionStatus,
      connectedAt: a.connectedAt,
      lastVerifiedAt: a.lastVerifiedAt,
      primaryStoreId: a.primaryStoreId,
      marketplaces: (a.marketplaces ?? []).map((m) => ({
        id: m.id,
        marketplaceId: m.marketplaceId,
        currency: m.currency,
        locale: m.locale,
        enabled: m.enabled,
        defaultPaymentPolicyId: m.defaultPaymentPolicyId,
        defaultReturnPolicyId: m.defaultReturnPolicyId,
        defaultFulfillmentPolicyId: m.defaultFulfillmentPolicyId,
        defaultInventoryLocationKey: m.defaultInventoryLocationKey,
      })),
    };
  }

  async getPolicies(id: string, organizationId: string) {
    await this.getOne(id, organizationId);
    const policies = await this.policyRepo.find({
      where: { ebayAccountId: id },
      order: { marketplaceId: 'ASC', policyType: 'ASC', name: 'ASC' },
    });
    return {
      policies: policies.map((p) => ({
        id: p.id,
        marketplaceId: p.marketplaceId,
        policyType: p.policyType,
        ebayPolicyId: p.ebayPolicyId,
        name: p.name,
        isDefault: p.isDefault,
      })),
    };
  }

  async patchDefaultPolicies(
    id: string,
    organizationId: string,
    body: {
      marketplaceId: string;
      defaultPaymentPolicyId?: string | null;
      defaultReturnPolicyId?: string | null;
      defaultFulfillmentPolicyId?: string | null;
      defaultInventoryLocationKey?: string | null;
    },
    meta?: { userId?: string | null; ip?: string | null; userAgent?: string | null },
  ) {
    await this.getOne(id, organizationId);
    const mp = await this.mpRepo.findOne({
      where: { ebayAccountId: id, marketplaceId: body.marketplaceId },
    });
    if (!mp) {
      throw new NotFoundException('Marketplace row not found for this account');
    }
    const before = {
      defaultPaymentPolicyId: mp.defaultPaymentPolicyId,
      defaultReturnPolicyId: mp.defaultReturnPolicyId,
      defaultFulfillmentPolicyId: mp.defaultFulfillmentPolicyId,
      defaultInventoryLocationKey: mp.defaultInventoryLocationKey,
    };
    if (body.defaultPaymentPolicyId !== undefined) {
      mp.defaultPaymentPolicyId = body.defaultPaymentPolicyId?.trim() || null;
    }
    if (body.defaultReturnPolicyId !== undefined) {
      mp.defaultReturnPolicyId = body.defaultReturnPolicyId?.trim() || null;
    }
    if (body.defaultFulfillmentPolicyId !== undefined) {
      mp.defaultFulfillmentPolicyId = body.defaultFulfillmentPolicyId?.trim() || null;
    }
    if (body.defaultInventoryLocationKey !== undefined) {
      mp.defaultInventoryLocationKey = body.defaultInventoryLocationKey?.trim() || null;
    }
    await this.mpRepo.save(mp);
    await this.logWriter.write({
      organizationId,
      userId: meta?.userId ?? null,
      ebayAccountId: id,
      marketplaceId: body.marketplaceId,
      action: 'ebay_default_policies_updated',
      result: 'success',
      beforeSnapshot: before,
      afterSnapshot: {
        defaultPaymentPolicyId: mp.defaultPaymentPolicyId,
        defaultReturnPolicyId: mp.defaultReturnPolicyId,
        defaultFulfillmentPolicyId: mp.defaultFulfillmentPolicyId,
        defaultInventoryLocationKey: mp.defaultInventoryLocationKey,
      },
      ipAddress: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
    });
    return this.getOne(id, organizationId);
  }

  async patch(
    id: string,
    organizationId: string,
    patch: { accountDisplayName?: string; connectionStatus?: ConnectedEbayAccount['connectionStatus'] },
  ) {
    const a = await this.accountRepo.findOne({ where: { id, organizationId } });
    if (!a) throw new NotFoundException('Account not found');
    if (patch.accountDisplayName != null) {
      a.accountDisplayName = patch.accountDisplayName;
    }
    if (patch.connectionStatus != null) {
      a.connectionStatus = patch.connectionStatus;
    }
    return this.accountRepo.save(a);
  }

  async disconnect(
    id: string,
    organizationId: string,
    userId: string | null,
    meta?: { ip?: string | null; userAgent?: string | null },
  ) {
    const a = await this.accountRepo.findOne({ where: { id, organizationId } });
    if (!a) throw new NotFoundException('Account not found');
    a.connectionStatus = 'disabled';
    await this.accountRepo.save(a);
    await this.logWriter.write({
      organizationId,
      userId,
      ebayAccountId: a.id,
      action: 'ebay_account_disconnected',
      result: 'success',
      ipAddress: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
    });
    return { ok: true };
  }
}
