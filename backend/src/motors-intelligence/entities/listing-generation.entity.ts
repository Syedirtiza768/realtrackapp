import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ListingGenerationStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  GENERATED = 'generated',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

@Entity('listing_generations')
@Index('idx_listing_gen_motors', ['motorsProductId'])
@Index('idx_listing_gen_status', ['status'])
export class ListingGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  motorsProductId: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'enum', enum: ListingGenerationStatus, default: ListingGenerationStatus.PENDING })
  status: ListingGenerationStatus;

  // Input contract (validated product data used to generate)
  @Column({ type: 'jsonb' })
  inputContract: Record<string, any>;

  // Generated outputs
  @Column({ type: 'text', nullable: true })
  generatedTitle: string | null;

  @Column({ type: 'jsonb', nullable: true })
  generatedItemSpecifics: Record<string, string> | null;

  @Column({ type: 'text', array: true, nullable: true })
  generatedBulletFeatures: string[] | null;

  @Column({ type: 'text', nullable: true })
  generatedHtmlDescription: string | null;

  @Column({ type: 'text', nullable: true })
  keywordRationale: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  searchTags: string[] | null;

  // Template used
  @Column({ type: 'text', nullable: true })
  templateId: string | null;

  @Column({ type: 'text', nullable: true })
  templateName: string | null;

  // AI metadata
  @Column({ type: 'text', nullable: true })
  aiProvider: string | null;

  @Column({ type: 'text', nullable: true })
  aiModel: string | null;

  @Column({ type: 'jsonb', nullable: true })
  aiRawResponse: Record<string, any> | null;

  @Column({ type: 'int', nullable: true })
  tokensUsed: number | null;

  @Column({ type: 'int', nullable: true })
  latencyMs: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  costUsd: number | null;

  // Quality
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  titleQualityScore: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  descriptionQualityScore: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  overallQualityScore: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
