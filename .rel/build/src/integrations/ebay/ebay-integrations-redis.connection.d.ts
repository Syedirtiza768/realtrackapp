import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare const EBAY_INTEGRATIONS_REDIS = "EBAY_INTEGRATIONS_REDIS";
export declare class EbayIntegrationsRedisConnection implements OnModuleDestroy {
    private readonly config;
    readonly client: Redis;
    constructor(config: ConfigService);
    onModuleDestroy(): Promise<void>;
}
