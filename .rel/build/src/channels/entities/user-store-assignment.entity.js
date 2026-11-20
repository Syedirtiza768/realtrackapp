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
exports.UserStoreAssignment = void 0;
const typeorm_1 = require("typeorm");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
const store_entity_js_1 = require("./store.entity.js");
let UserStoreAssignment = class UserStoreAssignment {
    id;
    userId;
    user;
    storeId;
    store;
    accessLevel;
    createdAt;
};
exports.UserStoreAssignment = UserStoreAssignment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserStoreAssignment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserStoreAssignment.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_js_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_js_1.User)
], UserStoreAssignment.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserStoreAssignment.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => store_entity_js_1.Store, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'store_id' }),
    __metadata("design:type", store_entity_js_1.Store)
], UserStoreAssignment.prototype, "store", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'access_level',
        type: 'varchar',
        length: 20,
        default: 'view',
    }),
    __metadata("design:type", String)
], UserStoreAssignment.prototype, "accessLevel", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], UserStoreAssignment.prototype, "createdAt", void 0);
exports.UserStoreAssignment = UserStoreAssignment = __decorate([
    (0, typeorm_1.Entity)('user_store_assignments'),
    (0, typeorm_1.Unique)('uq_user_store', ['userId', 'storeId']),
    (0, typeorm_1.Index)('idx_usa_user', ['userId']),
    (0, typeorm_1.Index)('idx_usa_store', ['storeId'])
], UserStoreAssignment);
//# sourceMappingURL=user-store-assignment.entity.js.map