import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WarehouseType = 'owned' | '3pl' | 'virtual';

/** Physical (or virtual) stock-holding site. Supersedes fashion_warehouses for stock. */
@Entity('warehouses')
@Index('uq_warehouses_org_code', ['organizationId', 'code'], { unique: true })
export class Warehouse {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ type: 'varchar', length: 40 }) code!: string;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 20, default: 'owned' })
  type!: WarehouseType;
  @Column({ type: 'jsonb', nullable: true })
  address!: Record<string, string> | null;
  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode!: string | null;
  @Column({ type: 'varchar', length: 60, nullable: true })
  timezone!: string | null;
  /** eBay Inventory API merchantLocationKey this warehouse ships from. */
  @Column({
    name: 'ebay_merchant_location_key',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  ebayMerchantLocationKey!: string | null;
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;
  /** Stock here counts towards channel quantity (off for returns/quarantine sites). */
  @Column({ name: 'is_sellable', type: 'boolean', default: true })
  isSellable!: boolean;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @Column({ name: 'legacy_fashion_warehouse_id', type: 'uuid', nullable: true })
  legacyFashionWarehouseId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export type WarehouseLocationType =
  | 'storage'
  | 'receiving'
  | 'staging'
  | 'returns'
  | 'quarantine';

/** A bin / shelf position inside a warehouse. */
@Entity('warehouse_locations')
@Index('uq_wl_warehouse_code', ['warehouseId', 'code'], { unique: true })
export class WarehouseLocation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'warehouse_id', type: 'uuid' }) warehouseId!: string;
  @Column({ type: 'varchar', length: 60 }) code!: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) zone!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) aisle!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) rack!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) shelf!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) bin!: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true })
  barcode!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'storage' })
  type!: WarehouseLocationType;
  @Column({ name: 'is_pickable', type: 'boolean', default: true })
  isPickable!: boolean;
  @Column({ name: 'capacity_units', type: 'integer', nullable: true })
  capacityUnits!: number | null;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
