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
exports.FeatureFlagModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const feature_flag_entity_js_1 = require("./feature-flag.entity.js");
const feature_flag_service_js_1 = require("./feature-flag.service.js");
const feature_flag_controller_js_1 = require("./feature-flag.controller.js");
let FeatureFlagModule = class FeatureFlagModule {
    flagService;
    constructor(flagService) {
        this.flagService = flagService;
    }
    async onModuleInit() {
        const defaults = [
            ['automation_rules', 'Enable automation rules engine', false],
            ['template_system', 'Enable listing templates', false],
            ['amazon_integration', 'Enable Amazon SP-API integration', false],
            ['walmart_integration', 'Enable Walmart API integration', false],
            [
                'inventory_real_time_sync',
                'Enable real-time inventory sync from channels',
                false,
            ],
            [
                'order_auto_import',
                'Enable scheduled order import from channels',
                true,
            ],
            [
                'pricing_auto_push',
                'Enable automatic price pushing to channels',
                false,
            ],
            ['dashboard_aggregation', 'Enable scheduled dashboard aggregation', true],
            ['storage_cleanup', 'Enable scheduled storage cleanup', true],
            ['low_stock_alerts', 'Enable low stock alert notifications', true],
            [
                'pipeline_enrichment',
                'Enable VIN-to-listing enrichment pipeline',
                true,
            ],
            [
                'stock_channel_push',
                'Push warehouse stock quantities to sales channels (each store must also enable push)',
                false,
            ],
            [
                'ebay_cross_store_sale_sync',
                'A part sold on one eBay store is ended (or its quantity lowered) on every other connected eBay store',
                true,
            ],
            [
                'multi_vertical_catalog',
                'Enable Business & Industrial and Fashion catalog workflows',
                false,
            ],
        ];
        try {
            for (const [key, description, enabled] of defaults) {
                await this.flagService.ensureFlag(key, description, enabled);
            }
        }
        catch {
        }
    }
};
exports.FeatureFlagModule = FeatureFlagModule;
exports.FeatureFlagModule = FeatureFlagModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([feature_flag_entity_js_1.FeatureFlag])],
        controllers: [feature_flag_controller_js_1.FeatureFlagController],
        providers: [feature_flag_service_js_1.FeatureFlagService],
        exports: [feature_flag_service_js_1.FeatureFlagService],
    }),
    __metadata("design:paramtypes", [feature_flag_service_js_1.FeatureFlagService])
], FeatureFlagModule);
//# sourceMappingURL=feature-flag.module.js.map