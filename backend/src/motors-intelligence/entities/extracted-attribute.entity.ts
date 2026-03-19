import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ExtractionSource {
  OCR = 'ocr',
  VISION_AI = 'vision_ai',
  REGEX = 'regex',
  SUPPLIER_DATA = 'supplier_data',
  CATALOG_LOOKUP = 'catalog_lookup',
  MANUAL = 'manual',
}

@Entity('extracted_attributes')
@Index('idx_extracted_attr_motors', ['motorsProductId'])
@Index('idx_extracted_attr_source', ['extractionSource'])
export class ExtractedAttribute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  motorsProductId: string;

  @Column({ type: 'enum', enum: ExtractionSource })
  extractionSource: ExtractionSource;

  @Column({ type: 'text', nullable: true })
  imageAssetId: string | null;

  // Raw extraction data
  @Column({ type: 'text', nullable: true })
  rawOcrText: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rawModelOutput: Record<string, any> | null;

  // Extracted fields
  @Column({ type: 'text', nullable: true })
  extractedBrand: string | null;

  @Column({ type: 'text', nullable: true })
  extractedMpn: string | null;

  @Column({ type: 'text', nullable: true })
  extractedOemNumber: string | null;

  @Column({ type: 'text', nullable: true })
  extractedProductType: string | null;

  @Column({ type: 'text', nullable: true })
  extractedProductFamily: string | null;

  @Column({ type: 'text', nullable: true })
  extractedPlacement: string | null;

  @Column({ type: 'text', nullable: true })
  extractedMaterial: string | null;

  @Column({ type: 'text', nullable: true })
  extractedFinish: string | null;

  @Column({ type: 'text', nullable: true })
  extractedCondition: string | null;

  @Column({ type: 'text', nullable: true })
  extractedQuantity: string | null;

  @Column({ type: 'text', nullable: true })
  extractedSideOrientation: string | null;

  @Column({ type: 'text', nullable: true })
  extractedFrontRear: string | null;

  @Column({ type: 'jsonb', nullable: true })
  extractedDimensions: Record<string, any> | null;

  @Column({ type: 'text', array: true, nullable: true })
  extractedFeatures: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  extractedFitmentRaw: any[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  visibleTextLines: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  packagingIdentifiers: string[] | null;

  // Confidence per field
  @Column({ type: 'jsonb', nullable: true })
  confidenceScores: Record<string, number> | null;

  // Normalized output (after correction rules)
  @Column({ type: 'jsonb', nullable: true })
  normalizedOutput: Record<string, any> | null;

  // Final approved output (after human review or auto-approval)
  @Column({ type: 'jsonb', nullable: true })
  approvedOutput: Record<string, any> | null;

  // AI model info
  @Column({ type: 'text', nullable: true })
  aiProvider: string | null;

  @Column({ type: 'text', nullable: true })
  aiModel: string | null;

  @Column({ type: 'int', nullable: true })
  tokensUsed: number | null;

  @Column({ type: 'int', nullable: true })
  latencyMs: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  costUsd: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
