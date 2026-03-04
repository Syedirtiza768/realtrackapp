import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CatalogImport } from './catalog-import.entity.js';
import { CatalogProduct } from './catalog-product.entity.js';

export type ImportRowStatus =
  | 'inserted'
  | 'duplicate_skipped'
  | 'duplicate_flagged'
  | 'updated'
  | 'invalid'
  | 'error';

/**
 * Tracks the outcome of each individual row during a CSV import.
 * Used for logging, auditing, and generating import reports.
 */
@Entity('catalog_import_rows')
@Index('idx_import_row_import_id', ['importId'])
@Index('idx_import_row_status', ['status'])
export class CatalogImportRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'import_id', type: 'uuid' })
  importId!: string;

  @ManyToOne(() => CatalogImport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_id' })
  import?: CatalogImport;

  @Column({ name: 'row_number', type: 'int' })
  rowNumber!: number;

  @Column({ type: 'varchar', length: 30 })
  status!: ImportRowStatus;

  /** Which duplicate strategy matched (sku, mpn, upc, title, brand_mpn) */
  @Column({ name: 'match_strategy', type: 'text', nullable: true })
  matchStrategy!: string | null;

  /** The ID of the existing catalog product that was matched */
  @Column({ name: 'matched_product_id', type: 'uuid', nullable: true })
  matchedProductId!: string | null;

  @ManyToOne(() => CatalogProduct, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'matched_product_id' })
  matchedProduct?: CatalogProduct;

  /** The ID of the newly created product (if inserted) */
  @Column({ name: 'created_product_id', type: 'uuid', nullable: true })
  createdProductId!: string | null;

  /** Error or warning message for this specific row */
  @Column({ type: 'text', nullable: true })
  message!: string | null;

  /** Raw row data for debugging */
  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData!: Record<string, string> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
