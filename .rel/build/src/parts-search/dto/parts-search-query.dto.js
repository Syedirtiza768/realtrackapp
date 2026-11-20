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
exports.PartsSearchSuggestDto = exports.PartsSearchQueryDto = exports.PARTS_SEARCH_MAX_PAGE = exports.PARTS_SEARCH_MAX_QUERY_LENGTH = exports.PARTS_SEARCH_PAGE_SIZES = exports.PARTS_SEARCH_SORTS = void 0;
exports.toUpstreamParams = toUpstreamParams;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.PARTS_SEARCH_SORTS = [
    'relevance',
    'price_asc',
    'price_desc',
    'newest',
    'best_condition',
];
exports.PARTS_SEARCH_PAGE_SIZES = [24, 48, 72];
exports.PARTS_SEARCH_MAX_QUERY_LENGTH = 200;
exports.PARTS_SEARCH_MAX_PAGE = 400;
const MAX_LIST_ITEMS = 25;
function toStringArray(value) {
    if (value == null || value === '')
        return undefined;
    const list = Array.isArray(value) ? value : String(value).split(',');
    const out = [];
    const seen = new Set();
    for (const raw of list) {
        const item = String(raw ?? '').trim().slice(0, 120);
        if (item && !seen.has(item)) {
            seen.add(item);
            out.push(item);
        }
        if (out.length >= MAX_LIST_ITEMS)
            break;
    }
    return out.length ? out : undefined;
}
function toBool(value) {
    if (value == null || value === '')
        return undefined;
    if (typeof value === 'boolean')
        return value;
    const text = String(value).toLowerCase();
    if (text === 'true' || text === '1')
        return true;
    if (text === 'false' || text === '0')
        return false;
    return undefined;
}
const LIST_FIELDS = [
    'category',
    'brand',
    'make',
    'model',
    'partType',
    'condition',
    'seller',
    'sourceTag',
];
class PartsSearchQueryDto {
    q;
    category;
    brand;
    make;
    model;
    partType;
    condition;
    seller;
    sourceTag;
    year;
    priceMin;
    priceMax;
    hasImage;
    inStock;
    includeInterchange;
    sort;
    page;
    pageSize;
}
exports.PartsSearchQueryDto = PartsSearchQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: exports.PARTS_SEARCH_MAX_QUERY_LENGTH }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(exports.PARTS_SEARCH_MAX_QUERY_LENGTH),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    __metadata("design:type", String)
], PartsSearchQueryDto.prototype, "q", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Transform)(({ value }) => toStringArray(value)),
    __metadata("design:type", Array)
], PartsSearchQueryDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Transform)(({ value }) => toStringArray(value)),
    __metadata("design:type", Array)
], PartsSearchQueryDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Transform)(({ value }) => toStringArray(value)),
    __metadata("design:type", Array)
], PartsSearchQueryDto.prototype, "make", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Transform)(({ value }) => toStringArray(value)),
    __metadata("design:type", Array)
], PartsSearchQueryDto.prototype, "model", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Transform)(({ value }) => toStringArray(value)),
    __metadata("design:type", Array)
], PartsSearchQueryDto.prototype, "partType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Transform)(({ value }) => toStringArray(value)),
    __metadata("design:type", Array)
], PartsSearchQueryDto.prototype, "condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Transform)(({ value }) => toStringArray(value)),
    __metadata("design:type", Array)
], PartsSearchQueryDto.prototype, "seller", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Transform)(({ value }) => toStringArray(value)),
    __metadata("design:type", Array)
], PartsSearchQueryDto.prototype, "sourceTag", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1950),
    (0, class_validator_1.Max)(2049),
    __metadata("design:type", Number)
], PartsSearchQueryDto.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PartsSearchQueryDto.prototype, "priceMin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PartsSearchQueryDto.prototype, "priceMax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toBool(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PartsSearchQueryDto.prototype, "hasImage", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toBool(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PartsSearchQueryDto.prototype, "inStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toBool(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PartsSearchQueryDto.prototype, "includeInterchange", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.PARTS_SEARCH_SORTS }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PARTS_SEARCH_SORTS),
    __metadata("design:type", Object)
], PartsSearchQueryDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: exports.PARTS_SEARCH_MAX_PAGE }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(exports.PARTS_SEARCH_MAX_PAGE),
    __metadata("design:type", Number)
], PartsSearchQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.PARTS_SEARCH_PAGE_SIZES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsIn)(exports.PARTS_SEARCH_PAGE_SIZES),
    __metadata("design:type", Number)
], PartsSearchQueryDto.prototype, "pageSize", void 0);
class PartsSearchSuggestDto {
    q;
}
exports.PartsSearchSuggestDto = PartsSearchSuggestDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: exports.PARTS_SEARCH_MAX_QUERY_LENGTH }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(exports.PARTS_SEARCH_MAX_QUERY_LENGTH),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    __metadata("design:type", String)
], PartsSearchSuggestDto.prototype, "q", void 0);
function toUpstreamParams(dto, audience) {
    const params = [];
    if (dto.q)
        params.push(['q', dto.q]);
    for (const field of LIST_FIELDS) {
        if (audience === 'public' && (field === 'seller' || field === 'sourceTag'))
            continue;
        for (const value of dto[field] ?? [])
            params.push([field, value]);
    }
    const scalars = [
        'year',
        'priceMin',
        'priceMax',
        'hasImage',
        'inStock',
        'includeInterchange',
        'sort',
        'page',
        'pageSize',
    ];
    for (const key of scalars) {
        const value = dto[key];
        if (value !== undefined && value !== null)
            params.push([key, String(value)]);
    }
    return params;
}
//# sourceMappingURL=parts-search-query.dto.js.map