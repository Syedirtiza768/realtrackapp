import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ChannelConnection } from './channel-connection.entity.js';

/**
 * Store entity — represents a specific storefront within a channel connection.
 * Example: One eBay account may have multiple eBay stores.
 * A Shopify connection may represent a single store, but the model allows multiples.
 */
@Entity('stores')
@Index('idx_store_connection', ['connectionId'])
@Index('idx_store_channel_name', ['channel', 'storeName'])
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId!: string;

  @ManyToOne(() => ChannelConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection!: ChannelConnection;

  @Column({ type: 'varchar', length: 30 })
  channel!: string; // 'ebay' | 'shopify' | 'amazon' | 'walmart'

  @Column({ name: 'store_name', type: 'varchar', length: 200 })
  storeName!: string;

  @Column({ name: 'store_url', type: 'text', nullable: true })
  storeUrl!: string | null;

  @Column({ name: 'external_store_id', type: 'varchar', length: 200, nullable: true })
  externalStoreId!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'paused' | 'suspended' | 'archived';

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  /** Per-store configuration: pricing rules, shipping defaults, etc. */
  @Column({ type: 'jsonb', default: '{}' })
  config!: Record<string, unknown>;

  /** Per-store metrics cache */
  @Column({ name: 'metrics_cache', type: 'jsonb', default: '{}' })
  metricsCache!: Record<string, unknown>;

  @Column({ name: 'listing_count', type: 'integer', default: 0 })
  listingCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
