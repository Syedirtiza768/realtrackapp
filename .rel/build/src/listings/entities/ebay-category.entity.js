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
exports.EbayCategory = void 0;
const typeorm_1 = require("typeorm");
let EbayCategory = class EbayCategory {
    id;
    ebayCategoryId;
    treeId;
    parentCategoryId;
    categoryName;
    categoryPath;
    depth;
    isLeaf;
    requiredAspects;
    recommendedAspects;
    supportsCompatibility;
    treeVersion;
    createdAt;
    updatedAt;
};
exports.EbayCategory = EbayCategory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayCategory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_category_id', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], EbayCategory.prototype, "ebayCategoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tree_id', type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], EbayCategory.prototype, "treeId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'parent_category_id',
        type: 'varchar',
        length: 50,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayCategory.prototype, "parentCategoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_name', type: 'varchar', length: 300 }),
    __metadata("design:type", String)
], EbayCategory.prototype, "categoryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_path', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayCategory.prototype, "categoryPath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], EbayCategory.prototype, "depth", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_leaf', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], EbayCategory.prototype, "isLeaf", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'required_aspects', type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], EbayCategory.prototype, "requiredAspects", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recommended_aspects', type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], EbayCategory.prototype, "recommendedAspects", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'supports_compatibility', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], EbayCategory.prototype, "supportsCompatibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tree_version', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], EbayCategory.prototype, "treeVersion", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayCategory.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayCategory.prototype, "updatedAt", void 0);
exports.EbayCategory = EbayCategory = __decorate([
    (0, typeorm_1.Entity)('ebay_categories'),
    (0, typeorm_1.Index)('idx_ebay_cat_id_tree', ['ebayCategoryId', 'treeId'], { unique: true }),
    (0, typeorm_1.Index)('idx_ebay_cat_parent', ['parentCategoryId']),
    (0, typeorm_1.Index)('idx_ebay_cat_name', ['categoryName']),
    (0, typeorm_1.Index)('idx_ebay_cat_leaf', ['isLeaf'])
], EbayCategory);
//# sourceMappingURL=ebay-category.entity.js.map