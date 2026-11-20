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
exports.SalesRecord = void 0;
const typeorm_1 = require("typeorm");
let SalesRecord = class SalesRecord {
    id;
    orderId;
    listingId;
    channel;
    storeId;
    quantitySold;
    salePrice;
    currency;
    marketplaceFee;
    netRevenue;
    soldAt;
};
exports.SalesRecord = SalesRecord;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SalesRecord.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SalesRecord.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    (0, typeorm_1.Index)('idx_sales_listing'),
    __metadata("design:type", String)
], SalesRecord.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    (0, typeorm_1.Index)('idx_sales_channel'),
    __metadata("design:type", String)
], SalesRecord.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SalesRecord.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], SalesRecord.prototype, "quantitySold", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 2 }),
    __metadata("design:type", String)
], SalesRecord.prototype, "salePrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 3, default: 'USD' }),
    __metadata("design:type", String)
], SalesRecord.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], SalesRecord.prototype, "marketplaceFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], SalesRecord.prototype, "netRevenue", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    (0, typeorm_1.Index)('idx_sales_date'),
    __metadata("design:type", Date)
], SalesRecord.prototype, "soldAt", void 0);
exports.SalesRecord = SalesRecord = __decorate([
    (0, typeorm_1.Entity)({ name: 'sales_records' })
], SalesRecord);
//# sourceMappingURL=sales-record.entity.js.map