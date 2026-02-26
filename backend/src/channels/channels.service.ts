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
