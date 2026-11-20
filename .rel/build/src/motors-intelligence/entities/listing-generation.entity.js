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
exports.ListingGeneration = exports.ListingGenerationStatus = void 0;
const typeorm_1 = require("typeorm");
var ListingGenerationStatus;
(function (ListingGenerationStatus) {
    ListingGenerationStatus["PENDING"] = "pending";
    ListingGenerationStatus["GENERATING"] = "generating";
    ListingGenerationStatus["GENERATED"] = "generated";
    ListingGenerationStatus["APPROVED"] = "approved";
    ListingGenerationStatus["REJECTED"] = "rejected";
    ListingGenerationStatus["FAILED"] = "failed";
})(ListingGenerationStatus || (exports.ListingGenerationStatus = ListingGenerationStatus = {}));
let ListingGeneration = class ListingGeneration {
    id;
    motorsProductId;
    version;
    status;
    inputContract;
    generatedTitle;
    generatedItemSpecifics;
    generatedBulletFeatures;
    generatedHtmlDescription;
    keywordRationale;
    searchTags;
    templateId;
    templateName;
    aiProvider;
    aiModel;
    aiRawResponse;
    tokensUsed;
    latencyMs;
    costUsd;
    titleQualityScore;
    descriptionQualityScore;
    overallQualityScore;
    createdAt;
};
exports.ListingGeneration = ListingGeneration;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ListingGeneration.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], ListingGeneration.prototype, "motorsProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], ListingGeneration.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ListingGenerationStatus,
        default: ListingGenerationStatus.PENDING,
    }),
    __metadata("design:type", String)
], ListingGeneration.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "inputContract", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "generatedTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "generatedItemSpecifics", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "generatedBulletFeatures", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "generatedHtmlDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "keywordRationale", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "searchTags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "templateName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "aiProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "aiModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "aiRawResponse", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "tokensUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "latencyMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "costUsd", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "titleQualityScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "descriptionQualityScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], ListingGeneration.prototype, "overallQualityScore", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ListingGeneration.prototype, "createdAt", void 0);
exports.ListingGeneration = ListingGeneration = __decorate([
    (0, typeorm_1.Entity)('listing_generations'),
    (0, typeorm_1.Index)('idx_listing_gen_motors', ['motorsProductId']),
    (0, typeorm_1.Index)('idx_listing_gen_status', ['status'])
], ListingGeneration);
//# sourceMappingURL=listing-generation.entity.js.map