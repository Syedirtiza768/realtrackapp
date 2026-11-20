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
exports.PartsSearchEvent = void 0;
const typeorm_1 = require("typeorm");
let PartsSearchEvent = class PartsSearchEvent {
    id;
    createdAt;
    type;
    userId;
    userEmail;
    query;
    numbers;
    vehicle;
    resultCount;
    inStockCount;
    fitsCount;
    demand;
    partId;
    requestRef;
    note;
    status;
    updatedBy;
    updatedAt;
};
exports.PartsSearchEvent = PartsSearchEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PartsSearchEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PartsSearchEvent.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 12 }),
    __metadata("design:type", String)
], PartsSearchEvent.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PartsSearchEvent.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_email', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], PartsSearchEvent.prototype, "userEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', default: '' }),
    __metadata("design:type", String)
], PartsSearchEvent.prototype, "query", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, default: () => "'{}'" }),
    __metadata("design:type", Array)
], PartsSearchEvent.prototype, "numbers", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], PartsSearchEvent.prototype, "vehicle", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'result_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PartsSearchEvent.prototype, "resultCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'in_stock_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PartsSearchEvent.prototype, "inStockCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fits_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PartsSearchEvent.prototype, "fitsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], PartsSearchEvent.prototype, "demand", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_id', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], PartsSearchEvent.prototype, "partId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'request_ref', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], PartsSearchEvent.prototype, "requestRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], PartsSearchEvent.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 12, nullable: true }),
    __metadata("design:type", Object)
], PartsSearchEvent.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PartsSearchEvent.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], PartsSearchEvent.prototype, "updatedAt", void 0);
exports.PartsSearchEvent = PartsSearchEvent = __decorate([
    (0, typeorm_1.Entity)('parts_search_events'),
    (0, typeorm_1.Index)('idx_pse_type_created', ['type', 'createdAt']),
    (0, typeorm_1.Index)('idx_pse_demand_created', ['demand', 'createdAt'])
], PartsSearchEvent);
//# sourceMappingURL=parts-search-event.entity.js.map