/**
 * stockApi.ts — typed client for warehouse inventory (/api/stock).
 *
 * Every call takes the active workspace (organizationId) like the Fashion/B&I clients.
 * Stock is changed only through these operations; product quantity fields are a projection.
 */
import { fetchWithAuth } from './authApi';

const base = '/api/stock';
const enc = encodeURIComponent;

export type Org = string | null | undefined;

function withOrg(path: string, org: Org, params?: Record<string, string | number | boolean | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  }
  if (org) qs.set('organizationId', org);
  const query = qs.toString();
  return `${base}${path}${query ? `${path.includes('?') ? '&' : '?'}${query}` : ''}`;
}
const get = <T>(path: string, org: Org, params?: Record<string, string | number | boolean | undefined | null>, signal?: AbortSignal) =>
  fetchWithAuth<T>(withOrg(path, org, params), { signal });
const send = <T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, org: Org, body?: unknown, params?: Record<string, string | undefined>) =>
  fetchWithAuth<T>(withOrg(path, org, params), { method, body: body === undefined ? undefined : JSON.stringify(body) });

export function stockError(err: unknown): string {
  if (err instanceof Error) {
    const body = (err as Error & { responseBody?: { code?: string; details?: Array<{ onHand: number; reserved: number }> } }).responseBody;
    if (body?.code === 'INSUFFICIENT_STOCK') return 'Not enough stock: the change would take on-hand or available quantity below zero.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

/* ── Types ─────────────────────────────────────────────────────────── */

export type TrackingMode = 'quantity' | 'serial' | 'one_off';
export type SourcingMode = 'stocked' | 'on_demand' | 'hybrid';

export interface StockSummary {
  skusInStock: number; onHand: number; reserved: number; available: number; inbound: number; damaged: number;
  stockValue?: string; activeSkus: number; sourceableSkus: number; lowStock: number; orderExceptions: number;
  awaitingProcurement: number; toPick: number; pendingApprovals: number; transfersInTransit: number; openPurchaseOrders: number;
}

export interface SetupStatus {
  warehouses: number; items: number; movements: number; stores: number; linkedStores: number;
  catalogProducts: number; fashionWarehouses: number; initialized: boolean;
}

export interface BootstrapReport {
  dryRun: boolean;
  defaultWarehouse: { id: string; code: string };
  warehousesFromFashion: number;
  items: { fromCatalog: number; fromListings: number; fromVariants: number; total: number };
  serialUnitsImported: number;
  openingBalances: { items: number; units: number; skippedAlreadyStocked: number };
  storesLinked: number;
  conflicts: Array<{ kind: string; sku: string; detail: string }>;
}

export interface Warehouse {
  id: string; code: string; name: string; type: 'owned' | '3pl' | 'virtual'; countryCode: string | null; timezone: string | null;
  ebayMerchantLocationKey: string | null; isDefault: boolean; isSellable: boolean; active: boolean;
  onHand?: number; available?: number; reserved?: number; inbound?: number; skuCount?: number; locationCount?: number;
}

export interface WarehouseLocation {
  id: string; code: string; zone: string | null; aisle: string | null; rack: string | null; shelf: string | null; bin: string | null;
  barcode: string | null; type: 'storage' | 'receiving' | 'staging' | 'returns' | 'quarantine'; isPickable: boolean;
  capacityUnits: number | null; active: boolean; onHand: number; skuCount: number;
}

export interface StoreStock {
  id: string; storeName: string; channel: string; status: string; pushEnabled: boolean; bufferQty: number; maxQty: number | null;
  includeSourceable: boolean; maxSourceableQty: number;
  links: Array<{ warehouseId: string; priority: number; active: boolean; code: string; name: string }>;
  syncCounts: Record<string, number> | null;
}

export interface StockItemRow {
  id: string; sku: string; title: string | null; imageUrl: string | null; vertical: string; trackingMode: TrackingMode;
  sourcingMode: SourcingMode; status: string; catalogProductId: string | null; listingRecordId: string | null; productVariantId: string | null;
  onHand: number; reserved: number; damaged: number; inbound: number; available: number; sourceable: number; sourceCount: number;
  pendingProcurement: number; lowStockThreshold: number; reorderPoint: number;
  breakdown: Array<{ warehouseId: string; code: string; onHand: number; available: number; bin: string | null }>;
  lastReceivedAt: string | null; unitCost?: string | null; bestSourceCost?: string | null; updatedAt: string;
}

export interface ItemSource {
  id: string; supplierId: string; supplierCode: string; supplierName: string; supplierSku: string | null; unitCost: string | null;
  currency: string; availableQty: number | null; leadTimeDays: number | null; priority: number;
  fulfillmentMode: 'ship_to_warehouse' | 'dropship'; url: string | null; active: boolean; lastCheckedAt: string | null; supplierActive: boolean;
}

export interface StockItemDetail {
  item: {
    id: string; sku: string; title: string | null; imageUrl: string | null; vertical: string; trackingMode: TrackingMode;
    sourcingMode: SourcingMode; unitCost?: string | null; currency: string; barcode: string | null; lowStockThreshold: number;
    reorderPoint: number; reorderQty: number; status: string; catalogProductId: string | null; listingRecordId: string | null;
    productVariantId: string | null;
  };
  levels: Array<{ id: string; warehouseId: string; warehouseCode: string; warehouseName: string; isSellable: boolean; locationId: string | null;
    locationCode: string | null; locationType: string | null; onHand: number; reserved: number; damaged: number; inbound: number; available: number; lastReceivedAt: string | null }>;
  units: Array<{ id: string; status: string; serialPublic: string | null; serialPrivate: string | null; lotCode: string | null; conditionId: string | null;
    warehouseId: string | null; warehouseCode: string | null; locationId: string | null; locationCode: string | null; receivedAt: string | null }>;
  reservations: Array<{ id: string; status: string; quantity: number; orderId: string | null; externalOrderId: string | null; orderStatus: string | null;
    warehouseCode: string; locationCode: string | null; createdAt: string }>;
  procurement: Array<{ id: string; status: string; quantity: number; receivedQty: number; reason: string; fulfillmentMode: string; supplierName: string | null;
    purchaseOrderNumber: string | null; purchaseOrderId: string | null; orderId: string | null; externalOrderId: string | null; createdAt: string }>;
  channels: Array<{ storeId: string; storeName: string; channel: string; status: string; desiredQty: number | null; pushedQty: number | null;
    channelQty: number | null; lastError: string | null; lastPushedAt: string | null }>;
  movements: StockMovementRow[];
  links: { catalogProduct: { id: string; title: string; quantity: number | null } | null; listingRecord: { id: string; title: string; quantity: number | null; status: string } | null;
    productVariant: { id: string; sku: string; quantity: number } | null };
}

export interface StockMovementRow {
  id: string; type: string; itemId?: string; sku?: string; title?: string | null; qtyOnHand: number; qtyReserved: number; qtyDamaged: number;
  qtyInbound: number; onHandAfter: number; reservedAfter?: number; reasonCode: string | null; note: string | null; warehouseCode: string;
  locationCode: string | null; documentId: string | null; documentNumber: string | null; orderId: string | null; externalOrderId?: string | null;
  actorEmail: string | null; createdAt: string;
}

export type DocType = 'receipt' | 'transfer' | 'adjustment' | 'count' | 'purchase_order';
export interface StockDocumentRow {
  id: string; docType: DocType; docNumber: string; status: string; reasonCode: string | null; reference: string | null; note: string | null;
  expectedAt: string | null; createdAt: string; completedAt: string | null; warehouseCode: string; destWarehouseCode: string | null;
  supplierName: string | null; warehouseId: string; destWarehouseId: string | null; supplierId: string | null; lineCount: number;
  totalQty: number; processedQty: number; createdByEmail: string | null;
}
export interface StockDocumentLine {
  id: string; itemId: string; sku: string; title: string | null; imageUrl: string | null; trackingMode: TrackingMode; locationId: string | null;
  locationCode: string | null; destLocationId: string | null; destLocationCode: string | null; unitId: string | null; quantity: number;
  processedQty: number; countedQty: number | null; systemQty: number | null; unitCost: string | null; serials: string[]; note: string | null;
  requests: Array<{ id: string; orderId: string | null; quantity: number; status: string; fulfillmentMode: string }> | null;
}
export interface StockDocumentDetail extends Omit<StockDocumentRow, 'warehouseCode' | 'destWarehouseCode' | 'supplierName' | 'lineCount' | 'totalQty' | 'processedQty' | 'createdByEmail'> {
  warehouse: { id: string; code: string; name: string } | null;
  destWarehouse: { id: string; code: string; name: string } | null;
  supplier: { id: string; code: string; name: string; email: string | null } | null;
  lines: StockDocumentLine[];
  metadata: Record<string, unknown>;
}

export interface Supplier {
  id: string; code: string; name: string; type: string; contactName: string | null; email: string | null; phone: string | null; website: string | null;
  currency: string; defaultLeadTimeDays: number; supportsDropship: boolean; notes: string | null; active: boolean;
  skuCount?: number; openRequests?: number; openPurchaseOrders?: number;
}

export interface ProcurementRequestRow {
  id: string; status: string; reason: string; quantity: number; receivedQty: number; fulfillmentMode: 'ship_to_warehouse' | 'dropship';
  itemId: string; sku: string; title: string | null; imageUrl: string | null; supplierId: string | null; supplierName: string | null;
  supplierSku: string | null; sourceUrl: string | null; supplierAvailable: number | null; estimatedUnitCost: string | null;
  warehouseId: string | null; warehouseCode: string | null; purchaseOrderId: string | null; purchaseOrderNumber: string | null;
  orderId: string | null; externalOrderId: string | null; orderStatus: string | null; buyerUsername: string | null; storeName: string | null;
  neededBy: string | null; supplierTracking: string | null; note: string | null; createdAt: string;
}

export interface ProcurementSummary { open: number; needsSupplier: number; ordered: number; dropshipPending: number; overdue: number }

export interface PickRow {
  reservationId: string; status: 'active' | 'picked'; quantity: number; orderId: string; externalOrderId: string | null; buyerUsername: string | null;
  shippingName: string | null; shippingCountry: string | null; orderedAt: string; storeName: string | null; warehouseId: string; warehouseCode: string;
  locationCode: string | null; itemId: string; sku: string; title: string | null; imageUrl: string | null; units: string | null;
}

export interface OrderException {
  orderItemId: string; orderId: string; externalOrderId: string | null; orderStatus: string; orderedAt: string; storeName: string;
  sku: string | null; title: string; quantity: number; stockStatus: string; itemId: string | null;
}

export interface OrderStock {
  orderId: string;
  lines: Array<{ id: string; sku: string | null; title: string; quantity: number; stockStatus: string | null; itemId: string | null; itemSku: string | null;
    sourcingMode: SourcingMode | null;
    reservations: Array<{ id: string; status: string; quantity: number; warehouseCode: string; locationCode: string | null }>;
    procurement: Array<{ id: string; status: string; quantity: number; receivedQty: number; fulfillmentMode: string; supplierName: string | null;
      purchaseOrderNumber: string | null; supplierTracking: string | null; neededBy: string | null }> }>;
}

export interface ChannelSyncRow {
  storeId: string; storeName: string; channel: string; itemId: string; sku: string; title: string | null; sourcingMode: SourcingMode;
  status: string; dirty: boolean; desiredQty: number | null; pushedQty: number | null; channelQty: number | null; attempts: number;
  lastError: string | null; lastPushedAt: string | null; updatedAt: string; targetCount: number;
}
export interface ChannelSummary { synced: number; shadow: number; failed: number; noTarget: number; pending: number; drift: number; pushGloballyEnabled: boolean }

export interface ScanResult {
  code: string;
  items: Array<{ id: string; sku: string; title: string | null; imageUrl: string | null; trackingMode: TrackingMode }>;
  locations: Array<{ id: string; code: string; warehouseId: string; warehouseCode: string }>;
  units: Array<{ id: string; itemId: string; sku: string; status: string; serialPublic: string | null; warehouseId: string | null; locationId: string | null }>;
}

export type Page<T> = { total: number; items: T[] };

/* ── Calls ─────────────────────────────────────────────────────────── */

export const stockApi = {
  summary: (org: Org, signal?: AbortSignal) => get<StockSummary>('/summary', org, undefined, signal),
  setupStatus: (org: Org, signal?: AbortSignal) => get<SetupStatus>('/setup/status', org, undefined, signal),
  bootstrap: (org: Org, body: { dryRun: boolean; openingBalances?: boolean; claimUnscopedAutomotive?: boolean; defaultWarehouseCode?: string; defaultWarehouseName?: string }) =>
    send<BootstrapReport>('POST', '/setup/bootstrap', org, body),

  warehouses: (org: Org, includeInactive = false, signal?: AbortSignal) => get<Warehouse[]>('/warehouses', org, { includeInactive }, signal),
  createWarehouse: (org: Org, body: Partial<Warehouse> & { code: string; name: string }) => send<Warehouse>('POST', '/warehouses', org, body),
  updateWarehouse: (org: Org, id: string, body: Partial<Warehouse>) => send<Warehouse>('PATCH', `/warehouses/${enc(id)}`, org, body),
  locations: (org: Org, warehouseId: string, includeInactive = false, signal?: AbortSignal) =>
    get<WarehouseLocation[]>(`/warehouses/${enc(warehouseId)}/locations`, org, { includeInactive }, signal),
  createLocation: (org: Org, warehouseId: string, body: Partial<WarehouseLocation> & { code: string }) =>
    send<WarehouseLocation>('POST', `/warehouses/${enc(warehouseId)}/locations`, org, body),
  generateLocations: (org: Org, warehouseId: string, body: { aisles: string[]; racks: number; shelves: number; prefix?: string; zone?: string }) =>
    send<{ requested: number; created: number }>('POST', `/warehouses/${enc(warehouseId)}/locations/generate`, org, body),
  updateLocation: (org: Org, id: string, body: Partial<WarehouseLocation>) => send<WarehouseLocation>('PATCH', `/locations/${enc(id)}`, org, body),

  stores: (org: Org, signal?: AbortSignal) => get<StoreStock[]>('/stores', org, undefined, signal),
  setStoreLinks: (org: Org, storeId: string, links: Array<{ warehouseId: string; priority?: number; active?: boolean }>) =>
    send('PUT', `/stores/${enc(storeId)}/links`, org, { links }),
  setStorePolicy: (org: Org, storeId: string, body: Partial<Pick<StoreStock, 'pushEnabled' | 'bufferQty' | 'maxQty' | 'includeSourceable' | 'maxSourceableQty'>>) =>
    send('PATCH', `/stores/${enc(storeId)}/policy`, org, body),

  items: (org: Org, params: { q?: string; warehouseId?: string; filter?: string; sourcingMode?: string; sort?: string; dir?: string; limit?: number; offset?: number }, signal?: AbortSignal) =>
    get<Page<StockItemRow> & { limit: number; offset: number }>('/items', org, params, signal),
  item: (org: Org, id: string, signal?: AbortSignal) => get<StockItemDetail>(`/items/${enc(id)}`, org, undefined, signal),
  createItem: (org: Org, body: { sku: string; title?: string; vertical?: string; trackingMode?: TrackingMode; sourcingMode?: SourcingMode; unitCost?: number }) =>
    send<{ id: string }>('POST', '/items', org, body),
  updateItem: (org: Org, id: string, body: Record<string, unknown>) => send('PATCH', `/items/${enc(id)}`, org, body),
  scan: (org: Org, code: string) => send<ScanResult>('POST', '/scan', org, { code }),

  sources: (org: Org, itemId: string, signal?: AbortSignal) => get<ItemSource[]>(`/items/${enc(itemId)}/sources`, org, undefined, signal),
  upsertSource: (org: Org, itemId: string, body: { supplierId: string; supplierSku?: string; unitCost?: number; availableQty?: number | null; leadTimeDays?: number; priority?: number; fulfillmentMode?: 'ship_to_warehouse' | 'dropship'; url?: string; active?: boolean }) =>
    send('PUT', `/items/${enc(itemId)}/sources`, org, body),
  removeSource: (org: Org, itemId: string, sourceId: string) => send('DELETE', `/items/${enc(itemId)}/sources/${enc(sourceId)}`, org),

  receive: (org: Org, body: { itemId: string; warehouseId: string; locationId?: string; quantity: number; unitCost?: number; serials?: string[]; lotCode?: string; reference?: string; note?: string; idempotencyKey?: string }) =>
    send<{ documentId: string }>('POST', '/receive', org, body),
  adjust: (org: Org, body: { itemId: string; warehouseId: string; locationId?: string; quantity: number; reasonCode: string; note?: string; idempotencyKey?: string }) =>
    send<{ status: string; message?: string }>('POST', '/adjust', org, body),
  move: (org: Org, body: { itemId: string; warehouseId: string; fromLocationId?: string | null; toLocationId?: string | null; quantity: number }) =>
    send('POST', '/move', org, body),
  damage: (org: Org, body: { itemId: string; warehouseId: string; locationId?: string; quantity: number; note?: string }) => send('POST', '/damage', org, body),

  documents: (org: Org, params: { type?: DocType; status?: string; warehouseId?: string; supplierId?: string; limit?: number; offset?: number }, signal?: AbortSignal) =>
    get<Page<StockDocumentRow>>('/documents', org, params, signal),
  document: (org: Org, id: string, signal?: AbortSignal) => get<StockDocumentDetail>(`/documents/${enc(id)}`, org, undefined, signal),
  cancelDocument: (org: Org, id: string) => send('POST', `/documents/${enc(id)}/cancel`, org),
  approveAdjustment: (org: Org, id: string) => send('POST', `/adjustments/${enc(id)}/approve`, org),
  createTransfer: (org: Org, body: { warehouseId: string; destWarehouseId: string; reference?: string; note?: string; lines: Array<{ itemId: string; quantity: number; locationId?: string }> }) =>
    send<{ id: string; docNumber: string }>('POST', '/transfers', org, body),
  shipTransfer: (org: Org, id: string) => send('POST', `/transfers/${enc(id)}/ship`, org),
  receiveTransfer: (org: Org, id: string, lines: Array<{ lineId: string; quantity: number; locationId?: string }>) =>
    send('POST', `/transfers/${enc(id)}/receive`, org, { lines }),
  createCount: (org: Org, body: { warehouseId: string; locationIds?: string[]; note?: string }) => send<{ id: string; docNumber: string }>('POST', '/counts', org, body),
  recordCount: (org: Org, id: string, lines: Array<{ lineId?: string; itemId?: string; locationId?: string; countedQty: number }>) =>
    send('PUT', `/counts/${enc(id)}/lines`, org, { lines }),
  submitCount: (org: Org, id: string) => send<{ status: string; message?: string }>('POST', `/counts/${enc(id)}/submit`, org),

  movements: (org: Org, params: { itemId?: string; warehouseId?: string; type?: string; from?: string; to?: string; limit?: number; offset?: number }, signal?: AbortSignal) =>
    get<Page<StockMovementRow>>('/movements', org, params, signal),
  valuation: (org: Org, signal?: AbortSignal) => get<Array<{ warehouseId: string; code: string; name: string; onHand: number; value: string; unCostedSkus: number }>>('/reports/valuation', org, undefined, signal),
  aging: (org: Org, signal?: AbortSignal) => get<{ buckets: Array<{ bucket: string; skus: number; units: number }>; oldest: Array<{ id: string; sku: string; title: string | null; onHand: number; since: string }> }>('/reports/aging', org, undefined, signal),

  suppliers: (org: Org, includeInactive = false, signal?: AbortSignal) => get<Supplier[]>('/suppliers', org, { includeInactive }, signal),
  createSupplier: (org: Org, body: Partial<Supplier> & { code: string; name: string }) => send<Supplier>('POST', '/suppliers', org, body),
  updateSupplier: (org: Org, id: string, body: Partial<Supplier>) => send<Supplier>('PATCH', `/suppliers/${enc(id)}`, org, body),

  procurementSummary: (org: Org, signal?: AbortSignal) => get<ProcurementSummary>('/procurement/summary', org, undefined, signal),
  requests: (org: Org, params: { status?: string; supplierId?: string; itemId?: string; limit?: number; offset?: number }, signal?: AbortSignal) =>
    get<Page<ProcurementRequestRow>>('/procurement/requests', org, params, signal),
  createRequest: (org: Org, body: { itemId: string; quantity: number; supplierId?: string; warehouseId?: string; fulfillmentMode?: 'ship_to_warehouse' | 'dropship'; note?: string }) =>
    send('POST', '/procurement/requests', org, body),
  updateRequest: (org: Org, id: string, body: { supplierId?: string; warehouseId?: string; fulfillmentMode?: 'ship_to_warehouse' | 'dropship'; estimatedUnitCost?: number; note?: string }) =>
    send('PATCH', `/procurement/requests/${enc(id)}`, org, body),
  cancelRequest: (org: Org, id: string) => send('POST', `/procurement/requests/${enc(id)}/cancel`, org),
  dropship: (org: Org, id: string, body: { supplierTracking?: string; carrier?: string; unitCost?: number; note?: string }) =>
    send('POST', `/procurement/requests/${enc(id)}/dropship`, org, body),
  reorder: (org: Org, signal?: AbortSignal) => get<{ suggestions: Array<{ id: string; sku: string; title: string | null; available: number; inbound: number; openRequests: number; reorderPoint: number; suggestedQty: number }> }>('/procurement/reorder', org, undefined, signal),
  createReorderRequests: (org: Org) => send<{ created: number }>('POST', '/procurement/reorder', org, { createRequests: true }),
  poFromRequests: (org: Org, requestIds: string[], warehouseId?: string) =>
    send<Array<{ id: string; docNumber: string }>>('POST', '/purchase-orders/from-requests', org, { requestIds, warehouseId }),
  createPurchaseOrder: (org: Org, body: { supplierId: string; warehouseId: string; lines?: Array<{ itemId: string; quantity: number; unitCost?: number }>; reference?: string; note?: string }) =>
    send<{ id: string; docNumber: string }>('POST', '/purchase-orders', org, body),
  orderPurchaseOrder: (org: Org, id: string) => send('POST', `/purchase-orders/${enc(id)}/order`, org),
  receivePurchaseOrder: (org: Org, id: string, lines: Array<{ lineId: string; quantity: number; locationId?: string; serials?: string[] }>) =>
    send('POST', `/purchase-orders/${enc(id)}/receive`, org, { lines }),
  cancelPurchaseOrder: (org: Org, id: string) => send('POST', `/purchase-orders/${enc(id)}/cancel`, org),

  orderExceptions: (org: Org, signal?: AbortSignal) => get<OrderException[]>('/orders/exceptions', org, undefined, signal),
  pickList: (org: Org, warehouseId?: string, signal?: AbortSignal) => get<PickRow[]>('/orders/pick-list', org, { warehouseId }, signal),
  orderStock: (org: Org, orderId: string, signal?: AbortSignal) => get<OrderStock>(`/orders/${enc(orderId)}`, org, undefined, signal),
  allocateOrder: (org: Org, orderId: string) => send('POST', `/orders/${enc(orderId)}/allocate`, org),
  pickOrder: (org: Org, orderId: string) => send<{ picked: number }>('POST', `/orders/${enc(orderId)}/pick`, org),
  linkOrderLine: (org: Org, orderId: string, orderItemId: string, itemId: string) =>
    send('POST', `/orders/${enc(orderId)}/lines/${enc(orderItemId)}/link`, org, { itemId }),

  channelSync: (org: Org, params: { storeId?: string; status?: string; driftOnly?: boolean; limit?: number; offset?: number }, signal?: AbortSignal) =>
    get<Page<ChannelSyncRow>>('/channel-sync', org, params, signal),
  channelSummary: (org: Org, signal?: AbortSignal) => get<ChannelSummary>('/channel-sync/summary', org, undefined, signal),
  resync: (org: Org, storeId?: string) => send<{ processed: number; pushed: number; failed: number }>('POST', '/channel-sync/resync', org, undefined, { storeId }),
};

export const STOCK_STATUS_LABEL: Record<string, string> = {
  unmatched: 'Not matched to stock',
  reserved: 'Reserved',
  picked: 'Picked',
  awaiting_procurement: 'Being acquired',
  backorder: 'Backorder',
  dropshipped: 'Dropshipped',
  shipped: 'Shipped',
  released: 'Released',
};

export const SOURCING_LABEL: Record<SourcingMode, string> = {
  stocked: 'Stocked',
  on_demand: 'On demand',
  hybrid: 'Stock + source',
};
