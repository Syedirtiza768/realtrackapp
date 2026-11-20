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
exports.ClearCatalogDto = exports.BackfillListingsDto = exports.ImportRowQueryDto = exports.ImportQueryDto = exports.StartImportDto = exports.UploadCsvDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class UploadCsvDto {
    columnMapping;
}
exports.UploadCsvDto = UploadCsvDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'User-defined column mapping (csvHeader → catalogField)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UploadCsvDto.prototype, "columnMapping", void 0);
class StartImportDto {
    importId;
    columnMapping;
}
exports.StartImportDto = StartImportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Import ID returned from upload step' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], StartImportDto.prototype, "importId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Column mapping overrides' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], StartImportDto.prototype, "columnMapping", void 0);
class ImportQueryDto {
    status;
    limit;
    offset;
}
exports.ImportQueryDto = ImportQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImportQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ImportQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ImportQueryDto.prototype, "offset", void 0);
class ImportRowQueryDto {
    status;
    limit;
    offset;
}
exports.ImportRowQueryDto = ImportRowQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by row status' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImportRowQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], ImportRowQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ImportRowQueryDto.prototype, "offset", void 0);
class BackfillListingsDto {
    importId;
}
exports.BackfillListingsDto = BackfillListingsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Optional import ID to backfill only one import',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BackfillListingsDto.prototype, "importId", void 0);
class ClearCatalogDto {
    confirm;
}
exports.ClearCatalogDto = ClearCatalogDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Must be exactly DELETE_ALL_CATALOG',
        example: 'DELETE_ALL_CATALOG',
    }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Equals)('DELETE_ALL_CATALOG'),
    __metadata("design:type", String)
], ClearCatalogDto.prototype, "confirm", void 0);
//# sourceMappingURL=catalog-import.dto.js.map