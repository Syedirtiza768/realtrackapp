"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const listing_template_entity_js_1 = require("./entities/listing-template.entity.js");
const template_service_js_1 = require("./template.service.js");
const template_controller_js_1 = require("./template.controller.js");
let TemplateModule = class TemplateModule {
};
exports.TemplateModule = TemplateModule;
exports.TemplateModule = TemplateModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([listing_template_entity_js_1.ListingTemplate])],
        controllers: [template_controller_js_1.TemplateController],
        providers: [template_service_js_1.TemplateService],
        exports: [template_service_js_1.TemplateService],
    })
], TemplateModule);
//# sourceMappingURL=template.module.js.map