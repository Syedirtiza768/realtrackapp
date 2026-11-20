"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientSettingsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const client_settings_controller_js_1 = require("./client-settings.controller.js");
const client_settings_service_js_1 = require("./client-settings.service.js");
const client_settings_entity_js_1 = require("./entities/client-settings.entity.js");
let ClientSettingsModule = class ClientSettingsModule {
};
exports.ClientSettingsModule = ClientSettingsModule;
exports.ClientSettingsModule = ClientSettingsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([client_settings_entity_js_1.ClientSettings])],
        controllers: [client_settings_controller_js_1.ClientSettingsController],
        providers: [client_settings_service_js_1.ClientSettingsService],
        exports: [client_settings_service_js_1.ClientSettingsService, typeorm_1.TypeOrmModule],
    })
], ClientSettingsModule);
//# sourceMappingURL=client-settings.module.js.map