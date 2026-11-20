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
exports.PartFitment = void 0;
const typeorm_1 = require("typeorm");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const fitment_make_entity_js_1 = require("./fitment-make.entity.js");
const fitment_model_entity_js_1 = require("./fitment-model.entity.js");
const fitment_submodel_entity_js_1 = require("./fitment-submodel.entity.js");
const fitment_engine_entity_js_1 = require("./fitment-engine.entity.js");
let PartFitment = class PartFitment {
    id;
    listingId;
    listing;
    makeId;
    make;
    modelId;
    model;
    submodelId;
    submodel;
    yearStart;
    yearEnd;
    engineId;
    engine;
    source;
    confidence;
    verified;
    verifiedBy;
    verifiedAt;
    notes;
    createdAt;
};
exports.PartFitment = PartFitment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PartFitment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid' }),
    __metadata("design:type", String)
], PartFitment.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => listing_record_entity_js_1.ListingRecord, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'listing_id' }),
    __metadata("design:type", listing_record_entity_js_1.ListingRecord)
], PartFitment.prototype, "listing", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'make_id', type: 'integer' }),
    __metadata("design:type", Number)
], PartFitment.prototype, "makeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => fitment_make_entity_js_1.FitmentMake),
    (0, typeorm_1.JoinColumn)({ name: 'make_id' }),
    __metadata("design:type", fitment_make_entity_js_1.FitmentMake)
], PartFitment.prototype, "make", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'model_id', type: 'integer' }),
    __metadata("design:type", Number)
], PartFitment.prototype, "modelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => fitment_model_entity_js_1.FitmentModel),
    (0, typeorm_1.JoinColumn)({ name: 'model_id' }),
    __metadata("design:type", fitment_model_entity_js_1.FitmentModel)
], PartFitment.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'submodel_id', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], PartFitment.prototype, "submodelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => fitment_submodel_entity_js_1.FitmentSubmodel, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'submodel_id' }),
    __metadata("design:type", fitment_submodel_entity_js_1.FitmentSubmodel)
], PartFitment.prototype, "submodel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'year_start', type: 'smallint' }),
    __metadata("design:type", Number)
], PartFitment.prototype, "yearStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'year_end', type: 'smallint' }),
    __metadata("design:type", Number)
], PartFitment.prototype, "yearEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'engine_id', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], PartFitment.prototype, "engineId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => fitment_engine_entity_js_1.FitmentEngine, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'engine_id' }),
    __metadata("design:type", fitment_engine_entity_js_1.FitmentEngine)
], PartFitment.prototype, "engine", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'manual' }),
    __metadata("design:type", String)
], PartFitment.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'real', nullable: true }),
    __metadata("design:type", Object)
], PartFitment.prototype, "confidence", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], PartFitment.prototype, "verified", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'verified_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PartFitment.prototype, "verifiedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'verified_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], PartFitment.prototype, "verifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], PartFitment.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PartFitment.prototype, "createdAt", void 0);
exports.PartFitment = PartFitment = __decorate([
    (0, typeorm_1.Entity)('part_fitments'),
    (0, typeorm_1.Unique)(['listingId', 'makeId', 'modelId', 'yearStart', 'yearEnd', 'engineId']),
    (0, typeorm_1.Index)('idx_fitment_listing', ['listingId']),
    (0, typeorm_1.Index)('idx_fitment_vehicle', ['makeId', 'modelId', 'yearStart', 'yearEnd'])
], PartFitment);
//# sourceMappingURL=part-fitment.entity.js.map