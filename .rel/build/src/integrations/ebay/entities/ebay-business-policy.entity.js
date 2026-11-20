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
exports.EbayBusinessPolicy = void 0;
const typeorm_1 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
let EbayBusinessPolicy = class EbayBusinessPolicy {
    id;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    policyType;
    ebayPolicyId;
    name;
    rawPayload;
    isDefault;
    createdAt;
    updatedAt;
};
exports.EbayBusinessPolicy = EbayBusinessPolicy;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayBusinessPolicy.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayBusinessPolicy.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], EbayBusinessPolicy.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketplace_id', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], EbayBusinessPolicy.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'policy_type', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], EbayBusinessPolicy.prototype, "policyType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_policy_id', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], EbayBusinessPolicy.prototype, "ebayPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 300 }),
    __metadata("design:type", String)
], EbayBusinessPolicy.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'raw_payload', type: 'jsonb', default: () => `'{}'` }),
    __metadata("design:type", Object)
], EbayBusinessPolicy.prototype, "rawPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_default', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], EbayBusinessPolicy.prototype, "isDefault", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayBusinessPolicy.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayBusinessPolicy.prototype, "updatedAt", void 0);
exports.EbayBusinessPolicy = EbayBusinessPolicy = __decorate([
    (0, typeorm_1.Entity)('ebay_business_policies'),
    (0, typeorm_1.Index)('idx_ebay_policies_account', ['ebayAccountId']),
    (0, typeorm_1.Index)('idx_ebay_policies_marketplace', ['marketplaceId'])
], EbayBusinessPolicy);
//# sourceMappingURL=ebay-business-policy.entity.js.map