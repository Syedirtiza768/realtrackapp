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
import { ImageDriveFolder } from './image-drive-folder.entity.js';

@Entity('image_drive_assets')
@Index('idx_image_drive_assets_folder', ['folderId'])
@Index('idx_image_drive_assets_folder_s3key', ['folderId', 's3Key'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class ImageDriveAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'folder_id', type: 'uuid' })
  folderId!: string;

  @ManyToOne(() => ImageDriveFolder, (folder) => folder.assets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'folder_id' })
  folder!: ImageDriveFolder;

  @Column({ type: 'text' })
  filename!: string;

  @Column({ name: 's3_key', type: 'text' })
  s3Key!: string;

  @Column({ name: 'cdn_url', type: 'text' })
  cdnUrl!: string;

  @Column({ name: 's3_key_thumb', type: 'text', nullable: true })
  s3KeyThumb!: string | null;

  @Column({ name: 's3_key_medium', type: 'text', nullable: true })
  s3KeyMedium!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 50, nullable: true })
  mimeType!: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', default: 0 })
  fileSizeBytes!: number;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ type: 'text', nullable: true })
  blurhash!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
