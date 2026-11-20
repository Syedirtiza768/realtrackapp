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
exports.EnhancementQueryDto = exports.RejectEnhancementDto = exports.ApproveEnhancementDto = exports.BulkRequestEnhancementDto = exports.RequestEnhancementDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class RequestEnhancementDto {
    listingId;
    enhancementType;
    inputData;
}
exports.RequestEnhancementDto = RequestEnhancementDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RequestEnhancementDto.prototype, "listingId", void 0);
__decorate([
    (0, class_validator_1.IsIn)([
        'title_optimization',
        'description_generation',
        'item_specifics',
        'fitment_detection',
        'image_enhancement',
    ]),
    __metadata("design:type", String)
], RequestEnhancementDto.prototype, "enhancementType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RequestEnhancementDto.prototype, "inputData", void 0);
class BulkRequestEnhancementDto {
    listingIds;
    enhancementType;
}
exports.BulkRequestEnhancementDto = BulkRequestEnhancementDto;
__decorate([
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], BulkRequestEnhancementDto.prototype, "listingIds", void 0);
__decorate([
    (0, class_validator_1.IsIn)([
        'title_optimization',
        'description_generation',
        'item_specifics',
        'fitment_detection',
        'image_enhancement',
    ]),
    __metadata("design:type", String)
], BulkRequestEnhancementDto.prototype, "enhancementType", void 0);
class ApproveEnhancementDto {
    approvedBy;
}
exports.ApproveEnhancementDto = ApproveEnhancementDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ApproveEnhancementDto.prototype, "approvedBy", void 0);
class RejectEnhancementDto {
    reason;
}
exports.RejectEnhancementDto = RejectEnhancementDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RejectEnhancementDto.prototype, "reason", void 0);
class EnhancementQueryDto {
    listingId;
    enhancementType;
    status;
    limit;
    offset;
}
exports.EnhancementQueryDto = EnhancementQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EnhancementQueryDto.prototype, "listingId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnhancementQueryDto.prototype, "enhancementType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnhancementQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], EnhancementQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], EnhancementQueryDto.prototype, "offset", void 0);
//# sourceMappingURL=ai-enhancement.dto.js.map