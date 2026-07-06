import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EbayMvlReleaseStatus =
  | 'importing'
  | 'active'
  | 'superseded'
  | 'failed';

@Entity('ebay_mvl_releases')
@Index('idx_ebay_mvl_releases_marketplace_status', ['marketplace', 'status'])
export class EbayMvlRelease {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** US, AU, DE, or GB (UK site). */
  @Column({ type: 'varchar', length: 4 })
  marketplace!: string;

  @Column({ name: 'version_label', type: 'varchar', length: 64 })
  versionLabel!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'file_sha256', type: 'char', length: 64 })
  fileSha256!: string;

  @Column({ name: 'source_row_count', type: 'integer', default: 0 })
  sourceRowCount!: number;

  @Column({ name: 'entry_count', type: 'integer', default: 0 })
  entryCount!: number;

  @Column({ type: 'varchar', length: 20, default: 'importing' })
  status!: EbayMvlReleaseStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'imported_at', type: 'timestamptz', nullable: true })
  importedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
