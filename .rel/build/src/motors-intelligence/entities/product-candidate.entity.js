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
exports.ProductCandidate = exports.CandidateStatus = void 0;
const typeorm_1 = require("typeorm");
var CandidateStatus;
(function (CandidateStatus) {
    CandidateStatus["PENDING"] = "pending";
    CandidateStatus["SELECTED"] = "selected";
    CandidateStatus["REJECTED"] = "rejected";
    CandidateStatus["MERGED"] = "merged";
})(CandidateStatus || (exports.CandidateStatus = CandidateStatus = {}));
let ProductCandidate = class ProductCandidate {
    id;
    motorsProductId;
    status;
    rank;
    brand;
    mpn;
    mpnNormalized;
    oemPartNumber;
    productType;
    productFamily;
    placement;
    condition;
    source;
    sourceReference;
    exactMpnScore;
    brandMatchScore;
    ocrMpnScore;
    visualFamilyScore;
    dimensionMatchScore;
    supplierDescSimilarityScore;
    fitmentConsistencyScore;
    compositeScore;
    candidateData;
    scoringBreakdown;
    rejectionReason;
    createdAt;
};
exports.ProductCandidate = ProductCandidate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ProductCandidate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], ProductCandidate.prototype, "motorsProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: CandidateStatus,
        default: CandidateStatus.PENDING,
    }),
    __metadata("design:type", String)
], ProductCandidate.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ProductCandidate.prototype, "rank", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "brand", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "mpn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "mpnNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "oemPartNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "productType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "productFamily", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "placement", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ProductCandidate.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "sourceReference", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], ProductCandidate.prototype, "exactMpnScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], ProductCandidate.prototype, "brandMatchScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], ProductCandidate.prototype, "ocrMpnScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], ProductCandidate.prototype, "visualFamilyScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], ProductCandidate.prototype, "dimensionMatchScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], ProductCandidate.prototype, "supplierDescSimilarityScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], ProductCandidate.prototype, "fitmentConsistencyScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], ProductCandidate.prototype, "compositeScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "candidateData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "scoringBreakdown", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ProductCandidate.prototype, "rejectionReason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ProductCandidate.prototype, "createdAt", void 0);
exports.ProductCandidate = ProductCandidate = __decorate([
    (0, typeorm_1.Entity)('product_candidates'),
    (0, typeorm_1.Index)('idx_product_candidate_motors', ['motorsProductId']),
    (0, typeorm_1.Index)('idx_product_candidate_status', ['status']),
    (0, typeorm_1.Index)('idx_product_candidate_mpn', ['mpnNormalized'])
], ProductCandidate);
//# sourceMappingURL=product-candidate.entity.js.map