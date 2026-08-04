import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('image_drive_assets')
@Index('idx_image_drive_part_number', ['partNumberNormalized'])
@Index('idx_image_drive_part_cdn', ['partNumberNormalized', 's3Key'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class ImageDriveAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'part_number_normalized', type: 'text' })
  partNumberNormalized!: string;

  @Column({ name: 'part_number_raw', type: 'text' })
  partNumberRaw!: string;

  @Column({ name: 'cdn_url', type: 'text' })
  cdnUrl!: string;

  @Column({ name: 's3_key', type: 'text' })
  s3Key!: string;

  @Column({ name: 'original_filename', type: 'text', nullable: true })
  originalFilename!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 50, nullable: true })
  mimeType!: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', default: 0 })
  fileSizeBytes!: number;

  @Column({ type: 'varchar', length: 20, default: 'direct' })
  source!: 'listing' | 'direct';

  @Column({ name: 'source_listing_id', type: 'uuid', nullable: true })
  sourceListingId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
