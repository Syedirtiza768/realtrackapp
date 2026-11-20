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
exports.PartsSearchDemandQueryDto = exports.PartsSearchRequestStatusDto = exports.PartsSearchRequestDto = exports.PartsSearchSelectDto = exports.PartsSearchOptionsDto = exports.OPTIONS_DROPPABLE = void 0;
exports.toOptionsParams = toOptionsParams;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.OPTIONS_DROPPABLE = ['number', 'make', 'model', 'year', 'side', 'position'];
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
function toList(value) {
    if (value == null || value === '')
        return undefined;
    const list = (Array.isArray(value) ? value : String(value).split(','))
        .map((item) => String(item).trim())
        .filter(Boolean);
    return list.length ? [...new Set(list)].slice(0, 10) : undefined;
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
class PartsSearchOptionsDto {
    q;
    vehicleConfigId;
    makeId;
    modelId;
    make;
    model;
    year;
    engineLitres;
    drop;
    includeUnavailable;
    page;
    pageSize;
}
exports.PartsSearchOptionsDto = PartsSearchOptionsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    __metadata("design:type", String)
], PartsSearchOptionsDto.prototype, "q", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ID_RE),
    __metadata("design:type", String)
], PartsSearchOptionsDto.prototype, "vehicleConfigId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ID_RE),
    __metadata("design:type", String)
], PartsSearchOptionsDto.prototype, "makeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ID_RE),
    __metadata("design:type", String)
], PartsSearchOptionsDto.prototype, "modelId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], PartsSearchOptionsDto.prototype, "make", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], PartsSearchOptionsDto.prototype, "model", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1950),
    (0, class_validator_1.Max)(2049),
    __metadata("design:type", Number)
], PartsSearchOptionsDto.prototype, "year", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.5),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], PartsSearchOptionsDto.prototype, "engineLitres", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.OPTIONS_DROPPABLE, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)(exports.OPTIONS_DROPPABLE, { each: true }),
    (0, class_transformer_1.Transform)(({ value }) => toList(value)),
    __metadata("design:type", Array)
], PartsSearchOptionsDto.prototype, "drop", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toBool(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PartsSearchOptionsDto.prototype, "includeUnavailable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], PartsSearchOptionsDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: [24, 48, 72] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsIn)([24, 48, 72]),
    __metadata("design:type", Number)
], PartsSearchOptionsDto.prototype, "pageSize", void 0);
class PartsSearchSelectDto {
    query;
    partId;
    requestRef;
    action;
}
exports.PartsSearchSelectDto = PartsSearchSelectDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], PartsSearchSelectDto.prototype, "query", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ID_RE),
    __metadata("design:type", String)
], PartsSearchSelectDto.prototype, "partId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], PartsSearchSelectDto.prototype, "requestRef", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['open', 'copy', 'external', 'quote']),
    __metadata("design:type", String)
], PartsSearchSelectDto.prototype, "action", void 0);
class PartsSearchRequestDto {
    query;
    numbers;
    vehicle;
    partId;
    note;
}
exports.PartsSearchRequestDto = PartsSearchRequestDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], PartsSearchRequestDto.prototype, "query", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(60, { each: true }),
    __metadata("design:type", Array)
], PartsSearchRequestDto.prototype, "numbers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PartsSearchRequestDto.prototype, "vehicle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ID_RE),
    __metadata("design:type", String)
], PartsSearchRequestDto.prototype, "partId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], PartsSearchRequestDto.prototype, "note", void 0);
class PartsSearchRequestStatusDto {
    status;
}
exports.PartsSearchRequestStatusDto = PartsSearchRequestStatusDto;
__decorate([
    (0, class_validator_1.IsIn)(['open', 'done', 'dismissed']),
    __metadata("design:type", String)
], PartsSearchRequestStatusDto.prototype, "status", void 0);
class PartsSearchDemandQueryDto {
    days;
}
exports.PartsSearchDemandQueryDto = PartsSearchDemandQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(90),
    __metadata("design:type", Number)
], PartsSearchDemandQueryDto.prototype, "days", void 0);
function toOptionsParams(dto) {
    const params = [];
    const scalar = [
        'q',
        'vehicleConfigId',
        'makeId',
        'modelId',
        'make',
        'model',
        'year',
        'engineLitres',
        'page',
        'pageSize',
    ];
    for (const key of scalar) {
        const value = dto[key];
        if (value !== undefined && value !== null && value !== '')
            params.push([key, String(value)]);
    }
    if (dto.drop?.length)
        params.push(['drop', dto.drop.join(',')]);
    params.push(['includeUnavailable', 'true']);
    return params;
}
//# sourceMappingURL=parts-search-options.dto.js.map