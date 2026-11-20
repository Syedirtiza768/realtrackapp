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
exports.CatalogImport = void 0;
const typeorm_1 = require("typeorm");
let CatalogImport = class CatalogImport {
    id;
    fileName;
    filePath;
    fileSizeBytes;
    mimeType;
    detectedHeaders;
    columnMapping;
    organizationId;
    vertical;
    status;
    totalRows;
    processedRows;
    insertedRows;
    updatedRows;
    skippedDuplicates;
    flaggedForReview;
    invalidRows;
    errorMessage;
    warnings;
    lastProcessedRow;
    createdBy;
    startedAt;
    completedAt;
    createdAt;
    updatedAt;
};
exports.CatalogImport = CatalogImport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CatalogImport.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_name', type: 'text' }),
    __metadata("design:type", String)
], CatalogImport.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_path', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "filePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_size_bytes', type: 'bigint', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "fileSizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'detected_headers',
        type: 'text',
        array: true,
        default: '{}',
    }),
    __metadata("design:type", Array)
], CatalogImport.prototype, "detectedHeaders", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'column_mapping', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "columnMapping", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "vertical", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], CatalogImport.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_rows', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CatalogImport.prototype, "totalRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_rows', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CatalogImport.prototype, "processedRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inserted_rows', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CatalogImport.prototype, "insertedRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_rows', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CatalogImport.prototype, "updatedRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'skipped_duplicates', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CatalogImport.prototype, "skippedDuplicates", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'flagged_for_review', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CatalogImport.prototype, "flaggedForReview", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invalid_rows', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CatalogImport.prototype, "invalidRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "warnings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_processed_row', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CatalogImport.prototype, "lastProcessedRow", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CatalogImport.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], CatalogImport.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], CatalogImport.prototype, "updatedAt", void 0);
exports.CatalogImport = CatalogImport = __decorate([
    (0, typeorm_1.Entity)('catalog_imports'),
    (0, typeorm_1.Index)('idx_catalog_import_status', ['status'])
], CatalogImport);
//# sourceMappingURL=catalog-import.entity.js.map