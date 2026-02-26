import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('inventory_events')
@Index('idx_event_listing', ['listingId', 'createdAt'])
@Index('idx_event_type', ['eventType', 'createdAt'])
@Index('idx_event_source', ['sourceChannel', 'sourceOrderId'])
export class InventoryEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 30,
  })
  eventType!:
    | 'initial_stock'
    | 'manual_adjust'
    | 'sale'
    | 'return'
    | 'reserve'
    | 'release_reserve'
    | 'sync_correction'
    | 'bulk_import'
    | 'damage_writeoff';

  @Column({ name: 'quantity_change', type: 'integer' })
  quantityChange!: number;

  @Column({ name: 'quantity_before', type: 'integer' })
  quantityBefore!: number;

  @Column({ name: 'quantity_after', type: 'integer' })
  quantityAfter!: number;

  @Column({ name: 'source_channel', type: 'varchar', length: 30, nullable: true })
  sourceChannel!: string | null;

  @Column({ name: 'source_order_id', type: 'varchar', length: 100, nullable: true })
  sourceOrderId!: string | null;

  @Column({ name: 'source_reference', type: 'text', nullable: true })
  sourceReference!: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 200, unique: true, nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
