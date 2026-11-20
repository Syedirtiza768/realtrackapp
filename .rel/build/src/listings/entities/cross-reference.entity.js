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
exports.CrossReference = void 0;
const typeorm_1 = require("typeorm");
const master_product_entity_js_1 = require("./master-product.entity.js");
let CrossReference = class CrossReference {
    id;
    masterProductId;
    masterProduct;
    partNumber;
    brand;
    referenceType;
    notes;
    source;
    createdAt;
};
exports.CrossReference = CrossReference;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CrossReference.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'master_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], CrossReference.prototype, "masterProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => master_product_entity_js_1.MasterProduct, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'master_product_id' }),
    __metadata("design:type", master_product_entity_js_1.MasterProduct)
], CrossReference.prototype, "masterProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_number', type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], CrossReference.prototype, "partNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], CrossReference.prototype, "brand", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reference_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], CrossReference.prototype, "referenceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CrossReference.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'manual' }),
    __metadata("design:type", String)
], CrossReference.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], CrossReference.prototype, "createdAt", void 0);
exports.CrossReference = CrossReference = __decorate([
    (0, typeorm_1.Entity)('cross_references'),
    (0, typeorm_1.Index)('idx_xref_product', ['masterProductId']),
    (0, typeorm_1.Index)('idx_xref_part_number', ['partNumber']),
    (0, typeorm_1.Index)('idx_xref_type', ['referenceType']),
    (0, typeorm_1.Index)('idx_xref_brand_part', ['brand', 'partNumber'])
], CrossReference);
//# sourceMappingURL=cross-reference.entity.js.map