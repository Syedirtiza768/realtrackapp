import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReviewTaskStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DEFERRED = 'deferred',
  AUTO_RESOLVED = 'auto_resolved',
}

export enum ReviewTaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ReviewTaskReason {
  MULTIPLE_IDENTITIES = 'multiple_identities',
  OCR_CONFLICT = 'ocr_conflict',
  MISSING_FITMENT = 'missing_fitment',
  LOW_CONFIDENCE = 'low_confidence',
  IMAGE_ONLY = 'image_only',
  SUPPLIER_CONFLICT = 'supplier_conflict',
  BRAND_AMBIGUITY = 'brand_ambiguity',
  QUANTITY_AMBIGUITY = 'quantity_ambiguity',
  SIDE_ORIENTATION_CONFLICT = 'side_orientation_conflict',
  FRONT_REAR_CONFLICT = 'front_rear_conflict',
  COMPLIANCE_FAILURE = 'compliance_failure',
  MISSING_REQUIRED_ASPECTS = 'missing_required_aspects',
  TITLE_QUALITY = 'title_quality',
  FITMENT_UNVERIFIED = 'fitment_unverified',
  DUPLICATE_DETECTED = 'duplicate_detected',
}

@Entity('review_tasks')
@Index('idx_review_task_status', ['status'])
@Index('idx_review_task_priority', ['priority'])
@Index('idx_review_task_motors_product', ['motorsProductId'])
@Index('idx_review_task_assigned', ['assignedTo'])
@Index('idx_review_task_org', ['organizationId'])
export class ReviewTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  motorsProductId: string;

  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ type: 'enum', enum: ReviewTaskStatus, default: ReviewTaskStatus.OPEN })
  status: ReviewTaskStatus;

  @Column({ type: 'enum', enum: ReviewTaskPriority, default: ReviewTaskPriority.MEDIUM })
  priority: ReviewTaskPriority;

  @Column({ type: 'enum', enum: ReviewTaskReason })
  reason: ReviewTaskReason;

  @Column({ type: 'text', nullable: true })
  reasonDetail: string | null;

  // Snapshot at time of review creation
  @Column({ type: 'jsonb', nullable: true })
  productSnapshot: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  candidatesSnapshot: any[] | null;

  @Column({ type: 'jsonb', nullable: true })
  extractionSnapshot: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  fitmentSnapshot: any[] | null;

  @Column({ type: 'jsonb', nullable: true })
  validationSnapshot: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  complianceSnapshot: Record<string, any> | null;

  // Assignment
  @Column({ type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date | null;

  // Resolution
  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @Column({ type: 'jsonb', nullable: true })
  resolutionData: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  // Timing
  @Column({ type: 'timestamp', nullable: true })
  dueAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
