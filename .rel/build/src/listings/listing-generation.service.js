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
var ListingGenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingGenerationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const master_product_entity_js_1 = require("./entities/master-product.entity.js");
const ebay_offer_entity_js_1 = require("./entities/ebay-offer.entity.js");
const export_rule_service_js_1 = require("./export-rule.service.js");
const listing_generation_pipeline_js_1 = require("../common/openai/pipelines/listing-generation.pipeline.js");
const template_service_js_1 = require("../templates/template.service.js");
const ebay_publish_service_js_1 = require("../channels/ebay/ebay-publish.service.js");
const ebay_listing_text_util_js_1 = require("../channels/ebay/ebay-listing-text.util.js");
const ebay_listing_images_util_js_1 = require("../channels/ebay/ebay-listing-images.util.js");
const ebay_listing_condition_util_js_1 = require("../channels/ebay/ebay-listing-condition.util.js");
let ListingGenerationService = ListingGenerationService_1 = class ListingGenerationService {
    productRepo;
    offerRepo;
    listingPipeline;
    templateService;
    exportRuleService;
    publishService;
    logger = new common_1.Logger(ListingGenerationService_1.name);
    constructor(productRepo, offerRepo, listingPipeline, templateService, exportRuleService, publishService) {
        this.productRepo = productRepo;
        this.offerRepo = offerRepo;
        this.listingPipeline = listingPipeline;
        this.templateService = templateService;
        this.exportRuleService = exportRuleService;
        this.publishService = publishService;
    }
    async generate(input) {
        const product = await this.productRepo.findOneBy({
            id: input.masterProductId,
        });
        if (!product) {
            throw new common_1.NotFoundException(`MasterProduct ${input.masterProductId} not found`);
        }
        const productData = {
            sku: product.sku,
            brand: product.brand,
            mpn: product.mpn,
            oem_number: product.oemNumber,
            upc: product.upc,
            title: product.title,
            part_type: product.partType,
            condition: product.condition,
            condition_description: product.conditionDescription,
            features: product.features,
            item_specifics: product.itemSpecifics,
            image_count: product.imageUrls.length,
        };
        if (input.templateId) {
            try {
                const { html } = await this.templateService.renderPreview(input.templateId, {
                    variables: productData,
                });
                productData.template_context = html;
            }
            catch (err) {
                this.logger.warn(`Template ${input.templateId} render failed, proceeding without: ${err}`);
            }
        }
        const categoryName = input.categoryName ??
            product.ebayCategoryName ??
            'Auto Parts & Accessories';
        const generation = await this.listingPipeline.generate(productData, categoryName, product.condition);
        this.logger.log(`Generated listing for ${product.sku}: "${generation.title}"`);
        return {
            generation,
            product,
            appliedOverrides: null,
        };
    }
    async generateAndCreateOffers(input) {
        const { generation, product } = await this.generate(input);
        const offers = [];
        for (const storeId of input.storeIds) {
            let offer = await this.offerRepo.findOne({
                where: { masterProductId: product.id, storeId },
            });
            const rulePrice = await this.findBestRulePrice(product, storeId);
            const finalPrice = rulePrice ??
                generation.pricePositioning.suggestedPrice ??
                Number(product.retailPrice) ??
                0;
            const finalTitle = (0, ebay_listing_text_util_js_1.truncateEbayTitle)(generation.title);
            if (offer) {
                offer.titleOverride = finalTitle !== product.title ? finalTitle : null;
                offer.price = finalPrice;
                offer.quantity = product.totalQuantity;
                offer.status = 'draft';
                offer.lastError = null;
                offer = await this.offerRepo.save(offer);
            }
            else {
                offer = this.offerRepo.create({
                    masterProductId: product.id,
                    storeId,
                    sku: product.sku,
                    titleOverride: finalTitle !== product.title ? finalTitle : null,
                    price: finalPrice,
                    quantity: product.totalQuantity,
                    categoryId: product.ebayCategoryId,
                    format: 'FIXED_PRICE',
                    status: 'draft',
                });
                offer = await this.offerRepo.save(offer);
            }
            offers.push(offer);
        }
        this.logger.log(`Created ${offers.length} draft offer(s) for ${product.sku}`);
        let publishResults;
        if (input.publishImmediately && offers.length > 0) {
            publishResults = await this.publishOffers(product, offers, generation);
        }
        return { generation, offers, publishResults };
    }
    async publishOffers(product, offers, generation) {
        const images = (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(product.imageUrls);
        const publishReq = {
            listingId: product.id,
            storeIds: offers.map((o) => o.storeId),
            sku: product.sku,
            title: (0, ebay_listing_text_util_js_1.truncateEbayTitle)(generation.title),
            description: generation.description,
            categoryId: product.ebayCategoryId ?? '',
            condition: (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(product.condition),
            conditionDescription: product.conditionDescription ?? undefined,
            price: Number(offers[0].price) || 0,
            quantity: product.totalQuantity,
            imageUrls: images.imageUrls,
            aspects: product.itemSpecifics,
        };
        const results = await this.publishService.publish(publishReq);
        for (const result of results) {
            const offer = offers.find((o) => o.storeId === result.storeId);
            if (!offer)
                continue;
            if (result.success) {
                offer.ebayOfferId = result.offerId ?? null;
                offer.ebayListingId = result.listingId ?? null;
                offer.status = 'published';
                offer.publishedAt = new Date();
                offer.lastSyncedAt = new Date();
                offer.lastError = null;
            }
            else {
                offer.status = 'error';
                offer.lastError = result.error ?? 'Unknown publish error';
            }
            await this.offerRepo.save(offer);
        }
        return results;
    }
    async generateBatch(inputs) {
        const results = [];
        for (let i = 0; i < inputs.length; i++) {
            this.logger.debug(`Batch generate ${i + 1}/${inputs.length}`);
            try {
                const result = await this.generate(inputs[i]);
                results.push(result);
            }
            catch (err) {
                this.logger.error(`Batch item ${i + 1} failed: ${err}`);
            }
        }
        return results;
    }
    async findBestRulePrice(product, storeId) {
        try {
            const rules = await this.exportRuleService.findAll();
            const storeRule = rules.find((r) => r.storeId === storeId && r.status === 'active');
            if (!storeRule)
                return null;
            const basePrice = Number(product.retailPrice) || 0;
            return this.exportRuleService.computeRulePrice(storeRule, basePrice);
        }
        catch {
            return null;
        }
    }
};
exports.ListingGenerationService = ListingGenerationService;
exports.ListingGenerationService = ListingGenerationService = ListingGenerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(master_product_entity_js_1.MasterProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_offer_entity_js_1.EbayOffer)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        listing_generation_pipeline_js_1.ListingGenerationPipeline,
        template_service_js_1.TemplateService,
        export_rule_service_js_1.ExportRuleService,
        ebay_publish_service_js_1.EbayPublishService])
], ListingGenerationService);
//# sourceMappingURL=listing-generation.service.js.map