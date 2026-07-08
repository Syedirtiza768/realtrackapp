import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { EbayPublishedListingBulkJobItem } from './ebay-published-listing-bulk-job-item.entity.js';

export type BulkJobAction =
  | 'update_price'
  | 'update_quantity'
  | 'update_title'
  | 'update_description'
  | 'update_policies'
  | 'end_listing'
  | 'sync'
  | 'health_check'
  | 'competitor_pricing';

export type BulkJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partial';

@Entity('ebay_published_listing_bulk_jobs')
@Index('idx_epl_bulk_org', ['organizationId'])
@Index('idx_epl_bulk_status', ['status'])
export class EbayPublishedListingBulkJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'requested_by_user_id', type: 'uuid' })
  requestedByUserId!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedByUser!: User;

  @Column({ name: 'action_type', type: 'varchar', length: 40 })
  actionType!: BulkJobAction;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: BulkJobStatus;

  @Column({ name: 'action_payload', type: 'jsonb', nullable: true })
  actionPayload!: Record<string, unknown> | null;

  @Column({ name: 'total_items', type: 'int', default: 0 })
  totalItems!: number;

  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount!: number;

  @Column({ name: 'failure_count', type: 'int', default: 0 })
  failureCount!: number;

  @OneToMany(() => EbayPublishedListingBulkJobItem, (i) => i.bulkJob)
  items!: EbayPublishedListingBulkJobItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
