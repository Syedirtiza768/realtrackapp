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
exports.InventoryMovement = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../../auth/entities/organization.entity.js");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
let InventoryMovement = class InventoryMovement {
    id;
    organizationId;
    organization;
    catalogProductId;
    catalogProduct;
    movementType;
    quantityChange;
    sourceChannel;
    ebayAccountId;
    ebayAccount;
    ebayOrderId;
    notes;
    createdAt;
};
exports.InventoryMovement = InventoryMovement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InventoryMovement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], InventoryMovement.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], InventoryMovement.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], InventoryMovement.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", catalog_product_entity_js_1.CatalogProduct)
], InventoryMovement.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'movement_type', type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], InventoryMovement.prototype, "movementType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_change', type: 'int' }),
    __metadata("design:type", Number)
], InventoryMovement.prototype, "quantityChange", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_channel', type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], InventoryMovement.prototype, "sourceChannel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], InventoryMovement.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, {
        onDelete: 'SET NULL',
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", Object)
], InventoryMovement.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_order_id',
        type: 'varchar',
        length: 120,
        nullable: true,
    }),
    __metadata("design:type", Object)
], InventoryMovement.prototype, "ebayOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], InventoryMovement.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InventoryMovement.prototype, "createdAt", void 0);
exports.InventoryMovement = InventoryMovement = __decorate([
    (0, typeorm_1.Entity)('inventory_movements'),
    (0, typeorm_1.Index)('idx_inv_mov_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_inv_mov_product', ['catalogProductId'])
], InventoryMovement);
//# sourceMappingURL=inventory-movement.entity.js.map