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
exports.AutomationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const automation_service_js_1 = require("./automation.service.js");
const automation_rule_dto_js_1 = require("./dto/automation-rule.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
let AutomationController = class AutomationController {
    automationService;
    constructor(automationService) {
        this.automationService = automationService;
    }
    findAll(query) {
        return this.automationService.findAll(query);
    }
    findOne(id) {
        return this.automationService.findOne(id);
    }
    create(dto) {
        return this.automationService.create(dto);
    }
    update(id, dto) {
        return this.automationService.update(id, dto);
    }
    remove(id) {
        return this.automationService.remove(id);
    }
    toggle(id) {
        return this.automationService.toggle(id);
    }
    execute(id) {
        return this.automationService.execute(id);
    }
};
exports.AutomationController = AutomationController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all automation rules' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [automation_rule_dto_js_1.AutomationRuleQueryDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single automation rule' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('automation.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Create an automation rule' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [automation_rule_dto_js_1.CreateAutomationRuleDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('automation.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update an automation rule' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, automation_rule_dto_js_1.UpdateAutomationRuleDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('automation.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete an automation rule' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "remove", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('automation.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Toggle an automation rule enabled/disabled' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "toggle", null);
__decorate([
    (0, common_1.Post)(':id/execute'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('automation.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Manually execute an automation rule' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "execute", null);
exports.AutomationController = AutomationController = __decorate([
    (0, swagger_1.ApiTags)('Automation Rules'),
    (0, common_1.Controller)('automation-rules'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('automation.view'),
    __metadata("design:paramtypes", [automation_service_js_1.AutomationService])
], AutomationController);
//# sourceMappingURL=automation.controller.js.map