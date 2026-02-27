import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { ListingRecord } from '../../listings/listing-record.entity.js';

/**
 * AiEnhancement — tracks AI-generated improvements for a listing.
 * Supports: title optimization, description generation, item specifics,
 *           fitment detection, image enhancement.
 *
 * Workflow: requested → processing → generated → approved/rejected
 * Each listing can have multiple enhancements (one per type), with versioning.
 */
@Entity('ai_enhancements')
@Index('idx_ai_enh_listing', ['listingId'])
@Index('idx_ai_enh_type', ['enhancementType'])
@Index('idx_ai_enh_status', ['status'])
@Index('idx_ai_enh_listing_type', ['listingId', 'enhancementType'])
export class AiEnhancement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @ManyToOne(() => ListingRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: ListingRecord;

  @Column({ name: 'enhancement_type', type: 'varchar', length: 30 })
  enhancementType!:
    | 'title_optimization'
    | 'description_generation'
    | 'item_specifics'
    | 'fitment_detection'
    | 'image_enhancement';

  // ─── Status workflow ───
  @Column({ type: 'varchar', length: 20, default: 'requested' })
  status!: 'requested' | 'processing' | 'generated' | 'approved' | 'rejected';

  // ─── Input snapshot (what AI received) ───
  @Column({ name: 'input_data', type: 'jsonb', default: '{}' })
  inputData!: Record<string, unknown>;

  // ─── AI Output ───
  @Column({ name: 'original_value', type: 'text', nullable: true })
  originalValue!: string | null;

  @Column({ name: 'enhanced_value', type: 'text', nullable: true })
  enhancedValue!: string | null;

  /** Structured output for complex types (item_specifics, fitment_detection) */
  @Column({ name: 'enhanced_data', type: 'jsonb', nullable: true })
  enhancedData!: Record<string, unknown> | null;

  /** Detailed diff between original and enhanced */
  @Column({ type: 'jsonb', nullable: true })
  diff!: Record<string, unknown> | null;

  // ─── AI Metadata ───
  @Column({ type: 'varchar', length: 50, nullable: true })
  provider!: string | null; // 'openai' | 'anthropic' | 'demo'

  @Column({ type: 'varchar', length: 50, nullable: true })
  model!: string | null; // 'gpt-4o' | 'claude-3.5-sonnet' | 'demo-sim'

  @Column({ name: 'confidence_score', type: 'real', nullable: true })
  confidenceScore!: number | null;

  @Column({ name: 'tokens_used', type: 'integer', nullable: true })
  tokensUsed!: number | null;

  @Column({ name: 'latency_ms', type: 'integer', nullable: true })
  latencyMs!: number | null;

  @Column({ name: 'cost_usd', type: 'numeric', precision: 8, scale: 6, nullable: true })
  costUsd!: number | null;

  // ─── Versioning ───
  @VersionColumn()
  version!: number;

  @Column({ name: 'enhancement_version', type: 'integer', default: 1 })
  enhancementVersion!: number;

  // ─── Approval ───
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt!: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
