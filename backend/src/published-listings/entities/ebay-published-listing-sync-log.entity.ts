import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';

export type PublishedListingSyncStatus = 'pending' | 'running' | 'completed' | 'failed';

@Entity('ebay_published_listing_sync_logs')
@Index('idx_epl_sync_org', ['organizationId'])
@Index('idx_epl_sync_account', ['ebayAccountId'])
@Index('idx_epl_sync_started', ['startedAt'])
export class EbayPublishedListingSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'ebay_account_id', type: 'uuid' })
  ebayAccountId!: string;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30, nullable: true })
  marketplaceId!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'manual' })
  trigger!: 'manual' | 'scheduled' | 'single';

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: PublishedListingSyncStatus;

  @Column({ name: 'triggered_by_user_id', type: 'uuid', nullable: true })
  triggeredByUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'triggered_by_user_id' })
  triggeredByUser!: User | null;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'items_processed', type: 'int', default: 0 })
  itemsProcessed!: number;

  @Column({ name: 'items_created', type: 'int', default: 0 })
  itemsCreated!: number;

  @Column({ name: 'items_updated', type: 'int', default: 0 })
  itemsUpdated!: number;

  @Column({ name: 'items_failed', type: 'int', default: 0 })
  itemsFailed!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors!: Record<string, unknown>[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  warnings!: Record<string, unknown>[];
}
