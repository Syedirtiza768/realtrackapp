import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IngestionJob } from './ingestion-job.entity.js';

@Entity('ai_results')
@Index('idx_ai_result_job', ['jobId'])
@Index('idx_ai_result_confidence', ['confidenceOverall'])
export class AiResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => IngestionJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job?: IngestionJob;

  // ─── Raw AI response ───
  @Column({ name: 'raw_response', type: 'jsonb' })
  rawResponse!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 30 })
  provider!: string;

  @Column({ type: 'varchar', length: 50 })
  model!: string;

  @Column({ name: 'tokens_used', type: 'integer', nullable: true })
  tokensUsed!: number | null;

  @Column({ name: 'latency_ms', type: 'integer', nullable: true })
  latencyMs!: number | null;

  // ─── Normalized fields (extracted by normalizer) ───
  @Column({ name: 'extracted_title', type: 'text', nullable: true })
  extractedTitle!: string | null;

  @Column({ name: 'extracted_brand', type: 'text', nullable: true })
  extractedBrand!: string | null;

  @Column({ name: 'extracted_mpn', type: 'text', nullable: true })
  extractedMpn!: string | null;

  @Column({ name: 'extracted_oem_number', type: 'text', nullable: true })
  extractedOemNumber!: string | null;

  @Column({ name: 'extracted_part_type', type: 'text', nullable: true })
  extractedPartType!: string | null;

  @Column({ name: 'extracted_condition', type: 'text', nullable: true })
  extractedCondition!: string | null;

  @Column({
    name: 'extracted_price_estimate',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  extractedPriceEstimate!: number | null;

  @Column({ name: 'extracted_description', type: 'text', nullable: true })
  extractedDescription!: string | null;

  @Column({ name: 'extracted_features', type: 'text', array: true, nullable: true })
  extractedFeatures!: string[] | null;

  @Column({ name: 'extracted_fitment_raw', type: 'jsonb', nullable: true })
  extractedFitmentRaw!: Record<string, unknown> | null;

  // ─── Confidence scores (0.0–1.0) ───
  @Column({ name: 'confidence_title', type: 'real', nullable: true })
  confidenceTitle!: number | null;

  @Column({ name: 'confidence_brand', type: 'real', nullable: true })
  confidenceBrand!: number | null;

  @Column({ name: 'confidence_mpn', type: 'real', nullable: true })
  confidenceMpn!: number | null;

  @Column({ name: 'confidence_part_type', type: 'real', nullable: true })
  confidencePartType!: number | null;

  @Column({ name: 'confidence_overall', type: 'real' })
  confidenceOverall!: number;

  // ─── Matching ───
  @Column({ name: 'matched_existing_id', type: 'uuid', nullable: true })
  matchedExistingId!: string | null;

  @Column({ name: 'match_confidence', type: 'real', nullable: true })
  matchConfidence!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
