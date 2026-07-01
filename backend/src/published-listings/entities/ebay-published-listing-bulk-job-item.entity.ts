import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EbayPublishedListing } from './ebay-published-listing.entity.js';
import { EbayPublishedListingBulkJob } from './ebay-published-listing-bulk-job.entity.js';

export type BulkJobItemStatus = 'pending' | 'success' | 'failed' | 'skipped';

@Entity('ebay_published_listing_bulk_job_items')
@Index('idx_epl_bulk_item_job', ['bulkJobId'])
@Index('idx_epl_bulk_item_listing', ['publishedListingId'])
export class EbayPublishedListingBulkJobItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'bulk_job_id', type: 'uuid' })
  bulkJobId!: string;

  @ManyToOne(() => EbayPublishedListingBulkJob, (j) => j.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bulk_job_id' })
  bulkJob!: EbayPublishedListingBulkJob;

  @Column({ name: 'published_listing_id', type: 'uuid' })
  publishedListingId!: string;

  @ManyToOne(() => EbayPublishedListing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'published_listing_id' })
  publishedListing!: EbayPublishedListing;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: BulkJobItemStatus;

  @Column({ name: 'before_snapshot', type: 'jsonb', nullable: true })
  beforeSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'after_snapshot', type: 'jsonb', nullable: true })
  afterSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;
}
