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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayOAuthStateStore = void 0;
const common_1 = require("@nestjs/common");
const ebay_integrations_redis_connection_js_1 = require("../ebay-integrations-redis.connection.js");
const common_2 = require("@nestjs/common");
const PREFIX = 'ebay-oauth-state:';
const TTL_SEC = 900;
let EbayOAuthStateStore = class EbayOAuthStateStore {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async save(state, payload) {
        await this.redis.set(PREFIX + state, JSON.stringify(payload), 'EX', TTL_SEC);
    }
    async consume(state) {
        const key = PREFIX + state;
        const raw = await this.redis.get(key);
        await this.redis.del(key);
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
};
exports.EbayOAuthStateStore = EbayOAuthStateStore;
exports.EbayOAuthStateStore = EbayOAuthStateStore = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_2.Inject)(ebay_integrations_redis_connection_js_1.EBAY_INTEGRATIONS_REDIS)),
    __metadata("design:paramtypes", [Function])
], EbayOAuthStateStore);
//# sourceMappingURL=ebay-oauth-state.store.js.map