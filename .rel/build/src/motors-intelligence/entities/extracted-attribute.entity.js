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
exports.ExtractedAttribute = exports.ExtractionSource = void 0;
const typeorm_1 = require("typeorm");
var ExtractionSource;
(function (ExtractionSource) {
    ExtractionSource["OCR"] = "ocr";
    ExtractionSource["VISION_AI"] = "vision_ai";
    ExtractionSource["REGEX"] = "regex";
    ExtractionSource["SUPPLIER_DATA"] = "supplier_data";
    ExtractionSource["CATALOG_LOOKUP"] = "catalog_lookup";
    ExtractionSource["MANUAL"] = "manual";
})(ExtractionSource || (exports.ExtractionSource = ExtractionSource = {}));
let ExtractedAttribute = class ExtractedAttribute {
    id;
    motorsProductId;
    extractionSource;
    imageAssetId;
    rawOcrText;
    rawModelOutput;
    extractedBrand;
    extractedMpn;
    extractedOemNumber;
    extractedProductType;
    extractedProductFamily;
    extractedPlacement;
    extractedMaterial;
    extractedFinish;
    extractedCondition;
    extractedQuantity;
    extractedSideOrientation;
    extractedFrontRear;
    extractedDimensions;
    extractedFeatures;
    extractedFitmentRaw;
    visibleTextLines;
    packagingIdentifiers;
    confidenceScores;
    normalizedOutput;
    approvedOutput;
    aiProvider;
    aiModel;
    tokensUsed;
    latencyMs;
    costUsd;
    createdAt;
};
exports.ExtractedAttribute = ExtractedAttribute;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ExtractedAttribute.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], ExtractedAttribute.prototype, "motorsProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ExtractionSource }),
    __metadata("design:type", String)
], ExtractedAttribute.prototype, "extractionSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "imageAssetId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "rawOcrText", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "rawModelOutput", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedBrand", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedMpn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedOemNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedProductType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedProductFamily", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedPlacement", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedMaterial", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedFinish", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedCondition", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedSideOrientation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedFrontRear", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedDimensions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedFeatures", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "extractedFitmentRaw", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "visibleTextLines", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "packagingIdentifiers", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "confidenceScores", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "normalizedOutput", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "approvedOutput", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "aiProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "aiModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "tokensUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "latencyMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], ExtractedAttribute.prototype, "costUsd", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ExtractedAttribute.prototype, "createdAt", void 0);
exports.ExtractedAttribute = ExtractedAttribute = __decorate([
    (0, typeorm_1.Entity)('extracted_attributes'),
    (0, typeorm_1.Index)('idx_extracted_attr_motors', ['motorsProductId']),
    (0, typeorm_1.Index)('idx_extracted_attr_source', ['extractionSource'])
], ExtractedAttribute);
//# sourceMappingURL=extracted-attribute.entity.js.map