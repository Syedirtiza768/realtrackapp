"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_js_1 = require("../auth/auth.module.js");
const notification_entity_js_1 = require("./entities/notification.entity.js");
const notifications_service_js_1 = require("./notifications.service.js");
const notifications_controller_js_1 = require("./notifications.controller.js");
const notification_gateway_js_1 = require("./notification.gateway.js");
const notification_triggers_js_1 = require("./notification-triggers.js");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([notification_entity_js_1.Notification]), auth_module_js_1.AuthModule],
        controllers: [notifications_controller_js_1.NotificationsController],
        providers: [notifications_service_js_1.NotificationsService, notification_gateway_js_1.NotificationGateway, notification_triggers_js_1.NotificationTriggers],
        exports: [notifications_service_js_1.NotificationsService],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map