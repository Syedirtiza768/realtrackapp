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
exports.FitmentModel = void 0;
const typeorm_1 = require("typeorm");
const fitment_make_entity_js_1 = require("./fitment-make.entity.js");
let FitmentModel = class FitmentModel {
    id;
    makeId;
    make;
    name;
    slug;
    acesId;
    createdAt;
};
exports.FitmentModel = FitmentModel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment'),
    __metadata("design:type", Number)
], FitmentModel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'make_id', type: 'integer' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], FitmentModel.prototype, "makeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => fitment_make_entity_js_1.FitmentMake, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'make_id' }),
    __metadata("design:type", fitment_make_entity_js_1.FitmentMake)
], FitmentModel.prototype, "make", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], FitmentModel.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], FitmentModel.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'aces_id', type: 'integer', nullable: true, unique: true }),
    __metadata("design:type", Object)
], FitmentModel.prototype, "acesId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FitmentModel.prototype, "createdAt", void 0);
exports.FitmentModel = FitmentModel = __decorate([
    (0, typeorm_1.Entity)('fitment_models'),
    (0, typeorm_1.Unique)(['makeId', 'slug'])
], FitmentModel);
//# sourceMappingURL=fitment-model.entity.js.map