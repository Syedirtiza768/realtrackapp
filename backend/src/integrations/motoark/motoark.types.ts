import type { MotoarkOrderEventDto } from './motoark.dto.js';

export interface MotoarkInboxRow {
  id: string;
  organization_id: string;
  store_id: string;
  actor_user_id: string;
  event_id: string;
  payload_hash: string;
  payload: MotoarkOrderEventDto;
  status: 'received' | 'pending' | 'applied' | 'rejected';
}
export interface MotoarkOrderRow {
  id: string;
  organization_id: string;
  store_id: string;
  order_id: string;
  external_order_id: string;
  version: number;
  currency: string;
  total_amount: string;
  refunded_amount: string;
}
export interface MotoarkEventResult {
  eventId: string;
  status: MotoarkInboxRow['status'];
  attempts: number;
  lastError: string | null;
  result: Record<string, unknown> | null;
  receivedAt: Date;
  appliedAt: Date | null;
}
export interface MotoarkQuantityRow {
  listingId: string;
  marketplaceQuantity: number;
  listingRevision: string;
  inventoryItemId: string | null;
  mappingCount: number | null;
  desiredQuantity: number | null;
  channelSyncStatus: string | null;
  channelSyncError: string | null;
  onHand: number;
  reserved: number;
  stockRevision: string;
}
export interface MotoarkListingRow {
  id: string;
  catalog_product_id: string | null;
  sku: string | null;
  title: string;
  is_test_listing: boolean;
  ebay_item_id: string | null;
  listing_status: string;
}
export interface MotoarkReturnRow {
  id: string;
  requested: number;
  received: number;
  restocked: number;
  disposed: number;
  warehouse_id: string | null;
  location_id: string | null;
  unit_ids: string[];
}
