import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PipelineJobStatus =
  | 'pending'
  | 'uploading'
  | 'vin_decode'
  | 'category_mapping'
  | 'enrichment'
  | 'validation'
  | 'output_generation'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Tracks enrichment pipeline jobs that process an input Excel/CSV file
 * through VIN decode → eBay category mapping → OpenAI enrichment → multi-template output.
 *
 * This is ADDITIVE — does not modify the existing IngestionJob entity.
 */
@Entity('pipeline_jobs')
@Index('idx_pipeline_job_status', ['status'])
export class PipelineJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: PipelineJobStatus;

  // ─── Input file tracking ───
  @Column({ name: 'original_filename', type: 'varchar', length: 500 })
  originalFilename!: string;

  @Column({ name: 'stored_file_path', type: 'varchar', length: 1000, nullable: true })
  storedFilePath!: string | null;

  @Column({ name: 'file_size_bytes', type: 'integer', nullable: true })
  fileSizeBytes!: number | null;

  // ─── Processing stats ───
  @Column({ name: 'total_parts', type: 'integer', default: 0 })
  totalParts!: number;

  @Column({ name: 'processed_parts', type: 'integer', default: 0 })
  processedParts!: number;

  @Column({ name: 'vin_decode_success', type: 'integer', default: 0 })
  vinDecodeSuccess!: number;

  @Column({ name: 'vin_decode_failed', type: 'integer', default: 0 })
  vinDecodeFailed!: number;

  @Column({ name: 'category_api_count', type: 'integer', default: 0 })
  categoryApiCount!: number;

  @Column({ name: 'category_fallback_count', type: 'integer', default: 0 })
  categoryFallbackCount!: number;

  @Column({ name: 'enriched_count', type: 'integer', default: 0 })
  enrichedCount!: number;

  @Column({ name: 'fallback_count', type: 'integer', default: 0 })
  fallbackCount!: number;

  @Column({ name: 'openai_tokens_used', type: 'integer', default: 0 })
  openaiTokensUsed!: number;

  @Column({
    name: 'openai_cost_usd',
    type: 'numeric',
    precision: 8,
    scale: 4,
    default: 0,
  })
  openaiCostUsd!: number;

  // ─── Output files ───
  @Column({ name: 'output_us_path', type: 'varchar', length: 1000, nullable: true })
  outputUsPath!: string | null;

  @Column({ name: 'output_au_path', type: 'varchar', length: 1000, nullable: true })
  outputAuPath!: string | null;

  @Column({ name: 'output_de_path', type: 'varchar', length: 1000, nullable: true })
  outputDePath!: string | null;

  @Column({ name: 'report_path', type: 'varchar', length: 1000, nullable: true })
  reportPath!: string | null;

  // ─── Mandatory listing optimization (post-enrichment) ───
  @Column({ name: 'optimization_status', type: 'varchar', length: 32, default: 'pending' })
  optimizationStatus!: string;

  @Column({ name: 'optimization_processed', type: 'integer', default: 0 })
  optimizationProcessed!: number;

  @Column({ name: 'optimization_total', type: 'integer', default: 0 })
  optimizationTotal!: number;

  @Column({ name: 'optimization_pass_count', type: 'integer', default: 0 })
  optimizationPassCount!: number;

  @Column({ name: 'optimization_review_count', type: 'integer', default: 0 })
  optimizationReviewCount!: number;

  @Column({ name: 'optimization_block_count', type: 'integer', default: 0 })
  optimizationBlockCount!: number;

  // ─── Progress detail (JSON for real-time update) ───
  @Column({ name: 'stage_details', type: 'jsonb', default: '{}' })
  stageDetails!: Record<string, unknown>;

  // ─── Error tracking ───
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'error_count', type: 'integer', default: 0 })
  errorCount!: number;

  // ─── Metadata ───
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
