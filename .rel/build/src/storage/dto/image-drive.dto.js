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
exports.BulkDeleteFilesDto = exports.AutoCreateUploadDto = exports.SearchDriveDto = exports.ListFilesDto = exports.ImageDriveBatchLookupDto = exports.UploadToFolderDto = exports.UpdateFolderDto = exports.CreateFolderDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class CreateFolderDto {
    name;
    linkedPartNumber;
}
exports.CreateFolderDto = CreateFolderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFolderDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFolderDto.prototype, "linkedPartNumber", void 0);
class UpdateFolderDto {
    name;
    linkedPartNumber;
}
exports.UpdateFolderDto = UpdateFolderDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateFolderDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateFolderDto.prototype, "linkedPartNumber", void 0);
class UploadToFolderDto {
    partNumber;
}
exports.UploadToFolderDto = UploadToFolderDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UploadToFolderDto.prototype, "partNumber", void 0);
class ImageDriveBatchLookupDto {
    partNumbers;
}
exports.ImageDriveBatchLookupDto = ImageDriveBatchLookupDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ImageDriveBatchLookupDto.prototype, "partNumbers", void 0);
class ListFilesDto {
    page;
    limit;
}
exports.ListFilesDto = ListFilesDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], ListFilesDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], ListFilesDto.prototype, "limit", void 0);
class SearchDriveDto {
    q;
    page;
    limit;
}
exports.SearchDriveDto = SearchDriveDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SearchDriveDto.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], SearchDriveDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], SearchDriveDto.prototype, "limit", void 0);
class AutoCreateUploadDto {
    folderName;
    partNumber;
}
exports.AutoCreateUploadDto = AutoCreateUploadDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutoCreateUploadDto.prototype, "folderName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutoCreateUploadDto.prototype, "partNumber", void 0);
class BulkDeleteFilesDto {
    fileIds;
}
exports.BulkDeleteFilesDto = BulkDeleteFilesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BulkDeleteFilesDto.prototype, "fileIds", void 0);
//# sourceMappingURL=image-drive.dto.js.map