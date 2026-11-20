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
exports.FashionIntakeController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const fashion_dto_js_1 = require("./fashion.dto.js");
const fashion_intake_service_js_1 = require("./fashion-intake.service.js");
const fashion_intake_images_service_js_1 = require("./fashion-intake-images.service.js");
const fashion_measurements_js_1 = require("./fashion-measurements.js");
let FashionIntakeController = class FashionIntakeController {
    intake;
    generated;
    constructor(intake, generated) {
        this.intake = intake;
        this.generated = generated;
    }
    measurementTemplates() {
        return (0, fashion_measurements_js_1.publicFashionMeasurementTemplates)();
    }
    warehouses(user, organizationId, includeInactive) {
        return this.intake.listWarehouses(user, organizationId, includeInactive === 'true');
    }
    createWarehouse(user, dto, organizationId) {
        return this.intake.createWarehouse(user, dto, organizationId);
    }
    updateWarehouse(user, id, dto, organizationId) {
        return this.intake.updateWarehouse(user, id, dto, organizationId);
    }
    batches(user, organizationId) {
        return this.intake.batches(user, organizationId);
    }
    nextSku(user, dto, organizationId) {
        return this.intake.nextSku(user, dto, organizationId);
    }
    history(user, organizationId, batch, status, q, source, page, pageSize) {
        return this.intake.history(user, {
            organizationId,
            batch,
            status,
            q,
            source,
            page,
            pageSize,
        });
    }
    addToCatalog(user, id, organizationId) {
        return this.intake.addToCatalog(user, id, organizationId);
    }
    activityReport(user, params) {
        return this.intake.activityReport(user, params);
    }
    exportActivityReport(user, params) {
        return this.intake.exportActivity(user, params);
    }
    create(user, dto, organizationId) {
        return this.intake.create(user, dto, organizationId);
    }
    identify(user, id, organizationId) {
        return this.intake.requestIdentification(user, id, organizationId);
    }
    sizeChart(user, dto, organizationId) {
        return this.generated.sizeChart(user, dto, organizationId);
    }
    banner(user, dto, organizationId) {
        return this.generated.banner(user, dto, organizationId);
    }
};
exports.FashionIntakeController = FashionIntakeController;
__decorate([
    (0, common_1.Get)('measurement-templates'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "measurementTemplates", null);
__decorate([
    (0, common_1.Get)('warehouses'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "warehouses", null);
__decorate([
    (0, common_1.Post)('warehouses'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.settings.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        fashion_dto_js_1.FashionWarehouseDto, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "createWarehouse", null);
__decorate([
    (0, common_1.Patch)('warehouses/:warehouseId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.settings.manage'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('warehouseId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, fashion_dto_js_1.UpdateFashionWarehouseDto, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "updateWarehouse", null);
__decorate([
    (0, common_1.Get)('intake/batches'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "batches", null);
__decorate([
    (0, common_1.Post)('intake/sku'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        fashion_dto_js_1.NextFashionSkuDto, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "nextSku", null);
__decorate([
    (0, common_1.Get)('intake'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('batch')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('q')),
    __param(5, (0, common_1.Query)('source')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "history", null);
__decorate([
    (0, common_1.Post)('intake/:id/add-to-catalog'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "addToCatalog", null);
__decorate([
    (0, common_1.Get)('reports/activity'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, Object]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "activityReport", null);
__decorate([
    (0, common_1.Get)('reports/activity/export'),
    (0, common_1.Header)('Content-Type', 'text/csv; charset=utf-8'),
    (0, common_1.Header)('Content-Disposition', 'attachment; filename="fashion-activity-report.csv"'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, Object]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "exportActivityReport", null);
__decorate([
    (0, common_1.Post)('intake'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        fashion_dto_js_1.CreateFashionIntakeDto, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('listings/:id/identify'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.update'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "identify", null);
__decorate([
    (0, common_1.Post)('listings/size-chart'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        fashion_dto_js_1.FashionSizeChartDto, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "sizeChart", null);
__decorate([
    (0, common_1.Post)('listings/photos/banner'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        fashion_dto_js_1.FashionImageBannerDto, String]),
    __metadata("design:returntype", void 0)
], FashionIntakeController.prototype, "banner", null);
exports.FashionIntakeController = FashionIntakeController = __decorate([
    (0, common_1.Controller)('fashion'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access'),
    __metadata("design:paramtypes", [fashion_intake_service_js_1.FashionIntakeService,
        fashion_intake_images_service_js_1.FashionIntakeImagesService])
], FashionIntakeController);
//# sourceMappingURL=fashion-intake.controller.js.map