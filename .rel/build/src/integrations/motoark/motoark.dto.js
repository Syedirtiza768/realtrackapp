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
exports.MotoarkOrderEventDto = exports.MotoarkLineDto = exports.MOTOARK_EVENTS = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.MOTOARK_EVENTS = [
    'order.paid',
    'order.shipped',
    'order.cancelled',
    'return.requested',
    'return.received',
    'return.restocked',
    'return.disposed',
    'refund.completed',
];
class MotoarkLineDto {
    externalLineId;
    listingId;
    quantity;
    unitPrice;
    warehouseId;
    locationId;
    unitIds;
}
exports.MotoarkLineDto = MotoarkLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], MotoarkLineDto.prototype, "externalLineId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MotoarkLineDto.prototype, "listingId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100000),
    __metadata("design:type", Number)
], MotoarkLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^(0|[1-9]\d{0,7})\.\d{2}$/),
    __metadata("design:type", String)
], MotoarkLineDto.prototype, "unitPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MotoarkLineDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MotoarkLineDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], MotoarkLineDto.prototype, "unitIds", void 0);
class MotoarkOrderEventDto {
    schemaVersion;
    eventId;
    eventType;
    occurredAt;
    externalOrderId;
    orderVersion;
    currency;
    lines;
    returnId;
    refundId;
    amount;
    shippingAmount;
    taxAmount;
}
exports.MotoarkOrderEventDto = MotoarkOrderEventDto;
__decorate([
    (0, class_validator_1.Equals)(1),
    __metadata("design:type", Number)
], MotoarkOrderEventDto.prototype, "schemaVersion", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "eventId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.MOTOARK_EVENTS),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "eventType", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "occurredAt", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "externalOrderId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(2147483647),
    __metadata("design:type", Number)
], MotoarkOrderEventDto.prototype, "orderVersion", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^[A-Z]{3}$/),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ArrayUnique)((line) => line.externalLineId),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MotoarkLineDto),
    __metadata("design:type", Array)
], MotoarkOrderEventDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "returnId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "refundId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^(0|[1-9]\d{0,7})\.\d{2}$/),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^(0|[1-9]\d{0,7})\.\d{2}$/),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "shippingAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^(0|[1-9]\d{0,7})\.\d{2}$/),
    __metadata("design:type", String)
], MotoarkOrderEventDto.prototype, "taxAmount", void 0);
//# sourceMappingURL=motoark.dto.js.map