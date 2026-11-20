"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisCacheInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCacheInterceptor = exports.CacheTTL = exports.CACHE_TTL_KEY = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
exports.CACHE_TTL_KEY = 'cache_ttl';
const CacheTTL = (seconds) => (0, common_1.SetMetadata)(exports.CACHE_TTL_KEY, seconds);
exports.CacheTTL = CacheTTL;
let RedisCacheInterceptor = RedisCacheInterceptor_1 = class RedisCacheInterceptor {
    reflector;
    configService;
    logger = new common_1.Logger(RedisCacheInterceptor_1.name);
    redis;
    prefix = 'api_cache:';
    constructor(reflector, configService) {
        this.reflector = reflector;
        this.configService = configService;
        try {
            this.redis = new ioredis_1.default({
                host: this.configService.get('REDIS_HOST', 'localhost'),
                port: Number(this.configService.get('REDIS_PORT', '6379')),
                password: this.configService.get('REDIS_PASSWORD', '') || undefined,
                keyPrefix: this.prefix,
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                retryStrategy: (times) => times > 2 ? null : Math.min(times * 200, 2000),
            });
            this.redis.connect().catch(() => {
                this.logger.warn('Redis cache unavailable — falling through to handler');
                this.redis?.disconnect();
            });
        }
        catch {
            this.redis = null;
        }
    }
    async intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        if (request.method !== 'GET') {
            return next.handle();
        }
        const ttl = this.reflector.get(exports.CACHE_TTL_KEY, context.getHandler());
        if (!ttl || !this.redis) {
            return next.handle();
        }
        const cacheKey = `${request.url}`;
        try {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                return (0, rxjs_1.of)(JSON.parse(cached));
            }
        }
        catch {
        }
        return next.handle().pipe((0, operators_1.tap)(async (data) => {
            try {
                await this.redis?.setex(cacheKey, ttl, JSON.stringify(data));
            }
            catch {
            }
        }));
    }
};
exports.RedisCacheInterceptor = RedisCacheInterceptor;
exports.RedisCacheInterceptor = RedisCacheInterceptor = RedisCacheInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        config_1.ConfigService])
], RedisCacheInterceptor);
//# sourceMappingURL=redis-cache.interceptor.js.map