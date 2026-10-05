import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Which warehouses feed a sales-channel store (lower priority = allocated first). */
@Entity('store_warehouse_links')
export class StoreWarehouseLink {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'store_id', type: 'uuid' }) storeId!: string;
  @Column({ name: 'warehouse_id', type: 'uuid' }) warehouseId!: string;
  @Column({ type: 'integer', default: 100 }) priority!: number;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/** How a store's advertised quantity is derived. push_enabled defaults OFF (shadow mode). */
@Entity('store_stock_policies')
export class StoreStockPolicy {
  @PrimaryColumn({ name: 'store_id', type: 'uuid' }) storeId!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'push_enabled', type: 'boolean', default: false })
  pushEnabled!: boolean;
  @Column({ name: 'buffer_qty', type: 'integer', default: 0 })
  bufferQty!: number;
  @Column({ name: 'max_qty', type: 'integer', nullable: true })
  maxQty!: number | null;
  /** Advertise supplier quantity for on_demand / hybrid items. */
  @Column({ name: 'include_sourceable', type: 'boolean', default: true })
  includeSourceable!: boolean;
  @Column({ name: 'max_sourceable_qty', type: 'integer', default: 5 })
  maxSourceableQty!: number;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export type ChannelSyncStatus =
  | 'pending'
  | 'synced'
  | 'shadow'
  | 'failed'
  | 'no_target'
  | 'paused';

/** Per store × item: the quantity we want shown vs. what we last pushed / saw on the channel. */
@Entity('channel_stock_sync_state')
export class ChannelStockSyncState {
  @PrimaryColumn({ name: 'store_id', type: 'uuid' }) storeId!: string;
  @PrimaryColumn({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ type: 'boolean', default: true }) dirty!: boolean;
  @Column({ name: 'desired_qty', type: 'integer', nullable: true })
  desiredQty!: number | null;
  @Column({ name: 'pushed_qty', type: 'integer', nullable: true })
  pushedQty!: number | null;
  @Column({ name: 'channel_qty', type: 'integer', nullable: true })
  channelQty!: number | null;
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ChannelSyncStatus;
  @Column({ type: 'integer', default: 0 }) attempts!: number;
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
  @Column({ type: 'jsonb', default: [] })
  targets!: Array<Record<string, unknown>>;
  @Column({ name: 'last_pushed_at', type: 'timestamptz', nullable: true })
  lastPushedAt!: Date | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/** Restricts a user to specific warehouses. A user with no rows in an org sees all warehouses. */
@Entity('user_warehouse_assignments')
export class UserWarehouseAssignment {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' }) userId!: string;
  @PrimaryColumn({ name: 'warehouse_id', type: 'uuid' }) warehouseId!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
