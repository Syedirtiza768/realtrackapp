import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StockMovementType =
  | 'opening_balance'
  | 'receipt'
  | 'putaway'
  | 'transfer_out'
  | 'transfer_in'
  | 'adjustment'
  | 'count_variance'
  | 'reserve'
  | 'release'
  | 'pick'
  | 'ship'
  | 'return_receipt'
  | 'damage'
  | 'write_off'
  | 'po_ordered'
  | 'po_cancelled'
  | 'dropship';

/** Append-only stock ledger (a DB trigger rejects UPDATE/DELETE). */
@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'inventory_item_id', type: 'uuid' }) inventoryItemId!: string;
  @Column({ name: 'warehouse_id', type: 'uuid' }) warehouseId!: string;
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;
  @Column({ name: 'movement_type', type: 'varchar', length: 30 })
  movementType!: StockMovementType;
  @Column({ name: 'qty_on_hand', type: 'integer', default: 0 })
  qtyOnHand!: number;
  @Column({ name: 'qty_reserved', type: 'integer', default: 0 })
  qtyReserved!: number;
  @Column({ name: 'qty_damaged', type: 'integer', default: 0 })
  qtyDamaged!: number;
  @Column({ name: 'qty_inbound', type: 'integer', default: 0 })
  qtyInbound!: number;
  @Column({ name: 'on_hand_after', type: 'integer' }) onHandAfter!: number;
  @Column({ name: 'reserved_after', type: 'integer' }) reservedAfter!: number;
  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  unitCost!: string | null;
  @Column({ name: 'reason_code', type: 'varchar', length: 40, nullable: true })
  reasonCode!: string | null;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId!: string | null;
  @Column({
    name: 'source_channel',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  sourceChannel!: string | null;
  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;
  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;
  @Column({ name: 'order_item_id', type: 'uuid', nullable: true })
  orderItemId!: string | null;
  @Column({
    name: 'operation_key',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  operationKey!: string | null;
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 220,
    nullable: true,
  })
  idempotencyKey!: string | null;
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

export type StockReservationStatus = 'active' | 'picked' | 'shipped' | 'released';

/** Stock held in a specific warehouse/bin for an order line. */
@Entity('stock_reservations')
export class StockReservation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'inventory_item_id', type: 'uuid' }) inventoryItemId!: string;
  @Column({ name: 'warehouse_id', type: 'uuid' }) warehouseId!: string;
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;
  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;
  @Column({ name: 'order_item_id', type: 'uuid', nullable: true })
  orderItemId!: string | null;
  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;
  @Column({ type: 'integer' }) quantity!: number;
  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: StockReservationStatus;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export type ProcurementStatus =
  | 'open'
  | 'ordered'
  | 'received'
  | 'dropshipped'
  | 'fulfilled'
  | 'cancelled';
export type ProcurementReason = 'order' | 'reorder' | 'manual';

/**
 * A need to acquire stock that is not on hand — usually an order line that could not be
 * fully reserved. Grouped into purchase orders; on receipt the stock is reserved for the
 * waiting order (receive-to-order). Dropship requests never touch a warehouse.
 */
@Entity('procurement_requests')
export class ProcurementRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'inventory_item_id', type: 'uuid' }) inventoryItemId!: string;
  @Column({ type: 'integer' }) quantity!: number;
  @Column({ name: 'received_qty', type: 'integer', default: 0 })
  receivedQty!: number;
  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: ProcurementStatus;
  @Column({ type: 'varchar', length: 20, default: 'order' })
  reason!: ProcurementReason;
  @Column({
    name: 'fulfillment_mode',
    type: 'varchar',
    length: 20,
    default: 'ship_to_warehouse',
  })
  fulfillmentMode!: 'ship_to_warehouse' | 'dropship';
  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId!: string | null;
  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId!: string | null;
  /** Warehouse the goods will be received into (ship_to_warehouse). */
  @Column({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId!: string | null;
  @Column({ name: 'purchase_order_id', type: 'uuid', nullable: true })
  purchaseOrderId!: string | null;
  @Column({ name: 'purchase_order_line_id', type: 'uuid', nullable: true })
  purchaseOrderLineId!: string | null;
  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;
  @Column({ name: 'order_item_id', type: 'uuid', nullable: true })
  orderItemId!: string | null;
  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;
  @Column({
    name: 'estimated_unit_cost',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  estimatedUnitCost!: string | null;
  @Column({ name: 'needed_by', type: 'timestamptz', nullable: true })
  neededBy!: Date | null;
  @Column({
    name: 'supplier_tracking',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  supplierTracking!: string | null;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
