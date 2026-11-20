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
var ExportRuleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportRuleService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const export_rule_entity_js_1 = require("./entities/export-rule.entity.js");
const master_product_entity_js_1 = require("./entities/master-product.entity.js");
const ebay_offer_entity_js_1 = require("./entities/ebay-offer.entity.js");
const ebay_listing_text_util_js_1 = require("../channels/ebay/ebay-listing-text.util.js");
let ExportRuleService = ExportRuleService_1 = class ExportRuleService {
    ruleRepo;
    productRepo;
    offerRepo;
    logger = new common_1.Logger(ExportRuleService_1.name);
    constructor(ruleRepo, productRepo, offerRepo) {
        this.ruleRepo = ruleRepo;
        this.productRepo = productRepo;
        this.offerRepo = offerRepo;
    }
    async create(dto) {
        const rule = this.ruleRepo.create(dto);
        const saved = await this.ruleRepo.save(rule);
        this.logger.log(`Created export rule "${saved.name}" → store ${saved.storeId}`);
        return saved;
    }
    async findAll(organizationId) {
        const where = organizationId ? { organizationId } : {};
        return this.ruleRepo.find({
            where,
            order: { createdAt: 'DESC' },
            relations: ['store'],
        });
    }
    async findOne(id) {
        const rule = await this.ruleRepo.findOne({
            where: { id },
            relations: ['store'],
        });
        if (!rule)
            throw new common_1.NotFoundException(`Export rule ${id} not found`);
        return rule;
    }
    async update(id, dto) {
        const rule = await this.findOne(id);
        Object.assign(rule, dto);
        return this.ruleRepo.save(rule);
    }
    async remove(id) {
        const rule = await this.findOne(id);
        await this.ruleRepo.remove(rule);
        this.logger.log(`Deleted export rule "${rule.name}"`);
    }
    async findMatchingProducts(ruleId) {
        const rule = await this.findOne(ruleId);
        const filters = rule.filters;
        const qb = this.productRepo.createQueryBuilder('p');
        qb.where('p.status IN (:...statuses)', {
            statuses: ['ready', 'published'],
        });
        if (filters.brand && Array.isArray(filters.brand)) {
            qb.andWhere('p.brand IN (:...brands)', { brands: filters.brand });
        }
        if (filters.partType && Array.isArray(filters.partType)) {
            qb.andWhere('p.part_type IN (:...partTypes)', {
                partTypes: filters.partType,
            });
        }
        if (filters.condition && Array.isArray(filters.condition)) {
            qb.andWhere('p.condition IN (:...conditions)', {
                conditions: filters.condition,
            });
        }
        if (typeof filters.minPrice === 'number') {
            qb.andWhere('p.retail_price >= :minPrice', {
                minPrice: filters.minPrice,
            });
        }
        if (typeof filters.maxPrice === 'number') {
            qb.andWhere('p.retail_price <= :maxPrice', {
                maxPrice: filters.maxPrice,
            });
        }
        if (typeof filters.minQuantity === 'number') {
            qb.andWhere('p.total_quantity >= :minQty', {
                minQty: filters.minQuantity,
            });
        }
        qb.andWhere(`p.id NOT IN (
        SELECT eo.master_product_id FROM ebay_offers eo
        WHERE eo.store_id = :storeId
        AND eo.status != 'error'
      )`, { storeId: rule.storeId });
        return qb.getMany();
    }
    computeRulePrice(rule, basePrice) {
        let price = basePrice * (rule.priceMultiplier ?? 1);
        price += rule.priceAddition ?? 0;
        return Math.round(price * 100) / 100;
    }
    computeRuleTitle(rule, baseTitle) {
        let title = baseTitle;
        if (rule.titlePrefix)
            title = `${rule.titlePrefix}${title}`;
        if (rule.titleSuffix)
            title = `${title}${rule.titleSuffix}`;
        return (0, ebay_listing_text_util_js_1.truncateEbayTitle)(title);
    }
    async executeRule(ruleId) {
        const rule = await this.findOne(ruleId);
        const products = await this.findMatchingProducts(ruleId);
        if (products.length === 0) {
            this.logger.log(`Rule "${rule.name}": no matching products found`);
            return 0;
        }
        let created = 0;
        for (const product of products) {
            const price = this.computeRulePrice(rule, Number(product.retailPrice) || 0);
            const title = this.computeRuleTitle(rule, product.title);
            const offer = this.offerRepo.create({
                masterProductId: product.id,
                storeId: rule.storeId,
                sku: product.sku,
                titleOverride: title !== product.title ? title : null,
                price,
                quantity: product.totalQuantity,
                categoryId: product.ebayCategoryId,
                format: 'FIXED_PRICE',
                fulfillmentPolicyId: rule.fulfillmentPolicyId,
                paymentPolicyId: rule.paymentPolicyId,
                returnPolicyId: rule.returnPolicyId,
                status: 'draft',
            });
            await this.offerRepo.save(offer);
            created++;
        }
        rule.lastRunAt = new Date();
        rule.lastRunCount = created;
        rule.totalExported += created;
        await this.ruleRepo.save(rule);
        this.logger.log(`Rule "${rule.name}" executed: ${created} offers created from ${products.length} matching products`);
        return created;
    }
};
exports.ExportRuleService = ExportRuleService;
exports.ExportRuleService = ExportRuleService = ExportRuleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(export_rule_entity_js_1.ExportRule)),
    __param(1, (0, typeorm_1.InjectRepository)(master_product_entity_js_1.MasterProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_offer_entity_js_1.EbayOffer)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ExportRuleService);
//# sourceMappingURL=export-rule.service.js.map