import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
export declare const CACHE_TTL_KEY = "cache_ttl";
export declare const CacheTTL: (seconds: number) => import("@nestjs/common").CustomDecorator<string>;
export declare class RedisCacheInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly configService;
    private readonly logger;
    private readonly redis;
    private readonly prefix;
    constructor(reflector: Reflector, configService: ConfigService);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
}
