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
exports.BusinessIndustrialUnit = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
let BusinessIndustrialUnit = class BusinessIndustrialUnit {
    id;
    organizationId;
    organization;
    catalogProductId;
    catalogProduct;
    serialNumberPrivate;
    serialNumberPublic;
    status;
    allocatedStoreId;
    allocatedOfferId;
    createdAt;
    updatedAt;
};
exports.BusinessIndustrialUnit = BusinessIndustrialUnit;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BusinessIndustrialUnit.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialUnit.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], BusinessIndustrialUnit.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialUnit.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", catalog_product_entity_js_1.CatalogProduct)
], BusinessIndustrialUnit.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'serial_number_private', type: 'text' }),
    __metadata("design:type", String)
], BusinessIndustrialUnit.prototype, "serialNumberPrivate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'serial_number_public', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialUnit.prototype, "serialNumberPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'available' }),
    __metadata("design:type", String)
], BusinessIndustrialUnit.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allocated_store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialUnit.prototype, "allocatedStoreId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'allocated_offer_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], BusinessIndustrialUnit.prototype, "allocatedOfferId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialUnit.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialUnit.prototype, "updatedAt", void 0);
exports.BusinessIndustrialUnit = BusinessIndustrialUnit = __decorate([
    (0, typeorm_1.Entity)('business_industrial_units'),
    (0, typeorm_1.Unique)('uq_bi_unit_private_serial', ['organizationId', 'serialNumberPrivate']),
    (0, typeorm_1.Unique)('uq_bi_unit_public_serial', ['organizationId', 'serialNumberPublic']),
    (0, typeorm_1.Index)('idx_bi_unit_product_status', ['catalogProductId', 'status'])
], BusinessIndustrialUnit);
//# sourceMappingURL=business-industrial-unit.entity.js.map