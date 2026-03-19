import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MasterProduct } from './master-product.entity.js';

/**
 * CrossReference — Maps alternative part numbers to a master product.
 *
 * Enables lookup by:
 *  - OE/OEM numbers
 *  - Interchange (superseded) part numbers
 *  - Competitor cross-references
 *  - Alternative brand part numbers
 */
@Entity('cross_references')
@Index('idx_xref_product', ['masterProductId'])
@Index('idx_xref_part_number', ['partNumber'])
@Index('idx_xref_type', ['referenceType'])
@Index('idx_xref_brand_part', ['brand', 'partNumber'])
export class CrossReference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'master_product_id', type: 'uuid' })
  masterProductId!: string;

  @ManyToOne(() => MasterProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'master_product_id' })
  masterProduct!: MasterProduct;

  /** The alternative part number */
  @Column({ name: 'part_number', type: 'varchar', length: 200 })
  partNumber!: string;

  /** Brand that uses this part number */
  @Column({ type: 'varchar', length: 200, nullable: true })
  brand!: string | null;

  /** Type of reference */
  @Column({ name: 'reference_type', type: 'varchar', length: 50 })
  referenceType!: 'oem' | 'interchange' | 'competitor' | 'superseded' | 'alternate';

  /** Optional notes about this cross-reference */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Source of this data (manual, AI, catalog import) */
  @Column({ type: 'varchar', length: 50, default: 'manual' })
  source!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
