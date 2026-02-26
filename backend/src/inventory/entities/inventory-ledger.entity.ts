import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
  VersionColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ListingRecord } from '../../listings/listing-record.entity.js';

@Entity('inventory_ledger')
@Index('idx_ledger_low_stock', ['quantityTotal'], {
  where: '"quantity_total" - "quantity_reserved" <= "low_stock_threshold"',
})
export class InventoryLedger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid', unique: true })
  listingId!: string;

  @OneToOne(() => ListingRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: ListingRecord;

  @Column({ name: 'quantity_total', type: 'integer', default: 0 })
  quantityTotal!: number;

  @Column({ name: 'quantity_reserved', type: 'integer', default: 0 })
  quantityReserved!: number;

  /** Computed: quantityTotal - quantityReserved (read from DB) */
  @Column({
    name: 'quantity_available',
    type: 'integer',
    insert: false,
    update: false,
    nullable: true,
  })
  quantityAvailable!: number | null;

  @Column({ name: 'quantity_listed_ebay', type: 'integer', default: 0 })
  quantityListedEbay!: number;

  @Column({ name: 'quantity_listed_shopify', type: 'integer', default: 0 })
  quantityListedShopify!: number;

  @Column({ name: 'low_stock_threshold', type: 'integer', default: 2 })
  lowStockThreshold!: number;

  @Column({ name: 'reorder_point', type: 'integer', default: 0 })
  reorderPoint!: number;

  @VersionColumn()
  version!: number;

  @Column({ name: 'last_reconciled_at', type: 'timestamptz', nullable: true })
  lastReconciledAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
