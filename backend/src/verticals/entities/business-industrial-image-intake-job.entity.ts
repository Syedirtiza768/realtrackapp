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
import { Organization } from '../../auth/entities/organization.entity.js';

export type BusinessIndustrialImageIntakeJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

/** Organization-scoped image intake run. Raw uploads never use the legacy global Image Drive tables. */
@Entity('business_industrial_image_intake_jobs')
@Index('idx_bi_image_intake_job_org_status', ['organizationId', 'status'])
export class BusinessIndustrialImageIntakeJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Column({ name: 'source_root_name', type: 'text' })
  sourceRootName!: string;

  @Column({ name: 'source_reference_url', type: 'text', nullable: true })
  sourceReferenceUrl!: string | null;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status!: BusinessIndustrialImageIntakeJobStatus;

  @Column({ name: 'total_folders', type: 'int', default: 0 })
  totalFolders!: number;

  @Column({ name: 'total_images', type: 'int', default: 0 })
  totalImages!: number;

  @Column({ name: 'processed_folders', type: 'int', default: 0 })
  processedFolders!: number;

  @Column({ name: 'processed_images', type: 'int', default: 0 })
  processedImages!: number;

  @Column({ name: 'grouped_parts', type: 'int', default: 0 })
  groupedParts!: number;

  @Column({ name: 'failed_folders', type: 'int', default: 0 })
  failedFolders!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
