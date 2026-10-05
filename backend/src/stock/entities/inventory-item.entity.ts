import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TrackingMode = 'quantity' | 'serial' | 'one_off';
/**
 * stocked   — sold only from on-hand stock.
 * on_demand — never held; acquired from a supplier after each sale.
 * hybrid    — sold from on-hand first, remainder acquired from a supplier.
 */
export type SourcingMode = 'stocked' | 'on_demand' | 'hybrid';
export type InventoryItemStatus = 'active' | 'discontinued' | 'archived';

/** SKU master: one row per organization + SKU, linked to the vertical's product record. */
@Entity('inventory_items')
@Index('uq_ii_org_sku', ['organizationId', 'sku'], { unique: true })
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ type: 'varchar', length: 32, default: 'automotive' })
  vertical!: string;
  @Column({ type: 'varchar', length: 160 }) sku!: string;
  @Column({ type: 'text', nullable: true }) title!: string | null;
  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;
  @Column({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId!: string | null;
  @Column({ name: 'listing_record_id', type: 'uuid', nullable: true })
  listingRecordId!: string | null;
  @Column({ name: 'product_variant_id', type: 'uuid', nullable: true })
  productVariantId!: string | null;
  @Column({
    name: 'tracking_mode',
    type: 'varchar',
    length: 12,
    default: 'quantity',
  })
  trackingMode!: TrackingMode;
  @Column({
    name: 'sourcing_mode',
    type: 'varchar',
    length: 12,
    default: 'stocked',
  })
  sourcingMode!: SourcingMode;
  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  unitCost!: string | null;
  @Column({ type: 'varchar', length: 3, default: 'USD' }) currency!: string;
  @Column({ type: 'varchar', length: 80, nullable: true })
  barcode!: string | null;
  @Column({ name: 'low_stock_threshold', type: 'integer', default: 1 })
  lowStockThreshold!: number;
  @Column({ name: 'reorder_point', type: 'integer', default: 0 })
  reorderPoint!: number;
  @Column({ name: 'reorder_qty', type: 'integer', default: 0 })
  reorderQty!: number;
  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: InventoryItemStatus;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Projection of stock per item × warehouse × bin. Written ONLY by StockLedgerService,
 * in the same transaction as the stock_movements rows that explain it.
 */
@Entity('stock_levels')
export class StockLevel {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'inventory_item_id', type: 'uuid' }) inventoryItemId!: string;
  @Column({ name: 'warehouse_id', type: 'uuid' }) warehouseId!: string;
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;
  @Column({ name: 'on_hand', type: 'integer', default: 0 }) onHand!: number;
  @Column({ type: 'integer', default: 0 }) reserved!: number;
  @Column({ type: 'integer', default: 0 }) damaged!: number;
  /** On order from suppliers / in transit to this warehouse. */
  @Column({ type: 'integer', default: 0 }) inbound!: number;
  @Column({ type: 'integer', insert: false, update: false, nullable: true })
  available!: number | null;
  @Column({ name: 'last_received_at', type: 'timestamptz', nullable: true })
  lastReceivedAt!: Date | null;
  @Column({ type: 'integer', default: 1 }) version!: number;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export type InventoryUnitStatus =
  | 'available'
  | 'reserved'
  | 'picked'
  | 'shipped'
  | 'returned'
  | 'quarantined'
  | 'written_off';

/** One physical piece for serial / one-off tracked items (B&I serials, donor parts, garments). */
@Entity('inventory_units')
export class InventoryUnit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'inventory_item_id', type: 'uuid' }) inventoryItemId!: string;
  @Column({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId!: string | null;
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;
  /** Permission-gated (stock.serials.private). */
  @Column({ name: 'serial_private', type: 'text', nullable: true })
  serialPrivate!: string | null;
  @Column({ name: 'serial_public', type: 'text', nullable: true })
  serialPublic!: string | null;
  /** Lot / batch; donor VIN for salvaged auto parts. */
  @Column({ name: 'lot_code', type: 'varchar', length: 80, nullable: true })
  lotCode!: string | null;
  @Column({ name: 'condition_id', type: 'varchar', length: 40, nullable: true })
  conditionId!: string | null;
  @Column({ type: 'varchar', length: 16, default: 'available' })
  status!: InventoryUnitStatus;
  @Column({ name: 'reservation_id', type: 'uuid', nullable: true })
  reservationId!: string | null;
  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  unitCost!: string | null;
  /** External origin, e.g. `bi_unit:<business_industrial_units.id>`. */
  @Column({ name: 'source_ref', type: 'varchar', length: 120, nullable: true })
  sourceRef!: string | null;
  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
