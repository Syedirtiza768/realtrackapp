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
exports.MarketSnapshot = void 0;
const typeorm_1 = require("typeorm");
let MarketSnapshot = class MarketSnapshot {
    id;
    masterProductId;
    partNumber;
    totalListings;
    avgPrice;
    medianPrice;
    minPrice;
    maxPrice;
    recommendedPricing;
    marketInsights;
    confidence;
    aiCostUsd;
    capturedAt;
    createdAt;
};
exports.MarketSnapshot = MarketSnapshot;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MarketSnapshot.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'master_product_id', type: 'uuid' }),
    __metadata("design:type", String)
], MarketSnapshot.prototype, "masterProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_number', type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], MarketSnapshot.prototype, "partNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_listings', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], MarketSnapshot.prototype, "totalListings", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'avg_price',
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MarketSnapshot.prototype, "avgPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'median_price',
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MarketSnapshot.prototype, "medianPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'min_price',
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MarketSnapshot.prototype, "minPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'max_price',
        type: 'numeric',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MarketSnapshot.prototype, "maxPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recommended_pricing', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], MarketSnapshot.prototype, "recommendedPricing", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'market_insights', type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], MarketSnapshot.prototype, "marketInsights", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 3, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], MarketSnapshot.prototype, "confidence", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ai_cost_usd',
        type: 'numeric',
        precision: 8,
        scale: 4,
        nullable: true,
    }),
    __metadata("design:type", Object)
], MarketSnapshot.prototype, "aiCostUsd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'captured_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], MarketSnapshot.prototype, "capturedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], MarketSnapshot.prototype, "createdAt", void 0);
exports.MarketSnapshot = MarketSnapshot = __decorate([
    (0, typeorm_1.Entity)('market_snapshots'),
    (0, typeorm_1.Index)('idx_market_snapshot_product', ['masterProductId']),
    (0, typeorm_1.Index)('idx_market_snapshot_captured', ['capturedAt'])
], MarketSnapshot);
//# sourceMappingURL=market-snapshot.entity.js.map