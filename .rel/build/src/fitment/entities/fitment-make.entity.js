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
exports.FitmentMake = void 0;
const typeorm_1 = require("typeorm");
let FitmentMake = class FitmentMake {
    id;
    name;
    slug;
    acesId;
    createdAt;
};
exports.FitmentMake = FitmentMake;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment'),
    __metadata("design:type", Number)
], FitmentMake.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], FitmentMake.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], FitmentMake.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'aces_id', type: 'integer', nullable: true, unique: true }),
    __metadata("design:type", Object)
], FitmentMake.prototype, "acesId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], FitmentMake.prototype, "createdAt", void 0);
exports.FitmentMake = FitmentMake = __decorate([
    (0, typeorm_1.Entity)('fitment_makes'),
    (0, typeorm_1.Unique)(['slug'])
], FitmentMake);
//# sourceMappingURL=fitment-make.entity.js.map