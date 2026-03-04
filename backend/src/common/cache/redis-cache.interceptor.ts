import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Decorator to mark a controller method as cacheable */
export const CACHE_TTL_KEY = 'cache_ttl';
export const CacheTTL = (seconds: number) => SetMetadata(CACHE_TTL_KEY, seconds);

/**
 * Redis-backed HTTP response cache interceptor.
 *
 * Usage: Apply @CacheTTL(60) on GET endpoints to cache responses for 60 seconds.
 * Only caches GET requests. Cache keys include the full URL + query string.
 *
 * This is a custom implementation rather than @nestjs/cache-manager because
 * we need fine-grained control over key generation and TTL per-endpoint.
 */
@Injectable()
export class RedisCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RedisCacheInterceptor.name);
  private readonly redis: Redis | null;
  private readonly prefix = 'api_cache:';

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    try {
      this.redis = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: Number(this.configService.get<string>('REDIS_PORT', '6379')),
        password: this.configService.get<string>('REDIS_PASSWORD', '') || undefined,
        keyPrefix: this.prefix,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 2000)),
      });
      this.redis.connect().catch(() => {
        this.logger.warn('Redis cache unavailable — falling through to handler');
        this.redis?.disconnect();
      });
    } catch {
      this.redis = null;
    }
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Only cache GET requests
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Check if endpoint has @CacheTTL decorator
    const ttl = this.reflector.get<number>(CACHE_TTL_KEY, context.getHandler());
    if (!ttl || !this.redis) {
      return next.handle();
    }

    const cacheKey = `${request.url}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return of(JSON.parse(cached));
      }
    } catch {
      // Redis unavailable — proceed to handler
    }

    return next.handle().pipe(
      tap(async (data) => {
        try {
          await this.redis?.setex(cacheKey, ttl, JSON.stringify(data));
        } catch {
          // Silent failure — cache is best-effort
        }
      }),
    );
  }
}
