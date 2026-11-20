"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartsSearchModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_js_1 = require("../auth/auth.module.js");
const storage_module_js_1 = require("../storage/storage.module.js");
const parts_search_event_entity_js_1 = require("./entities/parts-search-event.entity.js");
const parts_search_client_js_1 = require("./parts-search.client.js");
const parts_search_controller_js_1 = require("./parts-search.controller.js");
const parts_search_images_service_js_1 = require("./parts-search-images.service.js");
const parts_search_options_service_js_1 = require("./parts-search-options.service.js");
const parts_search_service_js_1 = require("./parts-search.service.js");
let PartsSearchModule = class PartsSearchModule {
};
exports.PartsSearchModule = PartsSearchModule;
exports.PartsSearchModule = PartsSearchModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([parts_search_event_entity_js_1.PartsSearchEvent]), auth_module_js_1.AuthModule, storage_module_js_1.StorageModule],
        controllers: [parts_search_controller_js_1.PartsSearchController],
        providers: [parts_search_client_js_1.PartsSearchClient, parts_search_service_js_1.PartsSearchService, parts_search_options_service_js_1.PartsSearchOptionsService, parts_search_images_service_js_1.PartsSearchImagesService],
    })
], PartsSearchModule);
//# sourceMappingURL=parts-search.module.js.map