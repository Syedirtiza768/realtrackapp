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
exports.FitmentSubmodel = void 0;
const typeorm_1 = require("typeorm");
const fitment_model_entity_js_1 = require("./fitment-model.entity.js");
let FitmentSubmodel = class FitmentSubmodel {
    id;
    modelId;
    model;
    name;
    acesId;
};
exports.FitmentSubmodel = FitmentSubmodel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment'),
    __metadata("design:type", Number)
], FitmentSubmodel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'model_id', type: 'integer' }),
    __metadata("design:type", Number)
], FitmentSubmodel.prototype, "modelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => fitment_model_entity_js_1.FitmentModel, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'model_id' }),
    __metadata("design:type", fitment_model_entity_js_1.FitmentModel)
], FitmentSubmodel.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], FitmentSubmodel.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'aces_id', type: 'integer', nullable: true, unique: true }),
    __metadata("design:type", Object)
], FitmentSubmodel.prototype, "acesId", void 0);
exports.FitmentSubmodel = FitmentSubmodel = __decorate([
    (0, typeorm_1.Entity)('fitment_submodels'),
    (0, typeorm_1.Unique)(['modelId', 'name'])
], FitmentSubmodel);
//# sourceMappingURL=fitment-submodel.entity.js.map