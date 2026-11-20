"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const auth_module_js_1 = require("../auth/auth.module.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const notifications_module_js_1 = require("../notifications/notifications.module.js");
const feature_flag_module_js_1 = require("../common/feature-flags/feature-flag.module.js");
const scheduler_module_js_1 = require("../common/scheduler/scheduler.module.js");
const index_js_1 = require("./entities/index.js");
const stock_ledger_service_js_1 = require("./stock-ledger.service.js");
const stock_access_service_js_1 = require("./stock-access.service.js");
const warehouses_service_js_1 = require("./warehouses.service.js");
const suppliers_service_js_1 = require("./suppliers.service.js");
const inventory_items_service_js_1 = require("./inventory-items.service.js");
const stock_operations_service_js_1 = require("./stock-operations.service.js");
const reservations_service_js_1 = require("./reservations.service.js");
const procurement_service_js_1 = require("./procurement.service.js");
const order_stock_service_js_1 = require("./order-stock.service.js");
const channel_stock_sync_service_js_1 = require("./channel-stock-sync.service.js");
const channel_stock_sync_processor_js_1 = require("./channel-stock-sync.processor.js");
const stock_setup_service_js_1 = require("./stock-setup.service.js");
const stock_reports_service_js_1 = require("./stock-reports.service.js");
const stock_intake_listener_js_1 = require("./stock-intake.listener.js");
const stock_controller_js_1 = require("./stock.controller.js");
const stock_procurement_controller_js_1 = require("./stock-procurement.controller.js");
let StockModule = class StockModule {
};
exports.StockModule = StockModule;
exports.StockModule = StockModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature(index_js_1.STOCK_ENTITIES),
            bullmq_1.BullModule.registerQueue({ name: channel_stock_sync_service_js_1.STOCK_CHANNEL_SYNC_QUEUE }),
            auth_module_js_1.AuthModule,
            channels_module_js_1.ChannelsModule,
            notifications_module_js_1.NotificationsModule,
            feature_flag_module_js_1.FeatureFlagModule,
            scheduler_module_js_1.SchedulerModule,
        ],
        controllers: [stock_controller_js_1.StockController, stock_procurement_controller_js_1.StockProcurementController],
        providers: [
            stock_ledger_service_js_1.StockLedgerService,
            stock_access_service_js_1.StockAccessService,
            warehouses_service_js_1.WarehousesService,
            suppliers_service_js_1.SuppliersService,
            inventory_items_service_js_1.InventoryItemsService,
            stock_operations_service_js_1.StockOperationsService,
            reservations_service_js_1.ReservationsService,
            procurement_service_js_1.ProcurementService,
            order_stock_service_js_1.OrderStockService,
            channel_stock_sync_service_js_1.ChannelStockSyncService,
            channel_stock_sync_processor_js_1.ChannelStockSyncProcessor,
            stock_setup_service_js_1.StockSetupService,
            stock_reports_service_js_1.StockReportsService,
            stock_intake_listener_js_1.StockIntakeListener,
        ],
        exports: [stock_ledger_service_js_1.StockLedgerService, inventory_items_service_js_1.InventoryItemsService, order_stock_service_js_1.OrderStockService, reservations_service_js_1.ReservationsService, channel_stock_sync_service_js_1.ChannelStockSyncService],
    })
], StockModule);
//# sourceMappingURL=stock.module.js.map