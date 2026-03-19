import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum CandidateStatus {
  PENDING = 'pending',
  SELECTED = 'selected',
  REJECTED = 'rejected',
  MERGED = 'merged',
}

@Entity('product_candidates')
@Index('idx_product_candidate_motors', ['motorsProductId'])
@Index('idx_product_candidate_status', ['status'])
@Index('idx_product_candidate_mpn', ['mpnNormalized'])
export class ProductCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  motorsProductId: string;

  @Column({ type: 'enum', enum: CandidateStatus, default: CandidateStatus.PENDING })
  status: CandidateStatus;

  @Column({ type: 'int', default: 0 })
  rank: number;

  // Candidate identity
  @Column({ type: 'text', nullable: true })
  brand: string | null;

  @Column({ type: 'text', nullable: true })
  mpn: string | null;

  @Column({ type: 'text', nullable: true })
  mpnNormalized: string | null;

  @Column({ type: 'text', nullable: true })
  oemPartNumber: string | null;

  @Column({ type: 'text', nullable: true })
  productType: string | null;

  @Column({ type: 'text', nullable: true })
  productFamily: string | null;

  @Column({ type: 'text', nullable: true })
  placement: string | null;

  @Column({ type: 'text', nullable: true })
  condition: string | null;

  // Source of the candidate
  @Column({ type: 'text' })
  source: string; // 'internal_sku', 'supplier_mpn', 'oem_interchange', 'ebay_epid', 'ai_vision', 'ai_ocr', 'catalog_match'

  @Column({ type: 'text', nullable: true })
  sourceReference: string | null;

  // Scoring
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  exactMpnScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  brandMatchScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  ocrMpnScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  visualFamilyScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  dimensionMatchScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  supplierDescSimilarityScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  fitmentConsistencyScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  compositeScore: number;

  // Full payload
  @Column({ type: 'jsonb', nullable: true })
  candidateData: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  scoringBreakdown: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
