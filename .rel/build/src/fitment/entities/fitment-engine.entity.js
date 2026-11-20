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
exports.FitmentEngine = void 0;
const typeorm_1 = require("typeorm");
let FitmentEngine = class FitmentEngine {
    id;
    code;
    displacementL;
    cylinders;
    fuelType;
    aspiration;
    acesId;
};
exports.FitmentEngine = FitmentEngine;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment'),
    __metadata("design:type", Number)
], FitmentEngine.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], FitmentEngine.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'displacement_l',
        type: 'numeric',
        precision: 4,
        scale: 1,
        nullable: true,
    }),
    __metadata("design:type", Object)
], FitmentEngine.prototype, "displacementL", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint', nullable: true }),
    __metadata("design:type", Object)
], FitmentEngine.prototype, "cylinders", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fuel_type', type: 'varchar', length: 30, nullable: true }),
    __metadata("design:type", Object)
], FitmentEngine.prototype, "fuelType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, nullable: true }),
    __metadata("design:type", Object)
], FitmentEngine.prototype, "aspiration", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'aces_id', type: 'integer', nullable: true, unique: true }),
    __metadata("design:type", Object)
], FitmentEngine.prototype, "acesId", void 0);
exports.FitmentEngine = FitmentEngine = __decorate([
    (0, typeorm_1.Entity)('fitment_engines'),
    (0, typeorm_1.Unique)(['code'])
], FitmentEngine);
//# sourceMappingURL=fitment-engine.entity.js.map