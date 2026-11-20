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
exports.FashionReview = void 0;
const typeorm_1 = require("typeorm");
let FashionReview = class FashionReview {
    id;
    organizationId;
    catalogProductId;
    status;
    authenticityConfirmed;
    evidenceKeys;
    reviewedByUserId;
    notes;
    reviewedAt;
    createdAt;
    updatedAt;
};
exports.FashionReview = FashionReview;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FashionReview.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionReview.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionReview.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], FashionReview.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'authenticity_confirmed', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], FashionReview.prototype, "authenticityConfirmed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'evidence_keys', type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], FashionReview.prototype, "evidenceKeys", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], FashionReview.prototype, "reviewedByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], FashionReview.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], FashionReview.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionReview.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionReview.prototype, "updatedAt", void 0);
exports.FashionReview = FashionReview = __decorate([
    (0, typeorm_1.Entity)('fashion_reviews'),
    (0, typeorm_1.Index)('idx_fashion_reviews_product', ['catalogProductId']),
    (0, typeorm_1.Index)('idx_fashion_reviews_org_status', ['organizationId', 'status'])
], FashionReview);
//# sourceMappingURL=fashion-review.entity.js.map