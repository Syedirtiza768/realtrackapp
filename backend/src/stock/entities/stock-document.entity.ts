import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StockDocumentType =
  | 'receipt'
  | 'transfer'
  | 'adjustment'
  | 'count'
  | 'purchase_order';

export type StockDocumentStatus =
  | 'draft'
  | 'pending_approval'
  | 'ordered'
  | 'in_transit'
  | 'partially_received'
  | 'completed'
  | 'cancelled';

/** Header for multi-line stock operations: GRN, transfer, adjustment, count, purchase order. */
@Entity('stock_documents')
export class StockDocument {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'doc_type', type: 'varchar', length: 20 })
  docType!: StockDocumentType;
  @Column({ name: 'doc_number', type: 'varchar', length: 40 })
  docNumber!: string;
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: StockDocumentStatus;
  /** Source warehouse (transfer/adjust/count) or receiving warehouse (receipt/PO). */
  @Column({ name: 'warehouse_id', type: 'uuid' }) warehouseId!: string;
  @Column({ name: 'dest_warehouse_id', type: 'uuid', nullable: true })
  destWarehouseId!: string | null;
  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId!: string | null;
  @Column({ name: 'reason_code', type: 'varchar', length: 40, nullable: true })
  reasonCode!: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true })
  reference!: string | null;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ name: 'expected_at', type: 'timestamptz', nullable: true })
  expectedAt!: Date | null;
  @Column({ type: 'varchar', length: 3, nullable: true })
  currency!: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;
  @Column({ name: 'completed_by', type: 'uuid', nullable: true })
  completedBy!: string | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('stock_document_lines')
export class StockDocumentLine {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'document_id', type: 'uuid' }) documentId!: string;
  @Column({ name: 'inventory_item_id', type: 'uuid' }) inventoryItemId!: string;
  /** Source bin (transfer/adjust/count) or destination bin (receipt/PO). */
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;
  /** Destination bin for transfers. */
  @Column({ name: 'dest_location_id', type: 'uuid', nullable: true })
  destLocationId!: string | null;
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;
  /** Requested / ordered quantity, or the signed delta for adjustments. */
  @Column({ type: 'integer', default: 0 }) quantity!: number;
  /** Received / shipped so far (PO, transfer). */
  @Column({ name: 'processed_qty', type: 'integer', default: 0 })
  processedQty!: number;
  @Column({ name: 'counted_qty', type: 'integer', nullable: true })
  countedQty!: number | null;
  @Column({ name: 'system_qty', type: 'integer', nullable: true })
  systemQty!: number | null;
  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  unitCost!: string | null;
  @Column({ type: 'text', array: true, default: '{}' }) serials!: string[];
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
