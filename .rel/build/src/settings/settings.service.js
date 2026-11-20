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
var SettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const tenant_setting_entity_js_1 = require("./entities/tenant-setting.entity.js");
const shipping_profile_entity_js_1 = require("./entities/shipping-profile.entity.js");
const pricing_rule_entity_js_1 = require("./entities/pricing-rule.entity.js");
let SettingsService = SettingsService_1 = class SettingsService {
    settingRepo;
    shippingRepo;
    pricingRepo;
    eventEmitter;
    logger = new common_1.Logger(SettingsService_1.name);
    cache = new Map();
    constructor(settingRepo, shippingRepo, pricingRepo, eventEmitter) {
        this.settingRepo = settingRepo;
        this.shippingRepo = shippingRepo;
        this.pricingRepo = pricingRepo;
        this.eventEmitter = eventEmitter;
    }
    async getAll() {
        const rows = await this.settingRepo.find({
            order: { category: 'ASC', key: 'ASC' },
        });
        const grouped = {};
        for (const row of rows) {
            if (!grouped[row.category])
                grouped[row.category] = {};
            grouped[row.category][row.key] = row.value;
        }
        return grouped;
    }
    async getByCategory(category) {
        const rows = await this.settingRepo.find({
            where: { category },
            order: { key: 'ASC' },
        });
        const result = {};
        for (const row of rows) {
            result[row.key] = row.value;
        }
        return result;
    }
    async getSetting(category, key) {
        const cacheKey = `${category}:${key}`;
        if (this.cache.has(cacheKey))
            return this.cache.get(cacheKey);
        const row = await this.settingRepo.findOne({ where: { category, key } });
        if (!row)
            return undefined;
        this.cache.set(cacheKey, row.value);
        return row.value;
    }
    async updateSetting(category, key, value, updatedBy) {
        let row = await this.settingRepo.findOne({ where: { category, key } });
        if (!row) {
            row = this.settingRepo.create({
                category,
                key,
                value,
                updatedBy: updatedBy ?? null,
            });
        }
        else {
            row.value = value;
            row.updatedBy = updatedBy ?? null;
        }
        const saved = await this.settingRepo.save(row);
        this.cache.set(`${category}:${key}`, value);
        return saved;
    }
    async getShippingProfiles() {
        return this.shippingRepo.find({
            order: { isDefault: 'DESC', name: 'ASC' },
        });
    }
    async createShippingProfile(dto) {
        if (dto.isDefault) {
            await this.shippingRepo.update({}, { isDefault: false });
        }
        const profile = this.shippingRepo.create(dto);
        return this.shippingRepo.save(profile);
    }
    async updateShippingProfile(id, dto) {
        const profile = await this.shippingRepo.findOne({ where: { id } });
        if (!profile)
            throw new common_1.NotFoundException('Shipping profile not found');
        if (dto.isDefault) {
            await this.shippingRepo.update({}, { isDefault: false });
        }
        Object.assign(profile, dto);
        return this.shippingRepo.save(profile);
    }
    async deleteShippingProfile(id) {
        const result = await this.shippingRepo.delete(id);
        if (result.affected === 0)
            throw new common_1.NotFoundException('Shipping profile not found');
    }
    async getPricingRules() {
        return this.pricingRepo.find({
            order: { priority: 'ASC', createdAt: 'DESC' },
        });
    }
    async createPricingRule(dto) {
        const rule = this.pricingRepo.create({
            name: dto.name,
            ruleType: dto.ruleType,
            channel: dto.channel ?? null,
            categoryId: dto.categoryId ?? null,
            brand: dto.brand ?? null,
            parameters: dto.parameters,
            priority: dto.priority ?? 0,
            active: dto.active ?? true,
        });
        const saved = await this.pricingRepo.save(rule);
        this.eventEmitter.emit('pricing_rule.changed', {
            ruleId: saved.id,
            ruleType: saved.ruleType,
            channel: saved.channel,
        });
        return saved;
    }
    async updatePricingRule(id, dto) {
        const rule = await this.pricingRepo.findOne({ where: { id } });
        if (!rule)
            throw new common_1.NotFoundException('Pricing rule not found');
        Object.assign(rule, dto);
        const saved = await this.pricingRepo.save(rule);
        this.eventEmitter.emit('pricing_rule.changed', {
            ruleId: saved.id,
            ruleType: saved.ruleType,
            channel: saved.channel,
        });
        return saved;
    }
    async deletePricingRule(id) {
        const result = await this.pricingRepo.delete(id);
        if (result.affected === 0)
            throw new common_1.NotFoundException('Pricing rule not found');
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = SettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(tenant_setting_entity_js_1.TenantSetting)),
    __param(1, (0, typeorm_1.InjectRepository)(shipping_profile_entity_js_1.ShippingProfile)),
    __param(2, (0, typeorm_1.InjectRepository)(pricing_rule_entity_js_1.PricingRule)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], SettingsService);
//# sourceMappingURL=settings.service.js.map