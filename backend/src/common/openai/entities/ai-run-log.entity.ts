import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ai_run_logs')
@Index('idx_ai_run_logs_part_type', ['partType'])
@Index('idx_ai_run_logs_model', ['model'])
@Index('idx_ai_run_logs_created', ['createdAt'])
@Index('idx_ai_run_logs_sku', ['sku'])
export class AiRunLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku!: string | null;

  @Column({ name: 'part_number', type: 'varchar', length: 80, nullable: true })
  partNumber!: string | null;

  @Column({ name: 'part_type', type: 'varchar', length: 80, nullable: true })
  partType!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  price!: number | null;

  @Column({ name: 'donor_vehicle', type: 'jsonb', nullable: true })
  donorVehicle!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  marketplace!: string | null;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId!: string | null;

  @Column({ name: 'enhancement_id', type: 'uuid', nullable: true })
  enhancementId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  lane!: string;

  @Column({ type: 'varchar', length: 80 })
  model!: string;

  @Column({ type: 'smallint', default: 1 })
  attempt!: number;

  @Column({ name: 'prompt_version', type: 'varchar', length: 40 })
  promptVersion!: string;

  @Column({ name: 'routing_policy_version', type: 'int', nullable: true })
  routingPolicyVersion!: number | null;

  @Column({ name: 'input_tokens', type: 'int', nullable: true })
  inputTokens!: number | null;

  @Column({ name: 'output_tokens', type: 'int', nullable: true })
  outputTokens!: number | null;

  @Column({
    name: 'cost_usd',
    type: 'numeric',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  costUsd!: number | null;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs!: number | null;

  @Column({ name: 'validation_score', type: 'smallint', nullable: true })
  validationScore!: number | null;

  @Column({
    name: 'compliance_score',
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  complianceScore!: number | null;

  @Column({ name: 'hard_fails', type: 'jsonb', default: () => "'[]'" })
  hardFails!: string[];

  @Column({ name: 'soft_fails', type: 'jsonb', default: () => "'[]'" })
  softFails!: string[];

  @Column({ default: false })
  escalated!: boolean;

  @Column({ name: 'passed_gate', default: false })
  passedGate!: boolean;

  @Column({ name: 'fitment_row_count', type: 'int', nullable: true })
  fitmentRowCount!: number | null;

  @Column({
    name: 'fitment_source',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  fitmentSource!: string | null;

  @Column({ name: 'fitment_rows_pre', type: 'int', nullable: true })
  fitmentRowsPre!: number | null;

  @Column({ name: 'fitment_rows_post', type: 'int', nullable: true })
  fitmentRowsPost!: number | null;

  @Column({ name: 'tokens_saved_estimate', type: 'int', nullable: true })
  tokensSavedEstimate!: number | null;

  @Column({ name: 'human_approved', type: 'boolean', nullable: true })
  humanApproved!: boolean | null;

  @Column({ name: 'human_rejected', type: 'boolean', nullable: true })
  humanRejected!: boolean | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ type: 'boolean', nullable: true })
  published!: boolean | null;

  @Column({ name: 'publish_error', type: 'text', nullable: true })
  publishError!: string | null;

  @Column({
    name: 'ebay_category_id',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  ebayCategoryId!: string | null;

  @Column({ name: 'field_edits', type: 'jsonb', nullable: true })
  fieldEdits!: Array<{
    field: string;
    aiValue: string;
    finalValue: string;
  }> | null;

  @Column({ name: 'guard_fixes', type: 'jsonb', nullable: true })
  guardFixes!: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
