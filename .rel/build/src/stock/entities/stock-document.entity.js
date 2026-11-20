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
exports.StockDocumentLine = exports.StockDocument = void 0;
const typeorm_1 = require("typeorm");
let StockDocument = class StockDocument {
    id;
    organizationId;
    docType;
    docNumber;
    status;
    warehouseId;
    destWarehouseId;
    supplierId;
    reasonCode;
    reference;
    note;
    expectedAt;
    currency;
    metadata;
    createdBy;
    approvedBy;
    completedBy;
    completedAt;
    createdAt;
    updatedAt;
};
exports.StockDocument = StockDocument;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StockDocument.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockDocument.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'doc_type', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], StockDocument.prototype, "docType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'doc_number', type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], StockDocument.prototype, "docNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'draft' }),
    __metadata("design:type", String)
], StockDocument.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'warehouse_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockDocument.prototype, "warehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'dest_warehouse_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "destWarehouseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'supplier_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "supplierId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reason_code', type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "reasonCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "reference", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expected_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "expectedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3, nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], StockDocument.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "completedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], StockDocument.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StockDocument.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StockDocument.prototype, "updatedAt", void 0);
exports.StockDocument = StockDocument = __decorate([
    (0, typeorm_1.Entity)('stock_documents')
], StockDocument);
let StockDocumentLine = class StockDocumentLine {
    id;
    documentId;
    inventoryItemId;
    locationId;
    destLocationId;
    unitId;
    quantity;
    processedQty;
    countedQty;
    systemQty;
    unitCost;
    serials;
    note;
    createdAt;
};
exports.StockDocumentLine = StockDocumentLine;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StockDocumentLine.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'document_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockDocumentLine.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inventory_item_id', type: 'uuid' }),
    __metadata("design:type", String)
], StockDocumentLine.prototype, "inventoryItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'location_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockDocumentLine.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'dest_location_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockDocumentLine.prototype, "destLocationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unit_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], StockDocumentLine.prototype, "unitId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockDocumentLine.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_qty', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StockDocumentLine.prototype, "processedQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'counted_qty', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], StockDocumentLine.prototype, "countedQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'system_qty', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], StockDocumentLine.prototype, "systemQty", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'unit_cost',
        type: 'numeric',
        precision: 12,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], StockDocumentLine.prototype, "unitCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], StockDocumentLine.prototype, "serials", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], StockDocumentLine.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], StockDocumentLine.prototype, "createdAt", void 0);
exports.StockDocumentLine = StockDocumentLine = __decorate([
    (0, typeorm_1.Entity)('stock_document_lines')
], StockDocumentLine);
//# sourceMappingURL=stock-document.entity.js.map