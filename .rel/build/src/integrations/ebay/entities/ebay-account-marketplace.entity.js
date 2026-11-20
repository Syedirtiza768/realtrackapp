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
exports.EbayAccountMarketplace = void 0;
const typeorm_1 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
let EbayAccountMarketplace = class EbayAccountMarketplace {
    id;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    currency;
    locale;
    enabled;
    defaultInventoryLocationKey;
    defaultPaymentPolicyId;
    defaultReturnPolicyId;
    defaultFulfillmentPolicyId;
    createdAt;
    updatedAt;
};
exports.EbayAccountMarketplace = EbayAccountMarketplace;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayAccountMarketplace.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayAccountMarketplace.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, (a) => a.marketplaces, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], EbayAccountMarketplace.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], EbayAccountMarketplace.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3 }),
    __metadata("design:type", String)
], EbayAccountMarketplace.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], EbayAccountMarketplace.prototype, "locale", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], EbayAccountMarketplace.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'default_inventory_location_key',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayAccountMarketplace.prototype, "defaultInventoryLocationKey", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'default_payment_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayAccountMarketplace.prototype, "defaultPaymentPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'default_return_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayAccountMarketplace.prototype, "defaultReturnPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'default_fulfillment_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayAccountMarketplace.prototype, "defaultFulfillmentPolicyId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayAccountMarketplace.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayAccountMarketplace.prototype, "updatedAt", void 0);
exports.EbayAccountMarketplace = EbayAccountMarketplace = __decorate([
    (0, typeorm_1.Entity)('ebay_account_marketplaces'),
    (0, typeorm_1.Unique)('uq_ebay_acct_marketplace', ['ebayAccountId', 'marketplaceId']),
    (0, typeorm_1.Index)('idx_ebay_acct_mp_account', ['ebayAccountId']),
    (0, typeorm_1.Index)('idx_ebay_acct_mp_marketplace', ['marketplaceId'])
], EbayAccountMarketplace);
//# sourceMappingURL=ebay-account-marketplace.entity.js.map