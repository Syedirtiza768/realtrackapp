import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum CorrectionType {
  CHAR_SUBSTITUTION = 'char_substitution',    // O vs 0, I vs 1
  HYPHEN_NORMALIZATION = 'hyphen_normalization',
  SUPERSESSION = 'supersession',               // Part number superseded by new one
  BRAND_ALIAS = 'brand_alias',                 // Brand name variations
  BRAND_FORMAT = 'brand_format',               // Brand-specific MPN formatting
  PAIR_SINGLE = 'pair_single',                 // Pair vs single confusion
  SIDE_ORIENTATION = 'side_orientation',        // Left vs Right corrections
  FRONT_REAR = 'front_rear',                   // Front vs Rear corrections
  PRODUCT_TYPE_ALIAS = 'product_type_alias',   // e.g., "Brake Pad" = "Disc Brake Pad"
  FITMENT_NORMALIZATION = 'fitment_normalization',
  TITLE_PATTERN = 'title_pattern',
}

@Entity('correction_rules')
@Index('idx_correction_type', ['correctionType'])
@Index('idx_correction_brand', ['brand'])
@Index('idx_correction_active', ['active'])
export class CorrectionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: CorrectionType })
  correctionType: CorrectionType;

  @Column({ type: 'text', nullable: true })
  brand: string | null;

  @Column({ type: 'text', nullable: true })
  productType: string | null;

  @Column({ type: 'text' })
  inputPattern: string;

  @Column({ type: 'text' })
  correctedValue: string;

  @Column({ type: 'boolean', default: false })
  isRegex: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Provenance
  @Column({ type: 'text', nullable: true })
  source: string | null; // 'manual', 'reviewer_correction', 'ebay_rejection', 'system'

  @Column({ type: 'uuid', nullable: true })
  sourceReviewTaskId: string | null;

  @Column({ type: 'int', default: 0 })
  applicationCount: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;
}
