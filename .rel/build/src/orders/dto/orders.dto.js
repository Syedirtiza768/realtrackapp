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
exports.ManualImportDto = exports.CsvTrackingUploadDto = exports.BulkCancelDto = exports.BulkShipDto = exports.BulkShipItemDto = exports.RefundDto = exports.UpdateShippingDto = exports.UpdateOrderStatusDto = exports.OrdersQueryDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class OrdersQueryDto {
    status;
    channel;
    storeId;
    since;
    until;
    search;
    limit;
    offset;
}
exports.OrdersQueryDto = OrdersQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrdersQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrdersQueryDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrdersQueryDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrdersQueryDto.prototype, "since", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrdersQueryDto.prototype, "until", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrdersQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], OrdersQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], OrdersQueryDto.prototype, "offset", void 0);
class UpdateOrderStatusDto {
    status;
    reason;
}
exports.UpdateOrderStatusDto = UpdateOrderStatusDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "reason", void 0);
class UpdateShippingDto {
    trackingNumber;
    trackingCarrier;
    shippingMethod;
}
exports.UpdateShippingDto = UpdateShippingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateShippingDto.prototype, "trackingNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateShippingDto.prototype, "trackingCarrier", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateShippingDto.prototype, "shippingMethod", void 0);
class RefundDto {
    amount;
    reason;
}
exports.RefundDto = RefundDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RefundDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RefundDto.prototype, "reason", void 0);
class BulkShipItemDto {
    orderId;
    trackingNumber;
    carrier;
}
exports.BulkShipItemDto = BulkShipItemDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], BulkShipItemDto.prototype, "orderId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkShipItemDto.prototype, "trackingNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkShipItemDto.prototype, "carrier", void 0);
class BulkShipDto {
    items;
}
exports.BulkShipDto = BulkShipDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BulkShipItemDto),
    __metadata("design:type", Array)
], BulkShipDto.prototype, "items", void 0);
class BulkCancelDto {
    orderIds;
    reason;
}
exports.BulkCancelDto = BulkCancelDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], BulkCancelDto.prototype, "orderIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkCancelDto.prototype, "reason", void 0);
class CsvTrackingUploadDto {
    csvContent;
}
exports.CsvTrackingUploadDto = CsvTrackingUploadDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CsvTrackingUploadDto.prototype, "csvContent", void 0);
class ManualImportDto {
    storeId;
}
exports.ManualImportDto = ManualImportDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ManualImportDto.prototype, "storeId", void 0);
//# sourceMappingURL=orders.dto.js.map