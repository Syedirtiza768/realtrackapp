import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  ComplianceDecision,
  ComplianceFix,
  ComplianceIssue,
} from '../fashion-compliance.rules.js';

/**
 * Listing state machine:
 * UNPUBLISHED → IMAGES_PROCESSING → IMAGES_READY → COMPLIANCE_CHECK →
 *   (NEEDS_REVIEW | BLOCKED | READY) → PUBLISHING → PUBLISHED | FAILED
 */
export const FASHION_PIPELINE_STATES = [
  'UNPUBLISHED',
  'IMAGES_PROCESSING',
  'IMAGES_READY',
  'COMPLIANCE_CHECK',
  'NEEDS_REVIEW',
  'BLOCKED',
  'READY',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED',
] as const;
export type FashionPipelineState = (typeof FASHION_PIPELINE_STATES)[number];

export type ImageVariantName =
  | 'original'
  | 'thumb'
  | 'small'
  | 'large'
  | 'ebay_master';

export interface PipelineImage {
  index: number;
  sourceUrl: string;
  hash: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  keys: Partial<Record<ImageVariantName, string>>;
  urls: Partial<Record<ImageVariantName, string>>;
  /** below_min (<500px longest side), low_quality (<1600px). */
  flags: string[];
  /** Set when the image is left out of the eBay set, with the reason code. */
  excluded: { code: string; reason: string } | null;
  error: string | null;
  /** True when the S3 objects already existed (idempotent re-run). */
  reused?: boolean;
}

export interface AiSuggestion {
  before: { title: string; description: string | null; brand: string | null };
  after: { title: string; description: string | null; brand: string | null };
  rationale: string;
  model: string | null;
  status: 'pending' | 'applied' | 'rejected' | 'edited';
  createdAt: string;
}

/** One row per Fashion catalog product: its current place in the pipeline. */
@Entity('fashion_listing_pipeline')
@Index('idx_flp_org_state', ['organizationId', 'state'])
export class FashionListingPipeline {
  @PrimaryColumn({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 24, default: 'UNPUBLISHED' })
  state!: FashionPipelineState;

  /** Batch currently working on this listing; null when at rest. */
  @Column({ name: 'active_batch_id', type: 'uuid', nullable: true })
  activeBatchId!: string | null;

  @Column({ name: 'last_batch_id', type: 'uuid', nullable: true })
  lastBatchId!: string | null;

  @Column({
    name: 'compliance_result',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  complianceResult!: ComplianceDecision | null;

  @Column({ name: 'risk_score', type: 'int', nullable: true })
  riskScore!: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  issues!: ComplianceIssue[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  fixes!: ComplianceFix[];

  @Column({ type: 'jsonb', nullable: true })
  suggestion!: AiSuggestion | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images!: PipelineImage[];

  /** Raw vision verdict, cached by `visionFingerprint` to avoid re-paying. */
  @Column({ name: 'vision_result', type: 'jsonb', nullable: true })
  visionResult!: Record<string, unknown> | null;

  @Column({
    name: 'vision_fingerprint',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  visionFingerprint!: string | null;

  /** S3 URLs of the eBay JPEG masters, in listing order (first = main photo). */
  @Column({
    name: 'ebay_master_urls',
    type: 'text',
    array: true,
    default: '{}',
  })
  ebayMasterUrls!: string[];

  /** eBay Picture Services URLs returned for the masters at publish time. */
  @Column({
    name: 'ebay_image_urls',
    type: 'text',
    array: true,
    default: '{}',
  })
  ebayImageUrls!: string[];

  @Column({ name: 'checked_at', type: 'timestamptz', nullable: true })
  checkedAt!: Date | null;

  @Column({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId!: string | null;

  @Column({ name: 'publish_attempt', type: 'int', default: 0 })
  publishAttempt!: number;

  @Column({ name: 'listing_job_id', type: 'uuid', nullable: true })
  listingJobId!: string | null;

  @Column({ name: 'ebay_account_id', type: 'uuid', nullable: true })
  ebayAccountId!: string | null;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30, nullable: true })
  marketplaceId!: string | null;

  @Column({ name: 'ebay_item_id', type: 'text', nullable: true })
  ebayItemId!: string | null;

  @Column({ name: 'ebay_offer_id', type: 'text', nullable: true })
  ebayOfferId!: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export type FashionBatchStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'cancelled';

@Entity('fashion_publish_batches')
@Index('idx_fpb_org_created', ['organizationId', 'createdAt'])
export class FashionPublishBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'requested_by_user_id', type: 'uuid' })
  requestedByUserId!: string;

  @Column({ name: 'requested_size', type: 'int' })
  requestedSize!: number;

  @Column({ name: 'dry_run', type: 'boolean', default: true })
  dryRun!: boolean;

  @Column({ name: 'ebay_account_id', type: 'uuid', nullable: true })
  ebayAccountId!: string | null;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30, nullable: true })
  marketplaceId!: string | null;

  /** Reviewer who confirmed authenticity for listings that pass compliance. */
  @Column({ name: 'confirmed_by_user_id', type: 'uuid', nullable: true })
  confirmedByUserId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'queued' })
  status!: FashionBatchStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/** Listing membership in a batch, with the outcome this batch produced. */
@Entity('fashion_publish_batch_items')
@Index('uq_fpbi_batch_product', ['batchId', 'catalogProductId'], {
  unique: true,
})
@Index('idx_fpbi_product', ['catalogProductId'])
export class FashionPublishBatchItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string;

  /** Stable pick order within the batch. */
  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'varchar', length: 24, default: 'UNPUBLISHED' })
  state!: FashionPipelineState;

  @Column({
    name: 'compliance_result',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  complianceResult!: ComplianceDecision | null;

  @Column({ name: 'risk_score', type: 'int', nullable: true })
  riskScore!: number | null;

  @Column({ name: 'issue_codes', type: 'text', array: true, default: '{}' })
  issueCodes!: string[];

  @Column({ name: 'ebay_item_id', type: 'text', nullable: true })
  ebayItemId!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/** Per-organization override of the compliance rule lists. */
@Entity('fashion_compliance_configs')
export class FashionComplianceConfigRow {
  @PrimaryColumn({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  config!: Record<string, unknown>;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
