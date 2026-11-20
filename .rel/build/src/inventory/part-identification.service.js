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
var PartIdentificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartIdentificationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_browse_api_service_js_1 = require("../channels/ebay/ebay-browse-api.service.js");
const ebay_taxonomy_api_service_js_1 = require("../channels/ebay/ebay-taxonomy-api.service.js");
const ebay_category_entity_js_1 = require("../listings/entities/ebay-category.entity.js");
const listing_guards_js_1 = require("../common/openai/listing-guards.js");
let PartIdentificationService = PartIdentificationService_1 = class PartIdentificationService {
    browseApi;
    taxonomy;
    categoryRepo;
    logger = new common_1.Logger(PartIdentificationService_1.name);
    constructor(browseApi, taxonomy, categoryRepo) {
        this.browseApi = browseApi;
        this.taxonomy = taxonomy;
        this.categoryRepo = categoryRepo;
    }
    async identifyAndCorroborate(candidate) {
        const brand = candidate.brand?.trim();
        const mpn = (candidate.mpn ?? candidate.oemNumber)?.trim();
        if (!brand || !mpn) {
            return { checked: false, found: false, hallucinationWarnings: [] };
        }
        const hallucinationWarnings = (0, listing_guards_js_1.detectHallucinatedPartNumbers)([{ oemPartNumber: mpn, partName: 'identified_part' }], brand);
        if (hallucinationWarnings.length > 0) {
            this.logger.warn(`Part identification: hallucination check flagged ${brand} ${mpn}: ` +
                hallucinationWarnings.join('; '));
        }
        try {
            const result = await this.browseApi.searchByMpn(brand, mpn);
            if (!result.found || result.items.length === 0) {
                return { checked: true, found: false, hallucinationWarnings };
            }
            const best = result.items.find((i) => i.categoryId) ?? result.items[0];
            return {
                checked: true,
                found: true,
                categoryId: best.categoryId ?? null,
                categoryName: best.categoryName ?? null,
                fitmentHints: best.fitmentHints,
                hallucinationWarnings,
            };
        }
        catch (err) {
            this.logger.warn(`Browse API corroboration failed for ${brand} ${mpn}: ` +
                `${err instanceof Error ? err.message : err}`);
            return { checked: false, found: false, hallucinationWarnings };
        }
    }
    async ensureCategoryCached(categoryId, treeId = '0') {
        if (!categoryId?.trim())
            return;
        try {
            const existing = await this.categoryRepo.findOne({
                where: { ebayCategoryId: categoryId, treeId },
            });
            if (existing)
                return;
            const [subtree, aspects] = await Promise.all([
                this.taxonomy.getCategorySubtree(categoryId, treeId).catch(() => null),
                this.taxonomy
                    .getItemAspectsForCategory(categoryId, treeId)
                    .catch(() => []),
            ]);
            const node = subtree?.categorySubtreeNode;
            const requiredAspects = aspects.filter((a) => a.aspectConstraint?.aspectRequired);
            const recommendedAspects = aspects.filter((a) => !a.aspectConstraint?.aspectRequired);
            const row = new ebay_category_entity_js_1.EbayCategory();
            row.ebayCategoryId = categoryId;
            row.treeId = treeId;
            row.parentCategoryId = null;
            row.categoryName = node?.category?.categoryName ?? categoryId;
            row.categoryPath = null;
            row.depth = 0;
            row.isLeaf = node?.leafCategoryTreeNode ?? true;
            row.requiredAspects = requiredAspects;
            row.recommendedAspects = recommendedAspects;
            row.supportsCompatibility = false;
            row.treeVersion = null;
            await this.categoryRepo.save(row);
            this.logger.log(`Cached eBay category ${categoryId} (tree ${treeId}): leaf=${row.isLeaf}, ` +
                `${requiredAspects.length} required aspect(s)`);
        }
        catch (err) {
            this.logger.warn(`Failed to cache category ${categoryId}: ` +
                `${err instanceof Error ? err.message : err}`);
        }
    }
};
exports.PartIdentificationService = PartIdentificationService;
exports.PartIdentificationService = PartIdentificationService = PartIdentificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_category_entity_js_1.EbayCategory)),
    __metadata("design:paramtypes", [ebay_browse_api_service_js_1.EbayBrowseApiService,
        ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        typeorm_2.Repository])
], PartIdentificationService);
//# sourceMappingURL=part-identification.service.js.map