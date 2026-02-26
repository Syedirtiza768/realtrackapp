import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChannelConnection } from './channel-connection.entity.js';

@Entity('channel_listings')
@Index('idx_channel_listing_conn', ['connectionId'])
@Index('idx_channel_listing_listing', ['listingId'])
@Index('idx_channel_listing_external', ['connectionId', 'externalId'], { unique: true })
export class ChannelListing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId!: string;

  @ManyToOne(() => ChannelConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection!: ChannelConnection;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @Column({ name: 'external_id', type: 'varchar', length: 200 })
  externalId!: string;

  @Column({ name: 'external_url', type: 'varchar', length: 500, nullable: true })
  externalUrl!: string | null;

  @Column({
    name: 'sync_status',
    type: 'varchar',
    length: 20,
    default: 'synced',
  })
  syncStatus!: string; // 'synced' | 'pending' | 'error' | 'ended'

  @Column({ name: 'last_pushed_version', type: 'integer', default: 0 })
  lastPushedVersion!: number;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
