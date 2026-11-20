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
exports.ValidateEbayMvlBatchDto = exports.ImportEbayMvlFileDto = exports.ImportEbayMvlDirectoryDto = void 0;
const class_validator_1 = require("class-validator");
class ImportEbayMvlDirectoryDto {
    directory;
    force;
}
exports.ImportEbayMvlDirectoryDto = ImportEbayMvlDirectoryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImportEbayMvlDirectoryDto.prototype, "directory", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ImportEbayMvlDirectoryDto.prototype, "force", void 0);
class ImportEbayMvlFileDto {
    filePath;
    marketplace;
    force;
}
exports.ImportEbayMvlFileDto = ImportEbayMvlFileDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImportEbayMvlFileDto.prototype, "filePath", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImportEbayMvlFileDto.prototype, "marketplace", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ImportEbayMvlFileDto.prototype, "force", void 0);
class ValidateEbayMvlBatchDto {
    marketplace;
    rows;
}
exports.ValidateEbayMvlBatchDto = ValidateEbayMvlBatchDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ValidateEbayMvlBatchDto.prototype, "marketplace", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], ValidateEbayMvlBatchDto.prototype, "rows", void 0);
//# sourceMappingURL=ebay-mvl-import.dto.js.map