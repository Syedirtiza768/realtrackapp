import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ChannelConnection } from './channel-connection.entity.js';
import { Store } from './store.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';

/**
 * ListingChannelInstance — represents a specific instance of a listing
 * published to a specific store within a channel. This extends the concept
 * of channel_listings to support multi-store per channel with per-store
 * price/quantity overrides.
 *
 * Hierarchy: ListingRecord → ListingChannelInstance → Store → ChannelConnection
 */
@Entity('listing_channel_instances')
@Index('idx_lci_listing', ['listingId'])
@Index('idx_lci_store', ['storeId'])
@Index('idx_lci_connection', ['connectionId'])
@Index('idx_lci_listing_store', ['listingId', 'storeId'], { unique: true })
@Index('idx_lci_external', ['externalId'])
@Index('idx_lci_sync_status', ['syncStatus'])
export class ListingChannelInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @ManyToOne(() => ListingRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: ListingRecord;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId!: string;

  @ManyToOne(() => ChannelConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection!: ChannelConnection;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store!: Store;

  @Column({ type: 'varchar', length: 30 })
  channel!: string; // 'ebay' | 'shopify' | 'amazon' | 'walmart'

  // ─── External marketplace data ───
  @Column({ name: 'external_id', type: 'varchar', length: 200, nullable: true })
  externalId!: string | null;

  @Column({ name: 'external_url', type: 'text', nullable: true })
  externalUrl!: string | null;

  // ─── Per-store overrides ───
  @Column({ name: 'override_price', type: 'numeric', precision: 10, scale: 2, nullable: true })
  overridePrice!: number | null;

  @Column({ name: 'override_quantity', type: 'integer', nullable: true })
  overrideQuantity!: number | null;

  @Column({ name: 'override_title', type: 'text', nullable: true })
  overrideTitle!: string | null;

  /** Per-instance overrides as JSON (shipping, handling time, return policy, etc.) */
  @Column({ name: 'channel_specific_data', type: 'jsonb', default: '{}' })
  channelSpecificData!: Record<string, unknown>;

  // ─── Sync state ───
  @Column({ name: 'sync_status', type: 'varchar', length: 20, default: 'pending' })
  syncStatus!: 'synced' | 'pending' | 'publishing' | 'error' | 'ended' | 'draft';

  @Column({ name: 'last_pushed_version', type: 'integer', nullable: true })
  lastPushedVersion!: number | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  /** Whether this was published in demo mode */
  @Column({ name: 'is_demo', type: 'boolean', default: false })
  isDemo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
