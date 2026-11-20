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
exports.EbayCategoryMapping = void 0;
const typeorm_1 = require("typeorm");
let EbayCategoryMapping = class EbayCategoryMapping {
    id;
    ebayCategoryId;
    ebayCategoryName;
    parentCategoryId;
    parentCategoryName;
    productType;
    isMotorsCategory;
    supportsCompatibility;
    compatibilityProperties;
    listingPolicies;
    maxFitmentRows;
    keywords;
    active;
    createdAt;
    lastSyncedAt;
};
exports.EbayCategoryMapping = EbayCategoryMapping;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayCategoryMapping.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', unique: true }),
    __metadata("design:type", String)
], EbayCategoryMapping.prototype, "ebayCategoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EbayCategoryMapping.prototype, "ebayCategoryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayCategoryMapping.prototype, "parentCategoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayCategoryMapping.prototype, "parentCategoryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayCategoryMapping.prototype, "productType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], EbayCategoryMapping.prototype, "isMotorsCategory", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], EbayCategoryMapping.prototype, "supportsCompatibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], EbayCategoryMapping.prototype, "compatibilityProperties", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayCategoryMapping.prototype, "listingPolicies", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], EbayCategoryMapping.prototype, "maxFitmentRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], EbayCategoryMapping.prototype, "keywords", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], EbayCategoryMapping.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EbayCategoryMapping.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], EbayCategoryMapping.prototype, "lastSyncedAt", void 0);
exports.EbayCategoryMapping = EbayCategoryMapping = __decorate([
    (0, typeorm_1.Entity)('ebay_category_mappings'),
    (0, typeorm_1.Index)('idx_ebay_cat_map_category_id', ['ebayCategoryId']),
    (0, typeorm_1.Index)('idx_ebay_cat_map_product_type', ['productType'])
], EbayCategoryMapping);
//# sourceMappingURL=ebay-category-mapping.entity.js.map