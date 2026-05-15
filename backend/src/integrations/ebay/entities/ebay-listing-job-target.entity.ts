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
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
import { EbayListingJob } from './ebay-listing-job.entity.js';

export type EbayListingJobTargetStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped';

@Entity('ebay_listing_job_targets')
@Index('idx_ebay_job_targets_job', ['listingJobId'])
@Index('idx_ebay_job_targets_product', ['catalogProductId'])
export class EbayListingJobTarget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_job_id', type: 'uuid' })
  listingJobId!: string;

  @ManyToOne(() => EbayListingJob, (j) => j.targets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_job_id' })
  listingJob!: EbayListingJob;

  @Column({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string;

  @ManyToOne(() => CatalogProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalog_product_id' })
  catalogProduct!: CatalogProduct;

  @Column({ name: 'ebay_account_id', type: 'uuid' })
  ebayAccountId!: string;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30 })
  marketplaceId!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: EbayListingJobTargetStatus;

  @Column({ name: 'result_payload', type: 'jsonb', nullable: true })
  resultPayload!: Record<string, unknown> | null;

  @Column({ name: 'error_payload', type: 'jsonb', nullable: true })
  errorPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
