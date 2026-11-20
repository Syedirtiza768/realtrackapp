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
var EbayTaxonomyTruthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayTaxonomyTruthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_category_entity_js_1 = require("../../listings/entities/ebay-category.entity.js");
function aspectLabel(aspect) {
    const name = aspect.localizedAspectName ??
        aspect.aspectName ??
        aspect.name ??
        aspect.label;
    return name ? String(name).trim() : null;
}
let EbayTaxonomyTruthService = EbayTaxonomyTruthService_1 = class EbayTaxonomyTruthService {
    config;
    categoryRepo;
    logger = new common_1.Logger(EbayTaxonomyTruthService_1.name);
    constructor(config, categoryRepo) {
        this.config = config;
        this.categoryRepo = categoryRepo;
    }
    isEnabled() {
        return (this.config.get('AI_TAXONOMY_VALIDATION_ENABLED', 'false') === 'true');
    }
    async validate(ebayCategoryId, itemSpecifics) {
        if (!this.isEnabled()) {
            return { hardFails: [], softFails: [], skipped: true };
        }
        const hardFails = [];
        const softFails = [];
        if (!ebayCategoryId?.trim()) {
            softFails.push('TAXONOMY_NO_CATEGORY_ID');
            return { hardFails, softFails, skipped: false };
        }
        const category = await this.categoryRepo.findOne({
            where: { ebayCategoryId: ebayCategoryId.trim() },
        });
        if (!category) {
            softFails.push(`TAXONOMY_CATEGORY_NOT_CACHED:${ebayCategoryId}`);
            return { hardFails, softFails, skipped: false };
        }
        if (!category.isLeaf) {
            hardFails.push(`TAXONOMY_NOT_LEAF:${ebayCategoryId}`);
        }
        const requiredNames = (category.requiredAspects ?? [])
            .map((a) => aspectLabel(a))
            .filter((n) => Boolean(n));
        for (const aspectName of requiredNames) {
            const value = itemSpecifics[aspectName];
            if (!value || !String(value).trim()) {
                hardFails.push(`TAXONOMY_MISSING_ASPECT:${aspectName}`);
            }
        }
        this.logger.debug(`Taxonomy check cat=${ebayCategoryId} hard=${hardFails.length} soft=${softFails.length}`);
        return { hardFails, softFails, skipped: false };
    }
};
exports.EbayTaxonomyTruthService = EbayTaxonomyTruthService;
exports.EbayTaxonomyTruthService = EbayTaxonomyTruthService = EbayTaxonomyTruthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_category_entity_js_1.EbayCategory)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.Repository])
], EbayTaxonomyTruthService);
//# sourceMappingURL=ebay-taxonomy-truth.service.js.map