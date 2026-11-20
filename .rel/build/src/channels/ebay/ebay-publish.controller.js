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
exports.EbayPublishController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const ebay_publish_service_js_1 = require("./ebay-publish.service.js");
class PublishDto {
    listingId;
    storeIds;
    sku;
    title;
    description;
    categoryId;
    condition;
    conditionDescription;
    price;
    currency;
    quantity;
    imageUrls;
    aspects;
    compatibility;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    merchantLocationKey;
    listingFormat;
    listingDuration;
    requestedFulfillmentPolicyName;
    requestedReturnPolicyName;
    requestedPaymentPolicyName;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "listingId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PublishDto.prototype, "storeIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "sku", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "conditionDescription", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PublishDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PublishDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PublishDto.prototype, "imageUrls", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PublishDto.prototype, "aspects", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], PublishDto.prototype, "compatibility", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "returnPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "merchantLocationKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['FIXED_PRICE', 'AUCTION']),
    __metadata("design:type", String)
], PublishDto.prototype, "listingFormat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "listingDuration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "requestedFulfillmentPolicyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "requestedReturnPolicyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishDto.prototype, "requestedPaymentPolicyName", void 0);
class PublishOfferDto {
    offerId;
    price;
    quantity;
    currency;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishOfferDto.prototype, "offerId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PublishOfferDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PublishOfferDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishOfferDto.prototype, "currency", void 0);
class BulkPublishDto {
    items;
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PublishDto),
    __metadata("design:type", Array)
], BulkPublishDto.prototype, "items", void 0);
class PublishByListingIdsDto {
    listingIds;
    storeIds;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    shippingProfileName;
    returnProfileName;
    paymentProfileName;
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PublishByListingIdsDto.prototype, "listingIds", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PublishByListingIdsDto.prototype, "storeIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishByListingIdsDto.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishByListingIdsDto.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishByListingIdsDto.prototype, "returnPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishByListingIdsDto.prototype, "shippingProfileName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishByListingIdsDto.prototype, "returnProfileName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PublishByListingIdsDto.prototype, "paymentProfileName", void 0);
class UpdatePriceQuantityDto {
    storeId;
    offers;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePriceQuantityDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PublishOfferDto),
    __metadata("design:type", Array)
], UpdatePriceQuantityDto.prototype, "offers", void 0);
class EndListingDto {
    storeId;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EndListingDto.prototype, "storeId", void 0);
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
let EbayPublishController = class EbayPublishController {
    publishService;
    constructor(publishService) {
        this.publishService = publishService;
    }
    async publish(dto) {
        return this.publishService.publish(dto);
    }
    async publishBatch(dto) {
        const allResults = [];
        for (const item of dto.items) {
            const results = await this.publishService.publish(item);
            allResults.push({ listingId: item.listingId, results });
        }
        return allResults;
    }
    async publishByListingIds(dto) {
        return this.publishService.publishByListingIds(dto.listingIds, dto.storeIds, {
            fulfillmentPolicyId: dto.fulfillmentPolicyId,
            paymentPolicyId: dto.paymentPolicyId,
            returnPolicyId: dto.returnPolicyId,
            shippingProfileName: dto.shippingProfileName,
            returnProfileName: dto.returnProfileName,
            paymentProfileName: dto.paymentProfileName,
        });
    }
    async updatePriceQuantity(dto) {
        return this.publishService.updatePriceQuantity(dto.storeId, dto.offers);
    }
    async endListing(offerId, dto) {
        return this.publishService.endListing(dto.storeId, offerId);
    }
};
exports.EbayPublishController = EbayPublishController;
__decorate([
    (0, common_1.Post)('publish'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Publish a listing to one or more eBay stores' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PublishDto]),
    __metadata("design:returntype", Promise)
], EbayPublishController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)('publish-batch'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Batch publish multiple listings to eBay stores' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BulkPublishDto]),
    __metadata("design:returntype", Promise)
], EbayPublishController.prototype, "publishBatch", null);
__decorate([
    (0, common_1.Post)('publish-by-listings'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Publish listing records by ID; backend enriches SKU, images, condition, and policies',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PublishByListingIdsDto]),
    __metadata("design:returntype", Promise)
], EbayPublishController.prototype, "publishByListingIds", null);
__decorate([
    (0, common_1.Patch)('offers/price-quantity'),
    (0, swagger_1.ApiOperation)({
        summary: 'Update price and quantity for existing eBay offers',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpdatePriceQuantityDto]),
    __metadata("design:returntype", Promise)
], EbayPublishController.prototype, "updatePriceQuantity", null);
__decorate([
    (0, common_1.Delete)('offers/:offerId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'End/withdraw an eBay listing' }),
    (0, swagger_1.ApiParam)({ name: 'offerId', type: String }),
    __param(0, (0, common_1.Param)('offerId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, EndListingDto]),
    __metadata("design:returntype", Promise)
], EbayPublishController.prototype, "endListing", null);
exports.EbayPublishController = EbayPublishController = __decorate([
    (0, swagger_1.ApiTags)('eBay Publish'),
    (0, common_1.Controller)('channels/ebay'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.publish'),
    __metadata("design:paramtypes", [ebay_publish_service_js_1.EbayPublishService])
], EbayPublishController);
//# sourceMappingURL=ebay-publish.controller.js.map