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
exports.WebhookPayloadDto = exports.SyncInventoryDto = exports.BulkPublishDto = exports.PublishMultiDto = exports.PublishListingDto = exports.OAuthCallbackDto = exports.ConnectChannelDto = void 0;
const class_validator_1 = require("class-validator");
class ConnectChannelDto {
    channel;
    shopDomain;
}
exports.ConnectChannelDto = ConnectChannelDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ConnectChannelDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectChannelDto.prototype, "shopDomain", void 0);
class OAuthCallbackDto {
    code;
    state;
}
exports.OAuthCallbackDto = OAuthCallbackDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], OAuthCallbackDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], OAuthCallbackDto.prototype, "state", void 0);
class PublishListingDto {
    connectionId;
    listingId;
}
exports.PublishListingDto = PublishListingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PublishListingDto.prototype, "connectionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PublishListingDto.prototype, "listingId", void 0);
class PublishMultiDto {
    listingId;
    channels;
    overrides;
    storeId;
}
exports.PublishMultiDto = PublishMultiDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PublishMultiDto.prototype, "listingId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.ArrayMinSize)(1),
    __metadata("design:type", Array)
], PublishMultiDto.prototype, "channels", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PublishMultiDto.prototype, "overrides", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PublishMultiDto.prototype, "storeId", void 0);
class BulkPublishDto {
    listingIds;
    channels;
    storeId;
}
exports.BulkPublishDto = BulkPublishDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.ArrayMinSize)(1),
    __metadata("design:type", Array)
], BulkPublishDto.prototype, "listingIds", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.ArrayMinSize)(1),
    __metadata("design:type", Array)
], BulkPublishDto.prototype, "channels", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], BulkPublishDto.prototype, "storeId", void 0);
class SyncInventoryDto {
    connectionId;
}
exports.SyncInventoryDto = SyncInventoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SyncInventoryDto.prototype, "connectionId", void 0);
class WebhookPayloadDto {
    payload;
}
exports.WebhookPayloadDto = WebhookPayloadDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], WebhookPayloadDto.prototype, "payload", void 0);
//# sourceMappingURL=channel.dto.js.map