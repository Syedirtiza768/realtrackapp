import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PrimemotiveListingChangeType =
  | 'listing.added'
  | 'listing.updated'
  | 'listing.removed';

@Entity('ebay_published_listing_changes')
@Index('idx_epl_changes_org_store_time', [
  'organizationId',
  'storeId',
  'occurredAt',
])
@Index('idx_epl_changes_delivery', ['nextAttemptAt', 'occurredAt'], {
  where: '"delivered_at" IS NULL',
})
export class EbayPublishedListingChange {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bigint', nullable: true })
  sequence!: string | null;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 40 })
  eventType!: PrimemotiveListingChangeType;

  @Column({ name: 'listing_snapshot', type: 'jsonb' })
  listingSnapshot!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'delivery_attempts', type: 'integer', default: 0 })
  deliveryAttempts!: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz' })
  nextAttemptAt!: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'last_delivery_error', type: 'text', nullable: true })
  lastDeliveryError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
