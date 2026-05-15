import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const EBAY_INTEGRATIONS_REDIS = 'EBAY_INTEGRATIONS_REDIS';

@Injectable()
export class EbayIntegrationsRedisConnection implements OnModuleDestroy {
  readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL', '').trim();
    if (url) {
      this.client = new Redis(url, { maxRetriesPerRequest: null });
    } else {
      this.client = new Redis({
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: Number(this.config.get<string>('REDIS_PORT', '6379')),
        password: this.config.get<string>('REDIS_PASSWORD', '') || undefined,
        maxRetriesPerRequest: null,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
