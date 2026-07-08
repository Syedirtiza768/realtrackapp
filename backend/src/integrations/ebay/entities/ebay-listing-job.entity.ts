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
import { Organization } from '../../../auth/entities/organization.entity.js';
import { User } from '../../../auth/entities/user.entity.js';
import { EbayListingJobTarget } from './ebay-listing-job-target.entity.js';

export type EbayListingJobType =
  | 'publish'
  | 'revise'
  | 'end'
  | 'delete'
  | 'sync';
export type EbayListingJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed';

@Entity('ebay_listing_jobs')
@Index('idx_ebay_jobs_org', ['organizationId'])
export class EbayListingJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'requested_by_user_id', type: 'uuid', nullable: true })
  requestedByUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedByUser!: User | null;

  @Column({ name: 'job_type', type: 'varchar', length: 30 })
  jobType!: EbayListingJobType;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: EbayListingJobStatus;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  idempotencyKey!: string | null;

  @OneToMany(() => EbayListingJobTarget, (t) => t.listingJob)
  targets!: EbayListingJobTarget[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
