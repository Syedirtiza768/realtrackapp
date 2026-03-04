import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { Store } from '../../channels/entities/store.entity.js';

/**
 * Per-store inventory allocation.
 * Only used when feature flag `per_store_inventory` is ON.
 *
 * Tracks how much stock is allocated to a specific store
 * and how much is reserved (pending orders).
 *
 * available_qty = allocated_qty - reserved_qty (generated column in DB).
 */
@Entity('store_inventory_allocations')
@Index('idx_sia_listing', ['listingId'])
@Index('idx_sia_store', ['storeId'])
@Index('idx_sia_listing_store', ['listingId', 'storeId'], { unique: true })
export class StoreInventoryAllocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @ManyToOne(() => ListingRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: ListingRecord;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store!: Store;

  @Column({ name: 'allocated_qty', type: 'integer', default: 0 })
  allocatedQty!: number;

  @Column({ name: 'reserved_qty', type: 'integer', default: 0 })
  reservedQty!: number;

  /** Computed: allocatedQty - reservedQty (DB generated column, read-only) */
  @Column({
    name: 'available_qty',
    type: 'integer',
    insert: false,
    update: false,
    nullable: true,
  })
  availableQty!: number | null;

  @VersionColumn()
  version!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
