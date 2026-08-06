import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ImageDriveAsset } from './image-drive-asset.entity.js';

@Entity('image_drive_folders')
@Index('idx_image_drive_folders_name_normalized', ['nameNormalized'], {
  unique: true,
})
export class ImageDriveFolder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'name_normalized', type: 'text' })
  nameNormalized!: string;

  @Column({ name: 's3_prefix', type: 'text' })
  s3Prefix!: string;

  @Column({
    name: 'linked_part_number',
    type: 'text',
    nullable: true,
  })
  linkedPartNumber!: string | null;

  @Column({
    name: 'linked_part_number_normalized',
    type: 'text',
    nullable: true,
  })
  linkedPartNumberNormalized!: string | null;

  @Column({ name: 'file_count', type: 'int', default: 0 })
  fileCount!: number;

  @Column({ name: 'total_size_bytes', type: 'bigint', default: 0 })
  totalSizeBytes!: number;

  @OneToMany(() => ImageDriveAsset, (asset) => asset.folder)
  assets!: ImageDriveAsset[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
