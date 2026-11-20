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
var SchedulerLeaderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerLeaderService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const app_redis_constants_js_1 = require("../redis/app-redis.constants.js");
const LOCK_PREFIX = 'scheduler:lock:';
let SchedulerLeaderService = SchedulerLeaderService_1 = class SchedulerLeaderService {
    redis;
    logger = new common_1.Logger(SchedulerLeaderService_1.name);
    enabled;
    constructor(redis, config) {
        this.redis = redis;
        const explicit = config.get('SCHEDULER_LEADER_ENABLED');
        this.enabled =
            explicit === undefined || explicit === ''
                ? true
                : explicit === 'true' || explicit === '1';
    }
    async runIfLeader(lockName, ttlSeconds, fn) {
        if (!this.enabled) {
            await fn();
            return true;
        }
        const key = LOCK_PREFIX + lockName;
        const token = (0, node_crypto_1.randomUUID)();
        const acquired = await this.redis.set(key, token, 'EX', ttlSeconds, 'NX');
        if (acquired !== 'OK') {
            this.logger.debug(`Skipping scheduler job "${lockName}" — lock held elsewhere`);
            return false;
        }
        try {
            await fn();
            return true;
        }
        finally {
            const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end`;
            await this.redis.eval(script, 1, key, token);
        }
    }
};
exports.SchedulerLeaderService = SchedulerLeaderService;
exports.SchedulerLeaderService = SchedulerLeaderService = SchedulerLeaderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(app_redis_constants_js_1.APP_REDIS)),
    __metadata("design:paramtypes", [Function, config_1.ConfigService])
], SchedulerLeaderService);
//# sourceMappingURL=scheduler-leader.service.js.map