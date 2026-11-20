"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_ENTITIES = void 0;
const warehouse_entity_js_1 = require("./warehouse.entity.js");
const supplier_entity_js_1 = require("./supplier.entity.js");
const inventory_item_entity_js_1 = require("./inventory-item.entity.js");
const stock_document_entity_js_1 = require("./stock-document.entity.js");
const stock_movement_entity_js_1 = require("./stock-movement.entity.js");
const store_stock_entity_js_1 = require("./store-stock.entity.js");
__exportStar(require("./warehouse.entity.js"), exports);
__exportStar(require("./supplier.entity.js"), exports);
__exportStar(require("./inventory-item.entity.js"), exports);
__exportStar(require("./stock-document.entity.js"), exports);
__exportStar(require("./stock-movement.entity.js"), exports);
__exportStar(require("./store-stock.entity.js"), exports);
exports.STOCK_ENTITIES = [
    warehouse_entity_js_1.Warehouse,
    warehouse_entity_js_1.WarehouseLocation,
    supplier_entity_js_1.Supplier,
    supplier_entity_js_1.InventoryItemSource,
    inventory_item_entity_js_1.InventoryItem,
    inventory_item_entity_js_1.StockLevel,
    inventory_item_entity_js_1.InventoryUnit,
    stock_document_entity_js_1.StockDocument,
    stock_document_entity_js_1.StockDocumentLine,
    stock_movement_entity_js_1.StockMovement,
    stock_movement_entity_js_1.StockReservation,
    stock_movement_entity_js_1.ProcurementRequest,
    store_stock_entity_js_1.ChannelStockSyncState,
    store_stock_entity_js_1.StoreStockPolicy,
    store_stock_entity_js_1.StoreWarehouseLink,
    store_stock_entity_js_1.UserWarehouseAssignment,
];
//# sourceMappingURL=index.js.map