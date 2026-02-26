import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ListingRecord } from '../../listings/listing-record.entity.js';

export type IngestionJobStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'ai_complete'
  | 'review_required'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export type IngestionMode = 'single' | 'bulk' | 'bundle';
export type SourceType = 'upload' | 'camera' | 'url' | 'api';
export type ReviewStatus =
  | 'pending'
  | 'auto_approved'
  | 'needs_review'
  | 'approved'
  | 'rejected';

@Entity('ingestion_jobs')
@Index('idx_job_status', ['status'])
@Index('idx_job_review', ['reviewStatus'], {
  where: `"review_status" = 'needs_review'`,
})
export class IngestionJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: IngestionJobStatus;

  @Column({ type: 'varchar', length: 20 })
  mode!: IngestionMode;

  // ─── Source tracking ───
  @Column({ name: 'source_type', type: 'varchar', length: 20, default: 'upload' })
  sourceType!: SourceType;

  @Column({ name: 'image_count', type: 'integer', default: 0 })
  imageCount!: number;

  // ─── AI processing ───
  @Column({ name: 'ai_provider', type: 'varchar', length: 30, nullable: true })
  aiProvider!: string | null;

  @Column({ name: 'ai_model', type: 'varchar', length: 50, nullable: true })
  aiModel!: string | null;

  @Column({ name: 'ai_started_at', type: 'timestamptz', nullable: true })
  aiStartedAt!: Date | null;

  @Column({ name: 'ai_completed_at', type: 'timestamptz', nullable: true })
  aiCompletedAt!: Date | null;

  @Column({ name: 'ai_cost_usd', type: 'numeric', precision: 8, scale: 4, nullable: true })
  aiCostUsd!: number | null;

  // ─── Review ───
  @Column({
    name: 'review_status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  reviewStatus!: ReviewStatus;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes!: string | null;

  // ─── Result ───
  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId!: string | null;

  @ManyToOne(() => ListingRecord, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'listing_id' })
  listing?: ListingRecord;

  // ─── Retry ───
  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ name: 'max_attempts', type: 'integer', default: 3 })
  maxAttempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt!: Date | null;

  // ─── Metadata ───
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
