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
exports.EbayHostedImage = void 0;
const typeorm_1 = require("typeorm");
const store_entity_js_1 = require("../../../channels/entities/store.entity.js");
let EbayHostedImage = class EbayHostedImage {
    id;
    storeId;
    store;
    sourceUrl;
    hostedUrl;
    imageId;
    expirationDate;
    createdAt;
    updatedAt;
};
exports.EbayHostedImage = EbayHostedImage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayHostedImage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayHostedImage.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => store_entity_js_1.Store, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'store_id' }),
    __metadata("design:type", store_entity_js_1.Store)
], EbayHostedImage.prototype, "store", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_url', type: 'text' }),
    __metadata("design:type", String)
], EbayHostedImage.prototype, "sourceUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hosted_url', type: 'text' }),
    __metadata("design:type", String)
], EbayHostedImage.prototype, "hostedUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], EbayHostedImage.prototype, "imageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expiration_date', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayHostedImage.prototype, "expirationDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayHostedImage.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayHostedImage.prototype, "updatedAt", void 0);
exports.EbayHostedImage = EbayHostedImage = __decorate([
    (0, typeorm_1.Entity)('ebay_hosted_images'),
    (0, typeorm_1.Index)('uq_ebay_hosted_images_store_source', ['storeId', 'sourceUrl'], {
        unique: true,
    }),
    (0, typeorm_1.Index)('idx_ebay_hosted_images_store', ['storeId'])
], EbayHostedImage);
//# sourceMappingURL=ebay-hosted-image.entity.js.map