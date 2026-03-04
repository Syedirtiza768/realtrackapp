import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CatalogImportStatus =
  | 'pending'
  | 'validating'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

/**
 * Tracks a single CSV import job — file metadata, progress, and results.
 */
@Entity('catalog_imports')
@Index('idx_catalog_import_status', ['status'])
export class CatalogImport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ── File metadata ─────────────────────────────────────── */

  @Column({ name: 'file_name', type: 'text' })
  fileName!: string;

  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath!: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes!: number | null;

  @Column({ name: 'mime_type', type: 'text', nullable: true })
  mimeType!: string | null;

  /* ── Column mapping ────────────────────────────────────── */

  /** CSV headers detected in the file */
  @Column({ name: 'detected_headers', type: 'text', array: true, default: '{}' })
  detectedHeaders!: string[];

  /** User-defined mapping: { csvColumn: catalogField } */
  @Column({ name: 'column_mapping', type: 'jsonb', nullable: true })
  columnMapping!: Record<string, string> | null;

  /* ── Processing status ─────────────────────────────────── */

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: CatalogImportStatus;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows!: number;

  @Column({ name: 'processed_rows', type: 'int', default: 0 })
  processedRows!: number;

  @Column({ name: 'inserted_rows', type: 'int', default: 0 })
  insertedRows!: number;

  @Column({ name: 'updated_rows', type: 'int', default: 0 })
  updatedRows!: number;

  @Column({ name: 'skipped_duplicates', type: 'int', default: 0 })
  skippedDuplicates!: number;

  @Column({ name: 'flagged_for_review', type: 'int', default: 0 })
  flaggedForReview!: number;

  @Column({ name: 'invalid_rows', type: 'int', default: 0 })
  invalidRows!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  /** Warnings and non-fatal issues */
  @Column({ type: 'jsonb', nullable: true })
  warnings!: string[] | null;

  /* ── Resume support ────────────────────────────────────── */

  /** The last row successfully processed — supports resume */
  @Column({ name: 'last_processed_row', type: 'int', default: 0 })
  lastProcessedRow!: number;

  /* ── User & timing ─────────────────────────────────────── */

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
