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
var EbayCategoryKeywordAuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayCategoryKeywordAuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_taxonomy_api_service_js_1 = require("./ebay-taxonomy-api.service.js");
const ebay_german_listing_util_js_1 = require("./ebay-german-listing.util.js");
const ebay_category_mapping_entity_js_1 = require("../../motors-intelligence/entities/ebay-category-mapping.entity.js");
let EbayCategoryKeywordAuditService = class EbayCategoryKeywordAuditService {
    static { EbayCategoryKeywordAuditService_1 = this; }
    taxonomy;
    categoryMappingRepo;
    logger = new common_1.Logger(EbayCategoryKeywordAuditService_1.name);
    static MOTORS_TREE_ID = '100';
    constructor(taxonomy, categoryMappingRepo) {
        this.taxonomy = taxonomy;
        this.categoryMappingRepo = categoryMappingRepo;
    }
    async auditCategoryKeywords() {
        const findings = [];
        for (const row of ebay_german_listing_util_js_1.CATEGORY_KEYWORD_ROWS) {
            try {
                const subtree = await this.taxonomy.getCategorySubtree(row.id, EbayCategoryKeywordAuditService_1.MOTORS_TREE_ID);
                const node = subtree.categorySubtreeNode;
                const isLeaf = Boolean(node?.leafCategoryTreeNode);
                const liveName = node?.category?.categoryName;
                const nameChanged = liveName && liveName !== row.name;
                if (!isLeaf) {
                    const reason = `No longer a leaf category (now "${liveName ?? 'unknown'}")`;
                    findings.push({
                        categoryId: row.id,
                        categoryName: row.name,
                        keywords: row.kw,
                        reason,
                    });
                    this.logger.error(`CATEGORY_KEYWORD_ROWS drift: ${row.id} ("${row.name}", keywords: ${row.kw.join(', ')}) — ${reason}. Marking inactive in ebay_category_mappings.`);
                    await this.markInactive(row.id, liveName ?? row.name);
                }
                else if (nameChanged) {
                    const reason = `Still a valid leaf, but eBay renamed it to "${liveName}" — hardcoded mapping may now point to the wrong category for these keywords`;
                    findings.push({
                        categoryId: row.id,
                        categoryName: row.name,
                        keywords: row.kw,
                        reason,
                    });
                    this.logger.error(`CATEGORY_KEYWORD_ROWS drift: ${row.id} ("${row.name}", keywords: ${row.kw.join(', ')}) — ${reason}`);
                }
            }
            catch (err) {
                const status = err?.response
                    ?.status;
                if (status === 400 || status === 404 || status === 410) {
                    const reason = `Category lookup failed with ${status} — likely retired/merged by eBay`;
                    findings.push({
                        categoryId: row.id,
                        categoryName: row.name,
                        keywords: row.kw,
                        reason,
                    });
                    this.logger.error(`CATEGORY_KEYWORD_ROWS drift: ${row.id} ("${row.name}", keywords: ${row.kw.join(', ')}) — ${reason}. Marking inactive in ebay_category_mappings.`);
                    await this.markInactive(row.id, row.name);
                }
                else {
                    this.logger.warn(`Category audit could not verify ${row.id} ("${row.name}"): ${err.message}`);
                }
            }
        }
        if (findings.length === 0) {
            this.logger.log(`Category keyword audit: all ${ebay_german_listing_util_js_1.CATEGORY_KEYWORD_ROWS.length} hardcoded category IDs are still valid leaves with matching names.`);
        }
        else {
            this.logger.error(`Category keyword audit: ${findings.length}/${ebay_german_listing_util_js_1.CATEGORY_KEYWORD_ROWS.length} hardcoded category IDs have drifted — see errors above. These need a code fix (update CATEGORY_KEYWORD_ROWS to the current correct ID), not just the DB-side mitigation applied automatically here.`);
        }
        return findings;
    }
    async markInactive(categoryId, currentName) {
        try {
            const existing = await this.categoryMappingRepo.findOne({
                where: { ebayCategoryId: categoryId },
            });
            if (existing) {
                existing.isMotorsCategory = false;
                existing.active = false;
                existing.ebayCategoryName = currentName;
                await this.categoryMappingRepo.save(existing);
            }
            else {
                await this.categoryMappingRepo.save(this.categoryMappingRepo.create({
                    ebayCategoryId: categoryId,
                    ebayCategoryName: currentName,
                    isMotorsCategory: false,
                    active: false,
                }));
            }
        }
        catch (err) {
            this.logger.warn(`Failed to persist audit finding for category ${categoryId}: ${err.message}`);
        }
    }
};
exports.EbayCategoryKeywordAuditService = EbayCategoryKeywordAuditService;
exports.EbayCategoryKeywordAuditService = EbayCategoryKeywordAuditService = EbayCategoryKeywordAuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_category_mapping_entity_js_1.EbayCategoryMapping)),
    __metadata("design:paramtypes", [ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        typeorm_2.Repository])
], EbayCategoryKeywordAuditService);
//# sourceMappingURL=ebay-category-keyword-audit.service.js.map