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
exports.StockAccessService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const index_js_1 = require("./entities/index.js");
let StockAccessService = class StockAccessService {
    db;
    userOrgs;
    constructor(db, userOrgs) {
        this.db = db;
        this.userOrgs = userOrgs;
    }
    async scope(user, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const rows = await this.db.getRepository(index_js_1.UserWarehouseAssignment).find({
            where: { userId: user.id, organizationId: org.organizationId },
        });
        return {
            organizationId: org.organizationId,
            userId: user.id,
            warehouseIds: rows.length ? rows.map((r) => r.warehouseId) : null,
        };
    }
    assertWarehouse(scope, ...warehouseIds) {
        if (!scope.warehouseIds)
            return;
        for (const id of warehouseIds) {
            if (id && !scope.warehouseIds.includes(id))
                throw new common_1.ForbiddenException('You do not have access to this warehouse');
        }
    }
    warehouseFilter(scope, column, params) {
        if (!scope.warehouseIds)
            return 'TRUE';
        params.push(scope.warehouseIds);
        return `${column} = ANY($${params.length}::uuid[])`;
    }
};
exports.StockAccessService = StockAccessService;
exports.StockAccessService = StockAccessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        user_organization_service_js_1.UserOrganizationService])
], StockAccessService);
//# sourceMappingURL=stock-access.service.js.map