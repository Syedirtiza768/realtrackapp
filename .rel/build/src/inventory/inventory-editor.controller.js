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
exports.InventoryEditorController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const inventory_editor_service_js_1 = require("./inventory-editor.service.js");
const inventory_publish_service_js_1 = require("./inventory-publish.service.js");
const inventory_editor_dto_js_1 = require("./dto/inventory-editor.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
let InventoryEditorController = class InventoryEditorController {
    editor;
    publisher;
    constructor(editor, publisher) {
        this.editor = editor;
        this.publisher = publisher;
    }
    async getEditor(id, user) {
        return this.editor.getEditorData(id, user);
    }
    async saveEditor(id, dto) {
        return this.editor.saveEditorData(id, dto);
    }
    async publishListing(id, user, body) {
        return this.publisher.publish(id, user.id, body.targets);
    }
};
exports.InventoryEditorController = InventoryEditorController;
__decorate([
    (0, common_1.Get)(':id/editor'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('inventory.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Load all data for the listing editor: listing info, marketplace versions, accessible stores with policies',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], InventoryEditorController.prototype, "getEditor", null);
__decorate([
    (0, common_1.Put)(':id/editor'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Save marketplace version edits to the catalog product',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, inventory_editor_dto_js_1.SaveEditorDto]),
    __metadata("design:returntype", Promise)
], InventoryEditorController.prototype, "saveEditor", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, throttler_1.Throttle)({ medium: { limit: 10, ttl: 60_000 } }),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ebay.publish'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Publish listing to selected eBay stores. Creates catalog product if needed.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User,
        inventory_editor_dto_js_1.PublishListingDto]),
    __metadata("design:returntype", Promise)
], InventoryEditorController.prototype, "publishListing", null);
exports.InventoryEditorController = InventoryEditorController = __decorate([
    (0, swagger_1.ApiTags)('inventory'),
    (0, common_1.Controller)('inventory'),
    __metadata("design:paramtypes", [inventory_editor_service_js_1.InventoryEditorService,
        inventory_publish_service_js_1.InventoryPublishService])
], InventoryEditorController);
//# sourceMappingURL=inventory-editor.controller.js.map