import { Warehouse, WarehouseLocation } from './warehouse.entity.js';
import { InventoryItemSource, Supplier } from './supplier.entity.js';
import {
  InventoryItem,
  InventoryUnit,
  StockLevel,
} from './inventory-item.entity.js';
import {
  StockDocument,
  StockDocumentLine,
} from './stock-document.entity.js';
import {
  ProcurementRequest,
  StockMovement,
  StockReservation,
} from './stock-movement.entity.js';
import {
  ChannelStockSyncState,
  StoreStockPolicy,
  StoreWarehouseLink,
  UserWarehouseAssignment,
} from './store-stock.entity.js';

export * from './warehouse.entity.js';
export * from './supplier.entity.js';
export * from './inventory-item.entity.js';
export * from './stock-document.entity.js';
export * from './stock-movement.entity.js';
export * from './store-stock.entity.js';

export const STOCK_ENTITIES = [
  Warehouse,
  WarehouseLocation,
  Supplier,
  InventoryItemSource,
  InventoryItem,
  StockLevel,
  InventoryUnit,
  StockDocument,
  StockDocumentLine,
  StockMovement,
  StockReservation,
  ProcurementRequest,
  ChannelStockSyncState,
  StoreStockPolicy,
  StoreWarehouseLink,
  UserWarehouseAssignment,
];
