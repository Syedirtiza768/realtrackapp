import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SupplierType =
  | 'distributor'
  | 'manufacturer'
  | 'marketplace'
  | 'salvage_yard'
  | 'individual'
  | 'other';

/** Where stock is acquired from when it is not on hand. */
@Entity('suppliers')
@Index('uq_suppliers_org_code', ['organizationId', 'code'], { unique: true })
export class Supplier {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ type: 'varchar', length: 40 }) code!: string;
  @Column({ type: 'varchar', length: 160 }) name!: string;
  @Column({ type: 'varchar', length: 20, default: 'distributor' })
  type!: SupplierType;
  @Column({ name: 'contact_name', type: 'varchar', length: 120, nullable: true })
  contactName!: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;
  @Column({ type: 'varchar', length: 60, nullable: true })
  phone!: string | null;
  @Column({ type: 'text', nullable: true }) website!: string | null;
  @Column({ type: 'varchar', length: 3, default: 'USD' }) currency!: string;
  @Column({ name: 'default_lead_time_days', type: 'integer', default: 3 })
  defaultLeadTimeDays!: number;
  @Column({ name: 'supports_dropship', type: 'boolean', default: false })
  supportsDropship!: boolean;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export type SourceFulfillmentMode = 'ship_to_warehouse' | 'dropship';

/** A supplier offer for a SKU: cost, availability, lead time, and who ships to the buyer. */
@Entity('inventory_item_sources')
@Index('uq_iis_item_supplier', ['inventoryItemId', 'supplierId'], {
  unique: true,
})
export class InventoryItemSource {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'inventory_item_id', type: 'uuid' }) inventoryItemId!: string;
  @Column({ name: 'supplier_id', type: 'uuid' }) supplierId!: string;
  @Column({ name: 'supplier_sku', type: 'varchar', length: 160, nullable: true })
  supplierSku!: string | null;
  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  unitCost!: string | null;
  @Column({ type: 'varchar', length: 3, default: 'USD' }) currency!: string;
  /** Supplier-reported availability; null = unknown (advertised as 0). */
  @Column({ name: 'available_qty', type: 'integer', nullable: true })
  availableQty!: number | null;
  @Column({ name: 'lead_time_days', type: 'integer', nullable: true })
  leadTimeDays!: number | null;
  /** Lower = preferred. */
  @Column({ type: 'integer', default: 100 }) priority!: number;
  @Column({
    name: 'fulfillment_mode',
    type: 'varchar',
    length: 20,
    default: 'ship_to_warehouse',
  })
  fulfillmentMode!: SourceFulfillmentMode;
  @Column({ type: 'text', nullable: true }) url!: string | null;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
