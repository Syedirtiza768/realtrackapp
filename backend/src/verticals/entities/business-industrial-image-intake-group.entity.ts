import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity.js';
import { BusinessIndustrialImageIntakeJob } from './business-industrial-image-intake-job.entity.js';

export type BusinessIndustrialImageIntakeGroupStatus =
  | 'pending'
  | 'processing'
  | 'detected'
  | 'needs_review'
  | 'failed'
  | 'draft_created';

/** One distinct base part. Dot-numbered folder suffixes are retained as instances, not quantities. */
@Entity('business_industrial_image_intake_groups')
@Unique('uq_bi_image_intake_group_job_base', ['jobId', 'basePartNormalized'])
@Index('idx_bi_image_intake_group_org_status', [
  'organizationId',
  'detectionStatus',
])
export class BusinessIndustrialImageIntakeGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => BusinessIndustrialImageIntakeJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job!: BusinessIndustrialImageIntakeJob;

  @Column({ name: 'base_part_name', type: 'text' })
  basePartName!: string;

  @Column({ name: 'base_part_normalized', type: 'text' })
  basePartNormalized!: string;

  @Column({
    name: 'raw_folder_names',
    type: 'text',
    array: true,
    default: '{}',
  })
  rawFolderNames!: string[];

  @Column({
    name: 'instance_suffixes',
    type: 'text',
    array: true,
    default: '{}',
  })
  instanceSuffixes!: string[];

  @Column({ name: 'instance_count', type: 'int', default: 1 })
  instanceCount!: number;

  @Column({
    name: 'detection_status',
    type: 'varchar',
    length: 24,
    default: 'pending',
  })
  detectionStatus!: BusinessIndustrialImageIntakeGroupStatus;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  detection!: Record<string, unknown>;

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidence!: number | null;

  @Column({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
