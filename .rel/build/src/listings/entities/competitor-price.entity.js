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
exports.CompetitorPrice = void 0;
const typeorm_1 = require("typeorm");
let CompetitorPrice = class CompetitorPrice {
    id;
    masterProductId;
    partNumber;
    ebayItemId;
    title;
    seller;
    price;
    currency;
    condition;
    quantityAvailable;
    quantitySold;
    capturedAt;
    createdAt;
};
exports.CompetitorPrice = CompetitorPrice;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CompetitorPrice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'master_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CompetitorPrice.prototype, "masterProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_number', type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], CompetitorPrice.prototype, "partNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_item_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], CompetitorPrice.prototype, "ebayItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 300, nullable: true }),
    __metadata("design:type", Object)
], CompetitorPrice.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], CompetitorPrice.prototype, "seller", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], CompetitorPrice.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3, default: 'USD' }),
    __metadata("design:type", String)
], CompetitorPrice.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], CompetitorPrice.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_available', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], CompetitorPrice.prototype, "quantityAvailable", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_sold', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], CompetitorPrice.prototype, "quantitySold", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'captured_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], CompetitorPrice.prototype, "capturedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], CompetitorPrice.prototype, "createdAt", void 0);
exports.CompetitorPrice = CompetitorPrice = __decorate([
    (0, typeorm_1.Entity)('competitor_prices'),
    (0, typeorm_1.Index)('idx_competitor_part', ['partNumber']),
    (0, typeorm_1.Index)('idx_competitor_captured', ['capturedAt']),
    (0, typeorm_1.Index)('idx_competitor_product', ['masterProductId'])
], CompetitorPrice);
//# sourceMappingURL=competitor-price.entity.js.map