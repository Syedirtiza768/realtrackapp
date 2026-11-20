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
exports.InventorySendToCatalogDto = exports.InventoryInlineEnrichDto = exports.UpdateDonorVehicleDto = exports.ReorderImagesDto = exports.UpdateListingImagesDto = exports.InventoryEnrichDto = exports.InventoryBulkPartLookupDto = exports.InventoryPartLookupDto = exports.InventoryListingsQueryDto = exports.INVENTORY_SORT_MODES = exports.INVENTORY_SORT_COLUMNS = exports.STOCK_LEVELS = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
exports.STOCK_LEVELS = ['in_stock', 'low_stock', 'out_of_stock'];
exports.INVENTORY_SORT_COLUMNS = [
    'image',
    'sku',
    'brand',
    'location',
    'team',
    'fitments',
    'validation',
    'price',
    'status',
    'enrichment',
    'catalog',
];
exports.INVENTORY_SORT_MODES = exports.INVENTORY_SORT_COLUMNS.flatMap((c) => [
    `${c}_asc`,
    `${c}_desc`,
]);
class InventoryListingsQueryDto {
    page = 1;
    limit = 25;
    status;
    search;
    missingImages;
    dateAddedFrom;
    dateAddedTo;
    brand;
    make;
    model;
    category;
    brands;
    conditions;
    teamIds;
    locations;
    marketplaces;
    stockLevel;
    minPrice;
    maxPrice;
    minWeight;
    maxWeight;
    hasPrice;
    sort;
}
exports.InventoryListingsQueryDto = InventoryListingsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], InventoryListingsQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], InventoryListingsQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], InventoryListingsQueryDto.prototype, "missingImages", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "dateAddedFrom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "dateAddedTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "brand", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "make", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "model", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "brands", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "conditions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "teamIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "locations", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "marketplaces", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "stockLevel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], InventoryListingsQueryDto.prototype, "minPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], InventoryListingsQueryDto.prototype, "maxPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], InventoryListingsQueryDto.prototype, "minWeight", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], InventoryListingsQueryDto.prototype, "maxWeight", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['1']),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "hasPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.INVENTORY_SORT_MODES),
    __metadata("design:type", String)
], InventoryListingsQueryDto.prototype, "sort", void 0);
class InventoryPartLookupDto {
    listingId;
}
exports.InventoryPartLookupDto = InventoryPartLookupDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], InventoryPartLookupDto.prototype, "listingId", void 0);
class InventoryBulkPartLookupDto {
    listingIds;
}
exports.InventoryBulkPartLookupDto = InventoryBulkPartLookupDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], InventoryBulkPartLookupDto.prototype, "listingIds", void 0);
class InventoryEnrichDto {
    listingIds;
}
exports.InventoryEnrichDto = InventoryEnrichDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], InventoryEnrichDto.prototype, "listingIds", void 0);
class UpdateListingImagesDto {
    imageUrls;
    uploadedAssetIds;
}
exports.UpdateListingImagesDto = UpdateListingImagesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateListingImagesDto.prototype, "imageUrls", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], UpdateListingImagesDto.prototype, "uploadedAssetIds", void 0);
class ReorderImagesDto {
    imageUrls;
}
exports.ReorderImagesDto = ReorderImagesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ReorderImagesDto.prototype, "imageUrls", void 0);
class UpdateDonorVehicleDto {
    donorVin;
    donorYear;
    donorMake;
    donorModel;
}
exports.UpdateDonorVehicleDto = UpdateDonorVehicleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateDonorVehicleDto.prototype, "donorVin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateDonorVehicleDto.prototype, "donorYear", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateDonorVehicleDto.prototype, "donorMake", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateDonorVehicleDto.prototype, "donorModel", void 0);
class InventoryInlineEnrichDto {
    listingId;
    force;
}
exports.InventoryInlineEnrichDto = InventoryInlineEnrichDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], InventoryInlineEnrichDto.prototype, "listingId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], InventoryInlineEnrichDto.prototype, "force", void 0);
class InventorySendToCatalogDto {
    listingIds;
}
exports.InventorySendToCatalogDto = InventorySendToCatalogDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], InventorySendToCatalogDto.prototype, "listingIds", void 0);
//# sourceMappingURL=inventory-workbench.dto.js.map