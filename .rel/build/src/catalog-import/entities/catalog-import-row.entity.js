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
exports.CatalogImportRow = void 0;
const typeorm_1 = require("typeorm");
const catalog_import_entity_js_1 = require("./catalog-import.entity.js");
const catalog_product_entity_js_1 = require("./catalog-product.entity.js");
let CatalogImportRow = class CatalogImportRow {
    id;
    importId;
    import;
    rowNumber;
    status;
    matchStrategy;
    matchedProductId;
    matchedProduct;
    createdProductId;
    message;
    rawData;
    createdAt;
};
exports.CatalogImportRow = CatalogImportRow;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CatalogImportRow.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'import_id', type: 'uuid' }),
    __metadata("design:type", String)
], CatalogImportRow.prototype, "importId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_import_entity_js_1.CatalogImport, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'import_id' }),
    __metadata("design:type", catalog_import_entity_js_1.CatalogImport)
], CatalogImportRow.prototype, "import", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'row_number', type: 'int' }),
    __metadata("design:type", Number)
], CatalogImportRow.prototype, "rowNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], CatalogImportRow.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'match_strategy', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogImportRow.prototype, "matchStrategy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'matched_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CatalogImportRow.prototype, "matchedProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'matched_product_id' }),
    __metadata("design:type", catalog_product_entity_js_1.CatalogProduct)
], CatalogImportRow.prototype, "matchedProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CatalogImportRow.prototype, "createdProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogImportRow.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'raw_data', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CatalogImportRow.prototype, "rawData", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], CatalogImportRow.prototype, "createdAt", void 0);
exports.CatalogImportRow = CatalogImportRow = __decorate([
    (0, typeorm_1.Entity)('catalog_import_rows'),
    (0, typeorm_1.Index)('idx_import_row_import_id', ['importId']),
    (0, typeorm_1.Index)('idx_import_row_status', ['status'])
], CatalogImportRow);
//# sourceMappingURL=catalog-import-row.entity.js.map