import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChannelConnection } from './entities/channel-connection.entity.js';
import { ListingChannelInstance } from './entities/listing-channel-instance.entity.js';
import { ChannelWebhookLog } from './entities/channel-webhook-log.entity.js';
import { TokenEncryptionService } from './token-encryption.service.js';
import { EbayAdapter } from './adapters/ebay/ebay.adapter.js';
import { ShopifyAdapter } from './adapters/shopify/shopify.adapter.js';
import { AmazonAdapter } from './adapters/amazon/amazon.adapter.js';
import { WalmartAdapter } from './adapters/walmart/walmart.adapter.js';
import type { ChannelAdapter, TokenSet } from './channel-adapter.interface.js';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);
  private readonly adapters: Map<string, ChannelAdapter>;

  constructor(
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(ListingChannelInstance)
    private readonly instanceRepo: Repository<ListingChannelInstance>,
    @InjectRepository(ChannelWebhookLog)
    private readonly webhookLogRepo: Repository<ChannelWebhookLog>,
    @InjectQueue('channels')
    private readonly channelsQueue: Queue,
    private readonly encryption: TokenEncryptionService,
    private readonly ebayAdapter: EbayAdapter,
    private readonly shopifyAdapter: ShopifyAdapter,
    private readonly amazonAdapter: AmazonAdapter,
    private readonly walmartAdapter: WalmartAdapter,
  ) {
    this.adapters = new Map<string, ChannelAdapter>([
      ['ebay', this.ebayAdapter],
      ['shopify', this.shopifyAdapter],
      ['amazon', this.amazonAdapter],
      ['walmart', this.walmartAdapter],
    ]);
  }

  private getAdapter(channel: string): ChannelAdapter {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new BadRequestException(`Unsupported channel: ${channel}`);
    }
    return adapter;
  }

  // ─── Connection management ───

  async getConnections(userId?: string): Promise<ChannelConnection[]> {
    // UUID validation — if userId is missing or not a valid UUID,
    // return all connections (single-tenant / pre-auth mode)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const where = userId && uuidRegex.test(userId) ? { userId } : {};
    return this.connectionRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  getAuthUrl(channel: string, state: string): string {
    return this.getAdapter(channel).getAuthUrl(state);
  }

  async handleOAuthCallback(
    channel: string,
    code: string,
    userId: string,
  ): Promise<ChannelConnection> {
    const adapter = this.getAdapter(channel);
    const tokens = await adapter.exchangeCode(code);

    const connection = this.connectionRepo.create({
      channel,
      userId,
      encryptedTokens: this.encryption.encrypt(JSON.stringify(tokens)),
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope ?? null,
      status: 'active',
    });

    const saved = await this.connectionRepo.save(connection);
    this.logger.log(`Created ${channel} connection ${saved.id} for user ${userId}`);
    return saved;
  }

  async disconnectChannel(connectionId: string): Promise<void> {
    const result = await this.connectionRepo.delete(connectionId);
    if (result.affected === 0) {
      throw new NotFoundException(`Connection ${connectionId} not found`);
    }
  }

  async testConnection(connectionId: string): Promise<{ ok: boolean; error?: string }> {
    const conn = await this.connectionRepo.findOneBy({ id: connectionId });
    if (!conn) throw new NotFoundException(`Connection ${connectionId} not found`);

    try {
      const tokens = this.decryptTokens(conn);
      // Simple test: try to refresh tokens
      const adapter = this.getAdapter(conn.channel);
      if (tokens.refreshToken) {
        await adapter.refreshTokens(tokens.refreshToken);
      }
      return { ok: true };
    } catch (error: any) {
      conn.status = 'error';
      conn.lastError = error.message;
      await this.connectionRepo.save(conn);
      return { ok: false, error: error.message };
    }
  }

  // ─── Publish & Sync ───

  async enqueuePublish(
    connectionId: string,
    listingId: string,
  ): Promise<{ jobId: string }> {
    const job = await this.channelsQueue.add(
      'publish',
      { connectionId, listingId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
    return { jobId: job.id! };
  }

  async publishListing(
    connectionId: string,
    listingId: string,
    listingData: Record<string, unknown>,
  ): Promise<ListingChannelInstance> {
    const conn = await this.connectionRepo.findOneBy({ id: connectionId });
    if (!conn) throw new NotFoundException('Connection not found');

    const tokens = await this.getValidTokens(conn);
    const adapter = this.getAdapter(conn.channel);
    const result = await adapter.publishListing(tokens, listingData);

    if (result.status === 'error') {
      throw new BadRequestException(result.error ?? 'Publish failed');
    }

    // Upsert into listing_channel_instances
    const existing = await this.instanceRepo.findOne({
      where: { connectionId, listingId },
    });

    if (existing) {
      existing.externalId = result.externalId;
      existing.externalUrl = result.externalUrl ?? null;
      existing.syncStatus = 'synced';
      existing.lastSyncedAt = new Date();
      existing.lastError = null;
      return this.instanceRepo.save(existing);
    }

    const instance = this.instanceRepo.create({
      connectionId,
      listingId,
      storeId: listingData['storeId'] as string ?? connectionId,
      channel: conn.channel,
      externalId: result.externalId,
      externalUrl: result.externalUrl ?? null,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
    });

    return this.instanceRepo.save(instance);
  }

  async enqueueSync(connectionId: string): Promise<{ jobId: string }> {
    const job = await this.channelsQueue.add(
      'sync-inventory',
      { connectionId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 50,
      },
    );
    return { jobId: job.id! };
  }

  async getChannelListings(connectionId: string): Promise<ListingChannelInstance[]> {
    return this.instanceRepo.find({
      where: { connectionId },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Per-SKU channel statuses ───

  async getListingChannelStatuses(listingId: string): Promise<
    Array<{
      channel: string;
      connectionId: string;
      status: string;
      externalId: string | null;
      externalUrl: string | null;
      lastSyncedAt: Date | null;
      lastError: string | null;
    }>
  > {
    const instances = await this.instanceRepo.find({
      where: { listingId },
      order: { createdAt: 'DESC' },
    });

    return instances.map((inst) => ({
      channel: inst.channel,
      connectionId: inst.connectionId,
      status: inst.syncStatus,
      externalId: inst.externalId,
      externalUrl: inst.externalUrl,
      lastSyncedAt: inst.lastSyncedAt,
      lastError: inst.lastError,
    }));
  }

  // ─── Multi-channel publish ───

  async publishMulti(
    listingId: string,
    channels: string[],
    overrides?: Record<string, { price?: number; title?: string; quantity?: number }>,
  ): Promise<{ results: Array<{ channel: string; jobId?: string; error?: string }> }> {
    const results: Array<{ channel: string; jobId?: string; error?: string }> = [];

    for (const channel of channels) {
      try {
        // Find an active connection for this channel
        const connection = await this.connectionRepo.findOne({
          where: { channel, status: 'active' },
          order: { createdAt: 'DESC' },
        });

        if (!connection) {
          results.push({ channel, error: `No active ${channel} connection found` });
          continue;
        }

        const job = await this.channelsQueue.add(
          'publish',
          { connectionId: connection.id, listingId, overrides: overrides?.[channel] },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 10_000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );

        // Create a pending instance record
        const existing = await this.instanceRepo.findOne({
          where: { connectionId: connection.id, listingId },
        });
        if (!existing) {
          await this.instanceRepo.save(
            this.instanceRepo.create({
              connectionId: connection.id,
              listingId,
              storeId: connection.id, // resolved during actual publish
              channel,
              syncStatus: 'pending',
            }),
          );
        } else {
          existing.syncStatus = 'pending';
          existing.lastError = null;
          await this.instanceRepo.save(existing);
        }

        results.push({ channel, jobId: job.id! });
      } catch (error: any) {
        results.push({ channel, error: error.message });
      }
    }

    return { results };
  }

  // ─── Update listing on a channel ───

  async updateChannelListing(
    listingId: string,
    channel: string,
  ): Promise<{ jobId: string }> {
    const instance = await this.instanceRepo.findOne({
      where: { listingId, channel },
    });

    if (!instance) {
      throw new NotFoundException(
        `No channel listing found for listing ${listingId} on ${channel}`,
      );
    }

    const job = await this.channelsQueue.add(
      'update',
      { connectionId: instance.connectionId, listingId, channelListingId: instance.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    instance.syncStatus = 'pending';
    await this.instanceRepo.save(instance);
    return { jobId: job.id! };
  }

  // ─── End listing on a channel ───

  async endChannelListing(
    listingId: string,
    channel: string,
  ): Promise<{ success: boolean }> {
    const instance = await this.instanceRepo.findOne({
      where: { listingId, channel },
    });

    if (!instance) {
      throw new NotFoundException(
        `No channel listing found for listing ${listingId} on ${channel}`,
      );
    }

    instance.syncStatus = 'ended';
    await this.instanceRepo.save(instance);
    return { success: true };
  }

  // ─── Bulk publish (multiple SKUs × multiple channels) ───

  async bulkPublish(
    listingIds: string[],
    channels: string[],
  ): Promise<{ total: number; enqueued: number; errors: string[] }> {
    let enqueued = 0;
    const errors: string[] = [];

    for (const listingId of listingIds) {
      const result = await this.publishMulti(listingId, channels);
      for (const r of result.results) {
        if (r.jobId) {
          enqueued++;
        } else if (r.error) {
          errors.push(`${listingId}@${r.channel}: ${r.error}`);
        }
      }
    }

    return { total: listingIds.length * channels.length, enqueued, errors };
  }

  // ─── Webhooks ───

  async logWebhook(
    channel: string,
    eventType: string,
    payload: Record<string, unknown>,
    externalId?: string,
    storeId?: string,
  ): Promise<ChannelWebhookLog> {
    const log = this.webhookLogRepo.create({
      channel,
      eventType,
      externalId: externalId ?? null,
      payload,
      processingStatus: 'received',
      storeId: storeId ?? null,
    } as Partial<ChannelWebhookLog>);
    return this.webhookLogRepo.save(log);
  }

  /**
   * Resolve a storeId from an external identifier found in a webhook payload.
   * Looks up `stores.external_store_id` for the given channel.
   * Returns null if no match is found (backward-compatible).
   */
  async resolveStoreFromWebhook(
    channel: string,
    externalStoreId?: string,
  ): Promise<string | null> {
    if (!externalStoreId) return null;
    const store = await this.connectionRepo.manager
      .getRepository('Store')
      .findOne({ where: { channel, externalStoreId } });
    return store?.id ?? null;
  }

  // ─── Token helpers ───

  private decryptTokens(conn: ChannelConnection): TokenSet {
    const json = this.encryption.decrypt(conn.encryptedTokens);
    return JSON.parse(json) as TokenSet;
  }

  private async getValidTokens(conn: ChannelConnection): Promise<TokenSet> {
    let tokens = this.decryptTokens(conn);

    // Refresh if expired (with 5-minute buffer)
    if (tokens.expiresAt && new Date(tokens.expiresAt).getTime() < Date.now() + 5 * 60 * 1000) {
      if (tokens.refreshToken) {
        const adapter = this.getAdapter(conn.channel);
        tokens = await adapter.refreshTokens(tokens.refreshToken);
        conn.encryptedTokens = this.encryption.encrypt(JSON.stringify(tokens));
        conn.tokenExpiresAt = tokens.expiresAt;
        await this.connectionRepo.save(conn);
        this.logger.log(`Refreshed tokens for connection ${conn.id}`);
      }
    }

    return tokens;
  }

  /* ─── Inventory Sync ─── */

  /**
   * Sync inventory for a single connection.
   * Queries all channel listings for this connection and pushes updated quantities.
   */
  async syncConnectionInventory(connectionId: string): Promise<{ succeeded: number; failed: number }> {
    const conn = await this.connectionRepo.findOneBy({ id: connectionId });
    if (!conn) throw new NotFoundException(`Connection ${connectionId} not found`);

    const adapter = this.getAdapter(conn.channel);
    const tokens = await this.getValidTokens(conn);

    const channelListings = await this.instanceRepo.find({
      where: { connectionId },
    });

    if (channelListings.length === 0) {
      return { succeeded: 0, failed: 0 };
    }

    const items = channelListings
      .filter((cl) => cl.externalId)
      .map((cl) => ({
        externalId: cl.externalId as string,
        quantity: 1, // Will be enriched from inventory ledger in future
        price: undefined as number | undefined,
      }));

    return adapter.syncInventory(tokens, items);
  }

  /**
   * Sync inventory across all active connections, optionally filtered by channel.
   */
  async syncAllInventory(channel?: string): Promise<void> {
    const where: Record<string, unknown> = { status: 'active' };
    if (channel) where['channel'] = channel;

    const connections = await this.connectionRepo.find({ where });
    this.logger.log(`Syncing inventory for ${connections.length} connections (channel=${channel ?? 'all'})`);

    for (const conn of connections) {
      try {
        const result = await this.syncConnectionInventory(conn.id);
        this.logger.log(`Inventory sync for ${conn.channel}:${conn.id}: ${result.succeeded} OK, ${result.failed} failed`);
      } catch (error: any) {
        this.logger.error(`Inventory sync failed for ${conn.channel}:${conn.id}: ${error.message}`);
      }
    }
  }
}
