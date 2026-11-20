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
exports.FashionSkuCounter = void 0;
const typeorm_1 = require("typeorm");
let FashionSkuCounter = class FashionSkuCounter {
    organizationId;
    batch;
    lastValue;
    updatedAt;
};
exports.FashionSkuCounter = FashionSkuCounter;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], FashionSkuCounter.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], FashionSkuCounter.prototype, "batch", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_value', type: 'integer' }),
    __metadata("design:type", Number)
], FashionSkuCounter.prototype, "lastValue", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FashionSkuCounter.prototype, "updatedAt", void 0);
exports.FashionSkuCounter = FashionSkuCounter = __decorate([
    (0, typeorm_1.Entity)('fashion_sku_counters')
], FashionSkuCounter);
//# sourceMappingURL=fashion-sku-counter.entity.js.map