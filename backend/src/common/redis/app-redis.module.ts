import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { APP_REDIS } from './app-redis.constants.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: APP_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('REDIS_URL', '').trim();
        if (url) {
          return new Redis(url, { maxRetriesPerRequest: null });
        }
        return new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string>('REDIS_PORT', '6379')),
          password: config.get<string>('REDIS_PASSWORD', '') || undefined,
          maxRetriesPerRequest: null,
        });
      },
    },
  ],
  exports: [APP_REDIS],
})
export class AppRedisModule {}
