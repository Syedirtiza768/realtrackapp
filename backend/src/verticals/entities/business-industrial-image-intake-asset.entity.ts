import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity.js';
import { BusinessIndustrialImageIntakeJob } from './business-industrial-image-intake-job.entity.js';
import { BusinessIndustrialImageIntakeGroup } from './business-industrial-image-intake-group.entity.js';

/** Organization-scoped source image metadata for an intake run. */
@Entity('business_industrial_image_intake_assets')
@Unique('uq_bi_image_intake_asset_job_path', ['jobId', 'relativePath'])
@Index('idx_bi_image_intake_asset_group', ['groupId'])
export class BusinessIndustrialImageIntakeAsset {
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

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => BusinessIndustrialImageIntakeGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: BusinessIndustrialImageIntakeGroup;

  @Column({ name: 'source_folder_name', type: 'text' })
  sourceFolderName!: string;

  @Column({ name: 'relative_path', type: 'text' })
  relativePath!: string;

  @Column({ type: 'text' })
  filename!: string;

  @Column({ name: 's3_bucket', type: 'text' })
  s3Bucket!: string;

  @Column({ name: 's3_key', type: 'text' })
  s3Key!: string;

  @Column({ name: 'cdn_url', type: 'text' })
  cdnUrl!: string;

  @Column({ name: 'mime_type', type: 'text', nullable: true })
  mimeType!: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint' })
  fileSizeBytes!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
