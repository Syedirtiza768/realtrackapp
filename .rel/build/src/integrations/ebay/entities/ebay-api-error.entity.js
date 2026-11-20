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
exports.EbayApiError = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../../auth/entities/organization.entity.js");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("./ebay-listing-channel.entity.js");
let EbayApiError = class EbayApiError {
    id;
    organizationId;
    organization;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    catalogProductId;
    catalogProduct;
    ebayListingChannelId;
    ebayListingChannel;
    apiName;
    endpoint;
    responseCode;
    ebayErrorId;
    ebayErrorDomain;
    ebayErrorCategory;
    ebayErrorMessage;
    ebayLongMessage;
    retryable;
    rawResponse;
    createdAt;
};
exports.EbayApiError = EbayApiError;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayApiError.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayApiError.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], EbayApiError.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, {
        onDelete: 'SET NULL',
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'marketplace_id',
        type: 'varchar',
        length: 30,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_listing_channel_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "ebayListingChannelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ebay_listing_channel_entity_js_1.EbayListingChannel, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_listing_channel_id' }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "ebayListingChannel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'api_name', type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], EbayApiError.prototype, "apiName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EbayApiError.prototype, "endpoint", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'response_code', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "responseCode", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_error_id',
        type: 'varchar',
        length: 80,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "ebayErrorId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_error_domain',
        type: 'varchar',
        length: 120,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "ebayErrorDomain", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_error_category',
        type: 'varchar',
        length: 120,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "ebayErrorCategory", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "ebayErrorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_long_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "ebayLongMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], EbayApiError.prototype, "retryable", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'raw_response', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayApiError.prototype, "rawResponse", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayApiError.prototype, "createdAt", void 0);
exports.EbayApiError = EbayApiError = __decorate([
    (0, typeorm_1.Entity)('ebay_api_errors'),
    (0, typeorm_1.Index)('idx_ebay_api_errors_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_ebay_api_errors_account', ['ebayAccountId'])
], EbayApiError);
//# sourceMappingURL=ebay-api-error.entity.js.map