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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayIntegrationsRedisConnection = exports.EBAY_INTEGRATIONS_REDIS = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
exports.EBAY_INTEGRATIONS_REDIS = 'EBAY_INTEGRATIONS_REDIS';
let EbayIntegrationsRedisConnection = class EbayIntegrationsRedisConnection {
    config;
    client;
    constructor(config) {
        this.config = config;
        const url = this.config.get('REDIS_URL', '').trim();
        if (url) {
            this.client = new ioredis_1.default(url, { maxRetriesPerRequest: null });
        }
        else {
            this.client = new ioredis_1.default({
                host: this.config.get('REDIS_HOST', 'localhost'),
                port: Number(this.config.get('REDIS_PORT', '6379')),
                password: this.config.get('REDIS_PASSWORD', '') || undefined,
                maxRetriesPerRequest: null,
            });
        }
    }
    async onModuleDestroy() {
        await this.client.quit();
    }
};
exports.EbayIntegrationsRedisConnection = EbayIntegrationsRedisConnection;
exports.EbayIntegrationsRedisConnection = EbayIntegrationsRedisConnection = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EbayIntegrationsRedisConnection);
//# sourceMappingURL=ebay-integrations-redis.connection.js.map