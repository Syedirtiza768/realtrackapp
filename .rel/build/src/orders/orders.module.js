"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const order_entity_js_1 = require("./entities/order.entity.js");
const order_item_entity_js_1 = require("./entities/order-item.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const orders_service_js_1 = require("./orders.service.js");
const orders_controller_js_1 = require("./orders.controller.js");
const order_import_processor_js_1 = require("./processors/order-import.processor.js");
const order_fulfillment_service_js_1 = require("./order-fulfillment.service.js");
const order_import_ebay_service_js_1 = require("./order-import-ebay.service.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const feature_flag_module_js_1 = require("../common/feature-flags/feature-flag.module.js");
const notifications_module_js_1 = require("../notifications/notifications.module.js");
const cross_store_sale_sync_service_js_1 = require("./cross-store-sale-sync.service.js");
const cross_store_sale_sync_controller_js_1 = require("./cross-store-sale-sync.controller.js");
const cross_store_sale_sync_processor_js_1 = require("./processors/cross-store-sale-sync.processor.js");
const cross_store_sale_sync_util_js_1 = require("./cross-store-sale-sync.util.js");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([order_entity_js_1.Order, order_item_entity_js_1.OrderItem, store_entity_js_1.Store, connected_ebay_account_entity_js_1.ConnectedEbayAccount]),
            bullmq_1.BullModule.registerQueue({ name: 'orders' }),
            bullmq_1.BullModule.registerQueue({ name: cross_store_sale_sync_util_js_1.CROSS_STORE_SALE_SYNC_QUEUE }),
            channels_module_js_1.ChannelsModule,
            feature_flag_module_js_1.FeatureFlagModule,
            notifications_module_js_1.NotificationsModule,
        ],
        controllers: [orders_controller_js_1.OrdersController, cross_store_sale_sync_controller_js_1.CrossStoreSaleSyncController],
        providers: [
            orders_service_js_1.OrdersService,
            order_import_processor_js_1.OrderImportProcessor,
            order_fulfillment_service_js_1.OrderFulfillmentService,
            order_import_ebay_service_js_1.EbayOrderImportService,
            cross_store_sale_sync_service_js_1.CrossStoreSaleSyncService,
            cross_store_sale_sync_processor_js_1.CrossStoreSaleSyncProcessor,
        ],
        exports: [orders_service_js_1.OrdersService, order_fulfillment_service_js_1.OrderFulfillmentService, order_import_ebay_service_js_1.EbayOrderImportService],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map