import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

@Entity('validation_results')
@Index('idx_validation_motors_product', ['motorsProductId'])
@Index('idx_validation_publishable', ['publishable'])
export class ValidationResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  motorsProductId: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'boolean', default: false })
  publishable: boolean;

  @Column({ type: 'jsonb', default: [] })
  errors: ValidationIssue[];

  @Column({ type: 'jsonb', default: [] })
  warnings: ValidationIssue[];

  @Column({ type: 'jsonb', default: [] })
  infos: ValidationIssue[];

  // Duplicate detection
  @Column({ type: 'boolean', default: false })
  duplicateDetected: boolean;

  @Column({ type: 'uuid', nullable: true })
  duplicateOfListingId: string | null;

  @Column({ type: 'text', nullable: true })
  duplicateMatchType: string | null; // 'brand_mpn', 'sku', 'title_similarity', 'image_hash'

  // Summary scores
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  overallComplianceScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  aspectCoverage: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  fullPayload: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}

export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: ValidationSeverity;
  suggestion?: string;
}
