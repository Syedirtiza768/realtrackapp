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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayDefaultPoliciesPatchDto = exports.EbayValidateDto = exports.EbayReconnectBodyDto = exports.EbayBulkPublishStorePolicyDto = exports.EbayBulkPublishJobDto = exports.EbayPublishJobDto = exports.EbayPublishTargetDto = exports.EbayOAuthStartDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class EbayOAuthStartDto {
    organizationId;
    internalStoreId;
    marketplaceId;
    environment;
    accountDisplayName;
}
exports.EbayOAuthStartDto = EbayOAuthStartDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayOAuthStartDto.prototype, "organizationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayOAuthStartDto.prototype, "internalStoreId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayOAuthStartDto.prototype, "marketplaceId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['sandbox', 'production']),
    __metadata("design:type", String)
], EbayOAuthStartDto.prototype, "environment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayOAuthStartDto.prototype, "accountDisplayName", void 0);
class EbayPublishTargetDto {
    ebayAccountId;
    marketplaceId;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    merchantLocationKey;
    requestedFulfillmentPolicyName;
    requestedPaymentPolicyName;
    requestedReturnPolicyName;
}
exports.EbayPublishTargetDto = EbayPublishTargetDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayPublishTargetDto.prototype, "ebayAccountId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayPublishTargetDto.prototype, "marketplaceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayPublishTargetDto.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayPublishTargetDto.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayPublishTargetDto.prototype, "returnPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayPublishTargetDto.prototype, "merchantLocationKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayPublishTargetDto.prototype, "requestedFulfillmentPolicyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayPublishTargetDto.prototype, "requestedPaymentPolicyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayPublishTargetDto.prototype, "requestedReturnPolicyName", void 0);
class EbayPublishJobDto {
    organizationId;
    catalogProductId;
    requestedByUserId;
    targets;
    idempotencyKey;
}
exports.EbayPublishJobDto = EbayPublishJobDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayPublishJobDto.prototype, "organizationId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayPublishJobDto.prototype, "catalogProductId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayPublishJobDto.prototype, "requestedByUserId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => EbayPublishTargetDto),
    __metadata("design:type", Array)
], EbayPublishJobDto.prototype, "targets", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayPublishJobDto.prototype, "idempotencyKey", void 0);
class EbayBulkPublishJobDto {
    organizationId;
    listingIds;
    storeIds;
    storePolicies;
    requestedFulfillmentPolicyName;
    requestedPaymentPolicyName;
    requestedReturnPolicyName;
    idempotencyKey;
}
exports.EbayBulkPublishJobDto = EbayBulkPublishJobDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayBulkPublishJobDto.prototype, "organizationId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    __metadata("design:type", Array)
], EbayBulkPublishJobDto.prototype, "listingIds", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    __metadata("design:type", Array)
], EbayBulkPublishJobDto.prototype, "storeIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => EbayBulkPublishStorePolicyDto),
    __metadata("design:type", Array)
], EbayBulkPublishJobDto.prototype, "storePolicies", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayBulkPublishJobDto.prototype, "requestedFulfillmentPolicyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayBulkPublishJobDto.prototype, "requestedPaymentPolicyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayBulkPublishJobDto.prototype, "requestedReturnPolicyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayBulkPublishJobDto.prototype, "idempotencyKey", void 0);
class EbayBulkPublishStorePolicyDto {
    storeId;
    marketplaceId;
    requestedFulfillmentPolicyName;
    requestedPaymentPolicyName;
    requestedReturnPolicyName;
}
exports.EbayBulkPublishStorePolicyDto = EbayBulkPublishStorePolicyDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayBulkPublishStorePolicyDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^EBAY_[A-Z]+(?:_[A-Z]+)*$/),
    __metadata("design:type", String)
], EbayBulkPublishStorePolicyDto.prototype, "marketplaceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayBulkPublishStorePolicyDto.prototype, "requestedFulfillmentPolicyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayBulkPublishStorePolicyDto.prototype, "requestedPaymentPolicyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayBulkPublishStorePolicyDto.prototype, "requestedReturnPolicyName", void 0);
class EbayReconnectBodyDto {
    marketplaceId;
    environment;
    accountDisplayName;
    internalStoreId;
}
exports.EbayReconnectBodyDto = EbayReconnectBodyDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayReconnectBodyDto.prototype, "marketplaceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['sandbox', 'production']),
    __metadata("design:type", String)
], EbayReconnectBodyDto.prototype, "environment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayReconnectBodyDto.prototype, "accountDisplayName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayReconnectBodyDto.prototype, "internalStoreId", void 0);
class EbayValidateDto {
    organizationId;
    catalogProductId;
    targets;
}
exports.EbayValidateDto = EbayValidateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayValidateDto.prototype, "organizationId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EbayValidateDto.prototype, "catalogProductId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => EbayPublishTargetDto),
    __metadata("design:type", Array)
], EbayValidateDto.prototype, "targets", void 0);
class EbayDefaultPoliciesPatchDto {
    marketplaceId;
    defaultPaymentPolicyId;
    defaultReturnPolicyId;
    defaultFulfillmentPolicyId;
    defaultInventoryLocationKey;
}
exports.EbayDefaultPoliciesPatchDto = EbayDefaultPoliciesPatchDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EbayDefaultPoliciesPatchDto.prototype, "marketplaceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], EbayDefaultPoliciesPatchDto.prototype, "defaultPaymentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], EbayDefaultPoliciesPatchDto.prototype, "defaultReturnPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], EbayDefaultPoliciesPatchDto.prototype, "defaultFulfillmentPolicyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], EbayDefaultPoliciesPatchDto.prototype, "defaultInventoryLocationKey", void 0);
//# sourceMappingURL=ebay-integrations.dto.js.map