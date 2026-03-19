/**
 * ordersApi.ts — Typed frontend API client for the Orders module.
 *
 * Phase 4: Order Management & Fulfillment
 * Covers: queries, single/bulk ship, bulk cancel, CSV tracking, manual import, refund.
 */
import { authGet, authPost, fetchWithAuth } from './authApi';

/* ─── Types ─── */

export interface OrderItem {
  id: string;
  orderId: string;
  listingId: string | null;
  externalItemId: string | null;
  sku: string | null;
  title: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  fulfilled: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  channel: string;
  connectionId: string | null;
  storeId: string | null;
  externalOrderId: string;
  externalUrl: string | null;
  status: string;
  buyerUsername: string | null;
  buyerEmail: string | null;
  buyerName: string | null;
  shippingName: string | null;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingCountry: string | null;
  shippingMethod: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  subtotal: string;
  shippingCost: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  marketplaceFee: string;
  netRevenue: string | null;
  refundAmount: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  orderedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrdersQuery {
  status?: string;
  channel?: string;
  storeId?: string;
  since?: string;
  until?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface OrdersListResponse {
  orders: Order[];
  total: number;
}

export interface OrderDetailResponse {
  order: Order;
  items: OrderItem[];
}

export interface OrderStats {
  [status: string]: number;
}

export interface BulkShipItem {
  orderId: string;
  trackingNumber: string;
  carrier: string;
}

export interface BulkResult {
  orderId: string;
  success: boolean;
  error?: string;
}

export interface CsvTrackingResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ row: number; orderId: string; error: string }>;
}

export interface ImportResult {
  storeId: string;
  imported: number;
  errors: number;
}

/* ─── Queries ─── */

export async function getOrders(query: OrdersQuery = {}): Promise<OrdersListResponse> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.channel) params.set('channel', query.channel);
  if (query.storeId) params.set('storeId', query.storeId);
  if (query.since) params.set('since', query.since);
  if (query.until) params.set('until', query.until);
  if (query.search) params.set('search', query.search);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));

  const qs = params.toString();
  return authGet<OrdersListResponse>(`/api/orders${qs ? `?${qs}` : ''}`);
}

export async function getOrder(id: string): Promise<OrderDetailResponse> {
  return authGet<OrderDetailResponse>(`/api/orders/${id}`);
}

export async function getOrderStats(): Promise<OrderStats> {
  return authGet<OrderStats>('/api/orders/stats');
}

/* ─── Status & Shipping ─── */

export async function updateOrderStatus(
  id: string,
  status: string,
  reason?: string,
): Promise<Order> {
  return fetchWithAuth<Order>(`/api/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

export async function updateShipping(
  id: string,
  tracking: { trackingNumber: string; trackingCarrier?: string; shippingMethod?: string },
): Promise<Order> {
  return fetchWithAuth<Order>(`/api/orders/${id}/shipping`, {
    method: 'PATCH',
    body: JSON.stringify(tracking),
  });
}

/* ─── Phase 4: Ship with eBay Push ─── */

export async function shipOrder(
  id: string,
  tracking: { trackingNumber: string; trackingCarrier?: string },
): Promise<Order> {
  return authPost<Order>(`/api/orders/${id}/ship`, tracking);
}

/* ─── Phase 4: Bulk Operations ─── */

export async function bulkShip(items: BulkShipItem[]): Promise<BulkResult[]> {
  return authPost<BulkResult[]>('/api/orders/bulk/ship', { items });
}

export async function bulkCancel(
  orderIds: string[],
  reason?: string,
): Promise<BulkResult[]> {
  return authPost<BulkResult[]>('/api/orders/bulk/cancel', { orderIds, reason });
}

export async function uploadTrackingCsv(csvContent: string): Promise<CsvTrackingResult> {
  return authPost<CsvTrackingResult>('/api/orders/bulk/tracking-upload', { csvContent });
}

/* ─── Phase 4: Refund ─── */

export async function processRefund(
  id: string,
  amount: string,
  reason?: string,
): Promise<Order> {
  return authPost<Order>(`/api/orders/${id}/refund`, { amount, reason });
}

/* ─── Phase 4: Manual Import ─── */

export async function importEbayOrders(storeId?: string): Promise<ImportResult | ImportResult[]> {
  return authPost<ImportResult | ImportResult[]>('/api/orders/import/ebay', { storeId });
}
