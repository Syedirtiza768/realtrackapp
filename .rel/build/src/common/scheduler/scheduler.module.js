"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const scheduler_leader_service_js_1 = require("./scheduler-leader.service.js");
const scheduler_service_js_1 = require("./scheduler.service.js");
const pricing_intelligence_module_js_1 = require("../../pricing-intelligence/pricing-intelligence.module.js");
const sellerpundit_module_js_1 = require("../../integrations/sellerpundit/sellerpundit.module.js");
const ebay_integrations_module_js_1 = require("../../integrations/ebay/ebay-integrations.module.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const channels_module_js_1 = require("../../channels/channels.module.js");
let SchedulerModule = class SchedulerModule {
};
exports.SchedulerModule = SchedulerModule;
exports.SchedulerModule = SchedulerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.registerQueue({ name: 'storage-cleanup' }, { name: 'inventory' }, { name: 'orders' }, { name: 'dashboard' }, { name: 'channels' }),
            typeorm_1.TypeOrmModule.forFeature([connected_ebay_account_entity_js_1.ConnectedEbayAccount]),
            pricing_intelligence_module_js_1.PricingIntelligenceModule,
            sellerpundit_module_js_1.SellerpunditModule,
            ebay_integrations_module_js_1.EbayIntegrationsModule,
            channels_module_js_1.ChannelsModule,
        ],
        providers: [scheduler_leader_service_js_1.SchedulerLeaderService, scheduler_service_js_1.SchedulerService],
        exports: [scheduler_leader_service_js_1.SchedulerLeaderService],
    })
], SchedulerModule);
//# sourceMappingURL=scheduler.module.js.map