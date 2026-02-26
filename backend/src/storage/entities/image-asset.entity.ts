import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ListingRecord } from '../../listings/listing-record.entity.js';

@Entity('image_assets')
@Index('idx_image_listing', ['listingId'], { where: '"deleted_at" IS NULL' })
@Index('idx_image_s3', ['s3Bucket', 's3Key'], { unique: true })
export class ImageAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId!: string | null;

  @ManyToOne(() => ListingRecord, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'listing_id' })
  listing?: ListingRecord;

  @Column({ name: 'job_id', type: 'uuid', nullable: true })
  @Index('idx_image_job')
  jobId!: string | null;

  // ─── Storage ───
  @Column({ name: 's3_bucket', type: 'varchar', length: 100 })
  s3Bucket!: string;

  @Column({ name: 's3_key', type: 'varchar', length: 500 })
  s3Key!: string;

  @Column({ name: 's3_key_thumb', type: 'varchar', length: 500, nullable: true })
  s3KeyThumb!: string | null;

  @Column({ name: 'cdn_url', type: 'text', nullable: true })
  cdnUrl!: string | null;

  // ─── Metadata ───
  @Column({ name: 'original_filename', type: 'text', nullable: true })
  originalFilename!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 50 })
  mimeType!: string;

  @Column({ name: 'file_size_bytes', type: 'bigint' })
  fileSizeBytes!: number;

  @Column({ type: 'integer', nullable: true })
  width!: number | null;

  @Column({ type: 'integer', nullable: true })
  height!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  blurhash!: string | null;

  // ─── Ordering ───
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  // ─── Lifecycle ───
  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
