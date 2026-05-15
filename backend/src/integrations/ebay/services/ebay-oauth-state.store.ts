import { Injectable } from '@nestjs/common';
import { EBAY_INTEGRATIONS_REDIS } from '../ebay-integrations-redis.connection.js';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';

const PREFIX = 'ebay-oauth-state:';
const TTL_SEC = 900;

export interface EbayOAuthPendingPayload {
  userId: string;
  organizationId: string;
  internalStoreId: string | null;
  marketplaceId: string;
  environment: 'sandbox' | 'production';
  scopes: string[];
  accountDisplayName: string;
}

@Injectable()
export class EbayOAuthStateStore {
  constructor(@Inject(EBAY_INTEGRATIONS_REDIS) private readonly redis: Redis) {}

  async save(state: string, payload: EbayOAuthPendingPayload): Promise<void> {
    await this.redis.set(
      PREFIX + state,
      JSON.stringify(payload),
      'EX',
      TTL_SEC,
    );
  }

  async consume(state: string): Promise<EbayOAuthPendingPayload | null> {
    const key = PREFIX + state;
    const raw = await this.redis.get(key);
    await this.redis.del(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as EbayOAuthPendingPayload;
    } catch {
      return null;
    }
  }
}
