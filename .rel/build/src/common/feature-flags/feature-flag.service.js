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
var FeatureFlagService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const feature_flag_entity_js_1 = require("./feature-flag.entity.js");
let FeatureFlagService = class FeatureFlagService {
    static { FeatureFlagService_1 = this; }
    flagRepo;
    logger = new common_1.Logger(FeatureFlagService_1.name);
    cache = new Map();
    cacheAge = 0;
    static CACHE_TTL_MS = 60_000;
    constructor(flagRepo) {
        this.flagRepo = flagRepo;
    }
    async isEnabled(key) {
        await this.refreshCacheIfStale();
        return this.cache.get(key) ?? false;
    }
    async getAll() {
        return this.flagRepo.find({ order: { key: 'ASC' } });
    }
    async getByKey(key) {
        const flag = await this.flagRepo.findOne({ where: { key } });
        if (!flag)
            throw new common_1.NotFoundException(`Feature flag '${key}' not found`);
        return flag;
    }
    async setEnabled(key, enabled) {
        const flag = await this.getByKey(key);
        flag.enabled = enabled;
        const saved = await this.flagRepo.save(flag);
        this.cache.set(key, enabled);
        this.logger.log(`Feature flag '${key}' set to ${enabled}`);
        return saved;
    }
    async toggle(key) {
        const flag = await this.getByKey(key);
        return this.setEnabled(key, !flag.enabled);
    }
    async ensureFlag(key, description, defaultEnabled = false) {
        const existing = await this.flagRepo.findOne({ where: { key } });
        if (existing)
            return existing;
        const flag = this.flagRepo.create({
            key,
            description: description ?? null,
            enabled: defaultEnabled,
        });
        return this.flagRepo.save(flag);
    }
    async refreshCacheIfStale() {
        if (Date.now() - this.cacheAge < FeatureFlagService_1.CACHE_TTL_MS &&
            this.cache.size > 0) {
            return;
        }
        try {
            const flags = await this.flagRepo.find();
            this.cache = new Map(flags.map((f) => [f.key, f.enabled]));
            this.cacheAge = Date.now();
        }
        catch (error) {
            this.logger.warn('Failed to refresh feature flag cache', error);
        }
    }
};
exports.FeatureFlagService = FeatureFlagService;
exports.FeatureFlagService = FeatureFlagService = FeatureFlagService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(feature_flag_entity_js_1.FeatureFlag)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], FeatureFlagService);
//# sourceMappingURL=feature-flag.service.js.map