import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Store } from './entities/store.entity.js';
import { ListingChannelInstance } from './entities/listing-channel-instance.entity.js';
import { DemoSimulationLog } from './entities/demo-simulation-log.entity.js';
import { ChannelConnection } from './entities/channel-connection.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { ConfigService } from '@nestjs/config';
import { EbayPublishService } from './ebay/ebay-publish.service.js';
import { StoreAccessService } from './store-access.service.js';
import { User } from '../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayBusinessPolicy } from '../integrations/ebay/entities/ebay-business-policy.entity.js';
import { ShippingProfile } from '../settings/entities/shipping-profile.entity.js';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ListingChannelInstance)
    private readonly instanceRepo: Repository<ListingChannelInstance>,
    @InjectRepository(DemoSimulationLog)
    private readonly demoLogRepo: Repository<DemoSimulationLog>,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly connectedAccountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,
    @InjectRepository(ShippingProfile)
    private readonly shippingProfileRepo: Repository<ShippingProfile>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly ebayPublish: EbayPublishService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  private get isDemoMode(): boolean {
    return this.config.get<string>('CHANNEL_DEMO_MODE', 'true') === 'true';
  }

  // ─── Store CRUD ───

  async getStores(connectionId?: string): Promise<Store[]> {
    const where = connectionId ? { connectionId } : {};
    return this.storeRepo.find({
      where,
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  /**
   * List stores for a channel, filtered to stores the user can access.
   * For eBay, active native OAuth and SellerPundit stores with matching
   * marketplaces are returned, enriched with marketplace labels and
   * policy display names (where available).
   */
  async getStoresByChannel(channel: string, user?: User): Promise<any[]> {
    // 1. Resolve accessible store IDs for the user
    let accessibleIds: string[] | undefined;
    if (user) {
      accessibleIds = await this.storeAccess.resolveStoreFilter(user);
      if (accessibleIds?.length === 0) return [];
    }

    const where: any = { channel };
    if (accessibleIds) where.id = In(accessibleIds);

    const stores = await this.storeRepo.find({
      where,
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });

    if (!user || channel !== 'ebay') return stores;

    // 2. For eBay: filter to active stores (native OAuth & SellerPundit)
    const connectionIds = stores.map((s) => s.connectionId);
    const accounts: ConnectedEbayAccount[] =
      await this.connectedAccountRepo.find({
        where: { channelConnectionId: In(connectionIds) },
        relations: ['marketplaces'],
      });
    const accountByConnId = new Map(
      accounts.map((a: ConnectedEbayAccount) => [a.channelConnectionId, a]),
    );

    const eligible: Array<
      Store & {
        marketplaceLabel: string;
        fulfillmentPolicyName: string | null;
        paymentPolicyName: string | null;
        returnPolicyName: string | null;
      }
    > = [];
    for (const store of stores) {
      const account = accountByConnId.get(store.connectionId);
      if (!account) continue;
      if (account.connectionStatus !== 'active') continue;

      const mkt = (account.marketplaces ?? []).find(
        (m) => m.marketplaceId === store.ebayMarketplaceId,
      );
      if (!mkt) continue;

      // Native OAuth stores must have fulfilment + payment + return
      // policies synced. SellerPundit stores are published via the
      // SellerPundit API which handles policies on its side.
      if (
        account.connectionSource === 'native_oauth' &&
        (
          !mkt.defaultFulfillmentPolicyId ||
          !mkt.defaultPaymentPolicyId ||
          !mkt.defaultReturnPolicyId
        )
      )
        continue;

      // 3. Enrich with policy display names from EbayBusinessPolicy table
      const policies: EbayBusinessPolicy[] = await this.policyRepo.find({
        where: {
          ebayAccountId: account.id,
          marketplaceId: mkt.marketplaceId,
        },
      });
      const policyByName = new Map(
        policies.map((p: EbayBusinessPolicy) => [p.policyType, p.name]),
      );

      eligible.push({
        ...store,
        marketplaceLabel: mkt.marketplaceId,
        fulfillmentPolicyName: policyByName.get('fulfillment') ?? null,
        paymentPolicyName: policyByName.get('payment') ?? null,
        returnPolicyName: policyByName.get('return') ?? null,
      });
    }

    return eligible;
  }

  async getStore(storeId: string): Promise<Store> {
    const store = await this.storeRepo.findOneBy({ id: storeId });
    if (!store) throw new NotFoundException(`Store ${storeId} not found`);
    return store;
  }

  /**
   * Get available shipping, return, and payment profiles for a store.
   * Shipping profiles come from the local shipping_profiles table.
   * Return/payment profiles come from cached eBay business policies
   * for the store's connected eBay account + marketplace.
   */
  async getStoreProfiles(storeId: string): Promise<{
    shippingProfiles: Array<{ id: string; name: string; carrier: string; service: string; costType: string; ebayPolicyId?: string; shippingCost?: number; currency?: string }>;
    returnProfiles: Array<{ id: string; name: string; ebayPolicyId: string }>;
    paymentProfiles: Array<{ id: string; name: string; ebayPolicyId: string }>;
  }> {
    const store = await this.getStore(storeId);

    // Shipping profiles: first from local table, then fall back to eBay fulfillment policies
    let shippingProfiles: Array<{ id: string; name: string; carrier: string; service: string; costType: string; ebayPolicyId?: string }> = [];
    const localShipping = await this.shippingProfileRepo.find({
      where: { active: true },
      order: { isDefault: 'DESC', name: 'ASC' },
    });
    if (localShipping.length > 0) {
      shippingProfiles = localShipping;
    }

    // For eBay stores, also fetch fulfillment/return/payment policies
    let returnProfiles: Array<{ id: string; name: string; ebayPolicyId: string }> = [];
    let paymentProfiles: Array<{ id: string; name: string; ebayPolicyId: string }> = [];

    if (store.channel === 'ebay' && store.connectionId) {
      const account = await this.connectedAccountRepo.findOne({
        where: { channelConnectionId: store.connectionId },
      });
      if (account && store.ebayMarketplaceId) {
        const policies = await this.policyRepo.find({
          where: {
            ebayAccountId: account.id,
            marketplaceId: store.ebayMarketplaceId,
          },
          order: { isDefault: 'DESC', name: 'ASC' },
        });

        // Fulfillment policies as shipping profiles (fallback if no local shipping profiles)
        const fulfillPolicies = policies.filter((p) => p.policyType === 'fulfillment');
        if (shippingProfiles.length === 0 && fulfillPolicies.length > 0) {
          shippingProfiles = fulfillPolicies.map((p) => {
            // Extract shipping cost from raw_payload
            let shippingCost: number | undefined;
            let currency: string | undefined;
            try {
              const raw = p.rawPayload as Record<string, unknown>;
              const shippingOptions = raw?.shippingOptions as Array<Record<string, unknown>> | undefined;
              if (shippingOptions?.[0]?.shippingServices) {
                const services = shippingOptions[0].shippingServices as Array<Record<string, unknown>>;
                if (services[0]?.shippingCost) {
                  const cost = services[0].shippingCost as { value?: string; currency?: string };
                  shippingCost = cost.value ? parseFloat(cost.value) : undefined;
                  currency = cost.currency;
                }
              }
            } catch (e) {
              // Ignore parsing errors
            }
            return {
              id: p.id,
              name: p.name,
              carrier: '',
              service: '',
              costType: '',
              ebayPolicyId: p.ebayPolicyId,
              shippingCost,
              currency,
            };
          });
        }

        returnProfiles = policies
          .filter((p) => p.policyType === 'return')
          .map((p) => ({ id: p.id, name: p.name, ebayPolicyId: p.ebayPolicyId }));

        paymentProfiles = policies
          .filter((p) => p.policyType === 'payment')
          .map((p) => ({ id: p.id, name: p.name, ebayPolicyId: p.ebayPolicyId }));
      }
    }

    return { shippingProfiles, returnProfiles, paymentProfiles };
  }

  async createStore(data: {
    connectionId: string;
    channel: string;
    storeName: string;
    storeUrl?: string;
    externalStoreId?: string;
    isPrimary?: boolean;
    config?: Record<string, unknown>;
  }): Promise<Store> {
    const conn = await this.connectionRepo.findOneBy({ id: data.connectionId });
    if (!conn)
      throw new NotFoundException(`Connection ${data.connectionId} not found`);

    const store = this.storeRepo.create({
      connectionId: data.connectionId,
      channel: data.channel,
      storeName: data.storeName,
      storeUrl: data.storeUrl ?? null,
      externalStoreId: data.externalStoreId ?? null,
      isPrimary: data.isPrimary ?? false,
      config: data.config ?? {},
    });

    const saved = await this.storeRepo.save(store);
    this.logger.log(
      `Created store "${saved.storeName}" (${saved.id}) for ${data.channel}`,
    );

    if (this.isDemoMode) {
      await this.logDemo({
        operationType: 'auth_simulated',
        channel: data.channel,
        storeId: saved.id,
        notes: `Demo store "${saved.storeName}" created`,
      });
    }

    return saved;
  }

  async updateStore(
    storeId: string,
    data: Partial<{
      storeName: string;
      storeUrl: string;
      status: string;
      isPrimary: boolean;
      config: Record<string, unknown>;
    }>,
  ): Promise<Store> {
    const store = await this.getStore(storeId);
    Object.assign(store, data);
    return this.storeRepo.save(store);
  }

  async deleteStore(storeId: string): Promise<void> {
    const result = await this.storeRepo.delete(storeId);
    if (result.affected === 0)
      throw new NotFoundException(`Store ${storeId} not found`);
  }

  // ─── Listing Channel Instances ───

  async getInstances(filters: {
    listingId?: string;
    storeId?: string;
    connectionId?: string;
    channel?: string;
    syncStatus?: string;
  }): Promise<ListingChannelInstance[]> {
    const qb = this.instanceRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.store', 'store')
      .leftJoinAndSelect('i.connection', 'conn');

    if (filters.listingId)
      qb.andWhere('i.listing_id = :listingId', {
        listingId: filters.listingId,
      });
    if (filters.storeId)
      qb.andWhere('i.store_id = :storeId', { storeId: filters.storeId });
    if (filters.connectionId)
      qb.andWhere('i.connection_id = :connectionId', {
        connectionId: filters.connectionId,
      });
    if (filters.channel)
      qb.andWhere('i.channel = :channel', { channel: filters.channel });
    if (filters.syncStatus)
      qb.andWhere('i.sync_status = :syncStatus', {
        syncStatus: filters.syncStatus,
      });

    return qb.orderBy('i.created_at', 'DESC').getMany();
  }

  async getInstance(instanceId: string): Promise<ListingChannelInstance> {
    const inst = await this.instanceRepo.findOne({
      where: { id: instanceId },
      relations: ['store', 'connection'],
    });
    if (!inst) throw new NotFoundException(`Instance ${instanceId} not found`);
    return inst;
  }

  async createInstance(data: {
    listingId: string;
    storeId: string;
    overridePrice?: number;
    overrideQuantity?: number;
    overrideTitle?: string;
    channelSpecificData?: Record<string, unknown>;
  }): Promise<ListingChannelInstance> {
    const store = await this.getStore(data.storeId);
    const listing = await this.listingRepo.findOneBy({ id: data.listingId });
    if (!listing)
      throw new NotFoundException(`Listing ${data.listingId} not found`);

    // Check for existing instance at same store
    const existing = await this.instanceRepo.findOneBy({
      listingId: data.listingId,
      storeId: data.storeId,
    });
    if (existing) {
      throw new ConflictException(
        `Listing ${data.listingId} already has an instance at store ${store.storeName}`,
      );
    }

    const instance = this.instanceRepo.create({
      listingId: data.listingId,
      connectionId: store.connectionId,
      storeId: data.storeId,
      channel: store.channel,
      overridePrice: data.overridePrice ?? null,
      overrideQuantity: data.overrideQuantity ?? null,
      overrideTitle: data.overrideTitle ?? null,
      channelSpecificData: data.channelSpecificData ?? {},
      syncStatus: 'draft',
      isDemo: this.isDemoMode,
    });

    const saved = await this.instanceRepo.save(instance);
    this.logger.log(
      `Created instance ${saved.id} for listing ${data.listingId} at store ${store.storeName}`,
    );

    // Update store listing count
    await this.updateStoreListingCount(data.storeId);

    return saved;
  }

  async publishInstance(instanceId: string): Promise<ListingChannelInstance> {
    const instance = await this.getInstance(instanceId);

    if (instance.syncStatus === 'synced') {
      throw new BadRequestException('Instance is already published');
    }

    instance.syncStatus = 'publishing';
    await this.instanceRepo.save(instance);

    if (this.isDemoMode) {
      // Simulate marketplace publish
      const simulatedDelay = 200 + Math.random() * 800;
      await new Promise((r) => setTimeout(r, simulatedDelay));

      const externalId = `DEMO-${instance.channel.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const externalUrl = this.generateDemoUrl(instance.channel, externalId);

      instance.externalId = externalId;
      instance.externalUrl = externalUrl;
      instance.syncStatus = 'synced';
      instance.lastSyncedAt = new Date();
      instance.lastError = null;
      instance.isDemo = true;

      await this.instanceRepo.save(instance);

      await this.logDemo({
        operationType: 'publish',
        channel: instance.channel,
        storeId: instance.storeId,
        listingId: instance.listingId,
        instanceId: instance.id,
        simulatedExternalId: externalId,
        requestPayload: {
          listingId: instance.listingId,
          overridePrice: instance.overridePrice,
          overrideQuantity: instance.overrideQuantity,
        },
        responsePayload: {
          externalId,
          externalUrl,
          status: 'active',
        },
        simulatedLatencyMs: Math.round(simulatedDelay),
      });

      this.logger.log(
        `[DEMO] Published instance ${instanceId} → ${externalId}`,
      );
    } else {
      const listing = await this.listingRepo.findOneBy({
        id: instance.listingId,
      });
      if (!listing) {
        instance.syncStatus = 'error';
        instance.lastError = `Listing ${instance.listingId} not found`;
        await this.instanceRepo.save(instance);
        throw new NotFoundException(instance.lastError);
      }

      const stub = this.ebayPublish.stubPublishRequest(instance.listingId, [
        instance.storeId,
      ]);
      if (instance.overrideTitle) stub.title = instance.overrideTitle;
      if (instance.overridePrice != null)
        stub.price = Number(instance.overridePrice);
      if (instance.overrideQuantity != null)
        stub.quantity = instance.overrideQuantity;

      const results = await this.ebayPublish.publish(stub);
      const result = results[0];
      if (!result?.success) {
        instance.syncStatus = 'error';
        instance.lastError = result?.error ?? 'Publish failed';
        await this.instanceRepo.save(instance);
        throw new BadRequestException(instance.lastError);
      }

      instance.externalId = result.listingId ?? result.offerId ?? null;
      instance.externalUrl = result.listingId
        ? `https://www.ebay.com/itm/${result.listingId}`
        : null;
      instance.syncStatus = 'synced';
      instance.lastSyncedAt = new Date();
      instance.lastError = null;
      await this.instanceRepo.save(instance);
      await this.updateStoreListingCount(instance.storeId);
    }

    return instance;
  }

  async bulkPublishInstances(instanceIds: string[]): Promise<{
    results: Array<{
      instanceId: string;
      status: string;
      externalId?: string;
      error?: string;
    }>;
  }> {
    const results: Array<{
      instanceId: string;
      status: string;
      externalId?: string;
      error?: string;
    }> = [];

    for (const id of instanceIds) {
      try {
        const inst = await this.publishInstance(id);
        results.push({
          instanceId: id,
          status: 'published',
          externalId: inst.externalId ?? undefined,
        });
      } catch (error: any) {
        results.push({
          instanceId: id,
          status: 'error',
          error: error.message,
        });
      }
    }

    return { results };
  }

  async endInstance(instanceId: string): Promise<ListingChannelInstance> {
    const instance = await this.getInstance(instanceId);

    if (this.isDemoMode) {
      instance.syncStatus = 'ended';
      instance.lastSyncedAt = new Date();
      await this.instanceRepo.save(instance);

      await this.logDemo({
        operationType: 'end_listing',
        channel: instance.channel,
        storeId: instance.storeId,
        listingId: instance.listingId,
        instanceId: instance.id,
        simulatedExternalId: instance.externalId,
        notes: 'Demo listing ended',
      });
    } else {
      instance.syncStatus = 'ended';
      await this.instanceRepo.save(instance);
    }

    await this.updateStoreListingCount(instance.storeId);
    return instance;
  }

  // ─── Multi-Store Publish ───

  async publishToMultipleStores(
    listingId: string,
    storeIds: string[],
    overrides?: Record<
      string,
      { price?: number; quantity?: number; title?: string }
    >,
  ): Promise<{
    results: Array<{
      storeId: string;
      instanceId?: string;
      status: string;
      error?: string;
    }>;
  }> {
    const results: Array<{
      storeId: string;
      instanceId?: string;
      status: string;
      error?: string;
    }> = [];

    for (const storeId of storeIds) {
      try {
        const storeOverrides = overrides?.[storeId] ?? {};

        // Create instance if not exists
        let instance: ListingChannelInstance;
        const existing = await this.instanceRepo.findOneBy({
          listingId,
          storeId,
        });

        if (existing) {
          instance = existing;
          if (storeOverrides.price !== undefined)
            instance.overridePrice = storeOverrides.price;
          if (storeOverrides.quantity !== undefined)
            instance.overrideQuantity = storeOverrides.quantity;
          if (storeOverrides.title !== undefined)
            instance.overrideTitle = storeOverrides.title;
          await this.instanceRepo.save(instance);
        } else {
          instance = await this.createInstance({
            listingId,
            storeId,
            overridePrice: storeOverrides.price,
            overrideQuantity: storeOverrides.quantity,
            overrideTitle: storeOverrides.title,
          });
        }

        // Publish
        const published = await this.publishInstance(instance.id);
        results.push({
          storeId,
          instanceId: published.id,
          status: 'published',
        });
      } catch (error: any) {
        results.push({
          storeId,
          status: 'error',
          error: error.message,
        });
      }
    }

    return { results };
  }

  // ─── Per-listing channel overview (multi-store) ───

  async getListingChannelOverview(listingId: string): Promise<{
    instances: ListingChannelInstance[];
    channelSummary: Array<{
      channel: string;
      storeCount: number;
      publishedCount: number;
      totalStores: Array<{
        storeId: string;
        storeName: string;
        syncStatus: string;
        externalId: string | null;
      }>;
    }>;
  }> {
    const instances = await this.instanceRepo.find({
      where: { listingId },
      relations: ['store', 'connection'],
      order: { channel: 'ASC', createdAt: 'ASC' },
    });

    // Group by channel
    const channelMap = new Map<string, typeof instances>();
    for (const inst of instances) {
      const existing = channelMap.get(inst.channel) ?? [];
      existing.push(inst);
      channelMap.set(inst.channel, existing);
    }

    const channelSummary = Array.from(channelMap.entries()).map(
      ([channel, insts]) => ({
        channel,
        storeCount: insts.length,
        publishedCount: insts.filter((i) => i.syncStatus === 'synced').length,
        totalStores: insts.map((i) => ({
          storeId: i.storeId,
          storeName: i.store?.storeName ?? 'Unknown',
          syncStatus: i.syncStatus,
          externalId: i.externalId,
        })),
      }),
    );

    return { instances, channelSummary };
  }

  // ─── Demo simulation helpers ───

  async getDemoLogs(filters: {
    channel?: string;
    operationType?: string;
    listingId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: DemoSimulationLog[]; total: number }> {
    const qb = this.demoLogRepo.createQueryBuilder('d');

    if (filters.channel)
      qb.andWhere('d.channel = :channel', { channel: filters.channel });
    if (filters.operationType)
      qb.andWhere('d.operation_type = :opType', {
        opType: filters.operationType,
      });
    if (filters.listingId)
      qb.andWhere('d.listing_id = :listingId', {
        listingId: filters.listingId,
      });

    const [logs, total] = await qb
      .orderBy('d.created_at', 'DESC')
      .take(filters.limit ?? 50)
      .skip(filters.offset ?? 0)
      .getManyAndCount();

    return { logs, total };
  }

  async simulateIncomingOrder(instanceId: string): Promise<DemoSimulationLog> {
    const instance = await this.getInstance(instanceId);
    if (instance.syncStatus !== 'synced') {
      throw new BadRequestException(
        'Can only simulate orders for published instances',
      );
    }

    const simulatedOrderId = `DEMO-ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const simulatedPrice = instance.overridePrice ?? 29.99;

    const log = await this.logDemo({
      operationType: 'order_received',
      channel: instance.channel,
      storeId: instance.storeId,
      listingId: instance.listingId,
      instanceId: instance.id,
      simulatedExternalId: simulatedOrderId,
      requestPayload: {
        orderId: simulatedOrderId,
        buyerUsername: `demo_buyer_${Math.random().toString(36).slice(2, 6)}`,
        quantity: 1,
        itemPrice: simulatedPrice,
        shippingCost: 9.99,
      },
      responsePayload: {
        orderStatus: 'awaiting_shipment',
        paymentStatus: 'paid',
        totalPrice: Number(simulatedPrice) + 9.99,
      },
      simulatedLatencyMs: Math.round(100 + Math.random() * 300),
      notes: 'Simulated incoming order for demo',
    });

    this.logger.log(
      `[DEMO] Simulated order ${simulatedOrderId} for instance ${instanceId}`,
    );
    return log;
  }

  // ─── Private helpers ───

  private async updateStoreListingCount(storeId: string): Promise<void> {
    const count = await this.instanceRepo.count({
      where: { storeId, syncStatus: 'synced' },
    });
    await this.storeRepo.update(storeId, { listingCount: count });
  }

  private generateDemoUrl(channel: string, externalId: string): string {
    switch (channel) {
      case 'ebay':
        // Sandbox demo — real item IDs would be at sandbox.ebay.com
        return `https://www.sandbox.ebay.com/itm/${externalId}`;
      case 'shopify':
        return `https://demo-store.myshopify.com/products/${externalId}`;
      case 'amazon':
        return `https://www.amazon.com/dp/${externalId}`;
      case 'walmart':
        return `https://www.walmart.com/ip/${externalId}`;
      default:
        return `https://demo.marketplace.com/${channel}/${externalId}`;
    }
  }

  private async logDemo(
    data: Partial<DemoSimulationLog>,
  ): Promise<DemoSimulationLog> {
    const log = this.demoLogRepo.create(data);
    return this.demoLogRepo.save(log);
  }
}
