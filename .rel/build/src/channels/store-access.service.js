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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreAccessService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const store_entity_js_1 = require("./entities/store.entity.js");
const user_store_assignment_entity_js_1 = require("./entities/user-store-assignment.entity.js");
let StoreAccessService = class StoreAccessService {
    assignmentRepo;
    storeRepo;
    constructor(assignmentRepo, storeRepo) {
        this.assignmentRepo = assignmentRepo;
        this.storeRepo = storeRepo;
    }
    async getAccessibleStoreIds(user) {
        if (user.storeAccessAll) {
            const all = await this.storeRepo.find({ select: ['id'] });
            return new Set(all.map((s) => s.id));
        }
        const assignments = await this.assignmentRepo.find({
            where: { userId: user.id },
            select: ['storeId'],
        });
        return new Set(assignments.map((a) => a.storeId));
    }
    async getStoreIdsAtLevel(user, minLevel) {
        if (user.storeAccessAll) {
            const all = await this.storeRepo.find({ select: ['id'] });
            return new Set(all.map((s) => s.id));
        }
        const levelRank = {
            view: 0,
            operate: 1,
            admin: 2,
        };
        const minRank = levelRank[minLevel];
        const assignments = await this.assignmentRepo.find({
            where: { userId: user.id },
        });
        return new Set(assignments
            .filter((a) => levelRank[a.accessLevel] >= minRank)
            .map((a) => a.storeId));
    }
    async assertStoreAccess(user, storeId, minLevel = 'view') {
        if (user.storeAccessAll)
            return;
        const assignment = await this.assignmentRepo.findOne({
            where: { userId: user.id, storeId },
        });
        if (!assignment) {
            throw new common_1.ForbiddenException(`You do not have access to store ${storeId}`);
        }
        const levelRank = {
            view: 0,
            operate: 1,
            admin: 2,
        };
        if (levelRank[assignment.accessLevel] < levelRank[minLevel]) {
            throw new common_1.ForbiddenException(`Insufficient access level for store ${storeId}. Required: ${minLevel}, have: ${assignment.accessLevel}`);
        }
    }
    async getUserAssignments(userId) {
        return this.assignmentRepo.find({
            where: { userId },
            relations: ['store'],
        });
    }
    async setAssignment(userId, storeId, accessLevel) {
        const existing = await this.assignmentRepo.findOne({
            where: { userId, storeId },
        });
        if (existing) {
            existing.accessLevel = accessLevel;
            return this.assignmentRepo.save(existing);
        }
        return this.assignmentRepo.save(this.assignmentRepo.create({ userId, storeId, accessLevel }));
    }
    async removeAssignment(userId, storeId) {
        await this.assignmentRepo.delete({ userId, storeId });
    }
    async resolveStoreFilter(user) {
        if (!user || user.storeAccessAll)
            return undefined;
        const storeIds = await this.getAccessibleStoreIds(user);
        if (storeIds.size === 0)
            return [];
        return [...storeIds];
    }
    static UNSCOPED_LISTINGS_SQL = `r.id NOT IN (SELECT lci.listing_id FROM listing_channel_instances lci)`;
    static SCOPED_LISTINGS_SQL = `(r.id IN (SELECT lci.listing_id FROM listing_channel_instances lci WHERE lci.store_id IN (:...storeIds))
      OR r.id NOT IN (SELECT lci.listing_id FROM listing_channel_instances lci))`;
    async setAccessAll(userId, value) {
        await this.storeRepo.manager
            .createQueryBuilder()
            .update(user_entity_js_1.User)
            .set({ storeAccessAll: value })
            .where('id = :id', { id: userId })
            .execute();
    }
};
exports.StoreAccessService = StoreAccessService;
exports.StoreAccessService = StoreAccessService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_store_assignment_entity_js_1.UserStoreAssignment)),
    __param(1, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], StoreAccessService);
//# sourceMappingURL=store-access.service.js.map