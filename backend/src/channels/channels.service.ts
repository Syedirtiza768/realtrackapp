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
import { ChannelListing } from './entities/channel-listing.entity.js';
import { ChannelWebhookLog } from './entities/channel-webhook-log.entity.js';
import { TokenEncryptionService } from './token-encryption.service.js';
import { EbayAdapter } from './adapters/ebay/ebay.adapter.js';
import { ShopifyAdapter } from './adapters/shopify/shopify.adapter.js';
import type { ChannelAdapter, TokenSet } from './channel-adapter.interface.js';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);
  private readonly adapters: Map<string, ChannelAdapter>;

  constructor(
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(ChannelListing)
    private readonly listingRepo: Repository<ChannelListing>,
    @InjectRepository(ChannelWebhookLog)
    private readonly webhookLogRepo: Repository<ChannelWebhookLog>,
    @InjectQueue('channels')
    private readonly channelsQueue: Queue,
    private readonly encryption: TokenEncryptionService,
    private readonly ebayAdapter: EbayAdapter,
    private readonly shopifyAdapter: ShopifyAdapter,
  ) {
    this.adapters = new Map<string, ChannelAdapter>([
      ['ebay', this.ebayAdapter],
      ['shopify', this.shopifyAdapter],
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

  async getConnections(userId: string): Promise<ChannelConnection[]> {
    return this.connectionRepo.find({
      where: { userId },
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
  ): Promise<ChannelListing> {
    const conn = await this.connectionRepo.findOneBy({ id: connectionId });
    if (!conn) throw new NotFoundException('Connection not found');

    const tokens = await this.getValidTokens(conn);
    const adapter = this.getAdapter(conn.channel);
    const result = await adapter.publishListing(tokens, listingData);

    if (result.status === 'error') {
      throw new BadRequestException(result.error ?? 'Publish failed');
    }

    const channelListing = this.listingRepo.create({
      connectionId,
      listingId,
      externalId: result.externalId,
      externalUrl: result.externalUrl ?? null,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
    });

    return this.listingRepo.save(channelListing);
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

  async getChannelListings(connectionId: string): Promise<ChannelListing[]> {
    return this.listingRepo.find({
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
    const listings = await this.listingRepo.find({
      where: { listingId },
      order: { createdAt: 'DESC' },
    });

    if (listings.length === 0) return [];

    // Resolve the channel name via the connection
    const connectionIds = [...new Set(listings.map((l) => l.connectionId))];
    const connections = await this.connectionRepo.findByIds(connectionIds);
    const connMap = new Map(connections.map((c) => [c.id, c]));

    return listings.map((l) => {
      const conn = connMap.get(l.connectionId);
      return {
        channel: conn?.channel ?? 'unknown',
        connectionId: l.connectionId,
        status: l.syncStatus,
        externalId: l.externalId,
        externalUrl: l.externalUrl,
        lastSyncedAt: l.lastSyncedAt,
        lastError: l.lastError,
      };
    });
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

        // Create a pending channel_listing record
        const existing = await this.listingRepo.findOne({
          where: { connectionId: connection.id, listingId },
        });
        if (!existing) {
          await this.listingRepo.save(
            this.listingRepo.create({
              connectionId: connection.id,
              listingId,
              syncStatus: 'pending',
            }),
          );
        } else {
          existing.syncStatus = 'pending';
          existing.lastError = null;
          await this.listingRepo.save(existing);
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
    const listing = await this.listingRepo
      .createQueryBuilder('cl')
      .innerJoin(ChannelConnection, 'cc', 'cc.id = cl."connectionId"')
      .where('cl."listingId" = :listingId', { listingId })
      .andWhere('cc.channel = :channel', { channel })
      .getOne();

    if (!listing) {
      throw new NotFoundException(
        `No channel listing found for listing ${listingId} on ${channel}`,
      );
    }

    const job = await this.channelsQueue.add(
      'update',
      { connectionId: listing.connectionId, listingId, channelListingId: listing.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    listing.syncStatus = 'pending';
    await this.listingRepo.save(listing);
    return { jobId: job.id! };
  }

  // ─── End listing on a channel ───

  async endChannelListing(
    listingId: string,
    channel: string,
  ): Promise<{ success: boolean }> {
    const listing = await this.listingRepo
      .createQueryBuilder('cl')
      .innerJoin(ChannelConnection, 'cc', 'cc.id = cl."connectionId"')
      .where('cl."listingId" = :listingId', { listingId })
      .andWhere('cc.channel = :channel', { channel })
      .getOne();

    if (!listing) {
      throw new NotFoundException(
        `No channel listing found for listing ${listingId} on ${channel}`,
      );
    }

    listing.syncStatus = 'ended';
    await this.listingRepo.save(listing);
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
  ): Promise<ChannelWebhookLog> {
    const log = this.webhookLogRepo.create({
      channel,
      eventType,
      externalId: externalId ?? null,
      payload,
      processingStatus: 'received',
    });
    return this.webhookLogRepo.save(log);
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
}
