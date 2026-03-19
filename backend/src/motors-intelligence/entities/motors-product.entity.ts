import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';

export enum MotorsProductStatus {
  PENDING = 'pending',
  EXTRACTING = 'extracting',
  IDENTIFYING = 'identifying',
  RESOLVING_FITMENT = 'resolving_fitment',
  GENERATING_LISTING = 'generating_listing',
  VALIDATING = 'validating',
  REVIEW_REQUIRED = 'review_required',
  APPROVED = 'approved',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  REJECTED = 'rejected',
}

export enum MotorsSourceType {
  IMAGE_UPLOAD = 'image_upload',
  MPN_INPUT = 'mpn_input',
  OEM_INPUT = 'oem_input',
  CSV_IMPORT = 'csv_import',
  EXCEL_IMPORT = 'excel_import',
  SUPPLIER_FEED = 'supplier_feed',
  MARKETPLACE_REFERENCE = 'marketplace_reference',
  CATALOG_PRODUCT = 'catalog_product',
}

@Entity('motors_products')
@Index('idx_motors_product_status', ['status'])
@Index('idx_motors_product_brand_mpn', ['brand', 'mpn'])
@Index('idx_motors_product_source_type', ['sourceType'])
@Index('idx_motors_product_org', ['organizationId'])
@Index('idx_motors_product_listing', ['listingId'])
@Index('idx_motors_product_catalog', ['catalogProductId'])
export class MotorsProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ type: 'uuid', nullable: true })
  listingId: string | null;

  @Column({ type: 'uuid', nullable: true })
  catalogProductId: string | null;

  @Column({ type: 'enum', enum: MotorsProductStatus, default: MotorsProductStatus.PENDING })
  status: MotorsProductStatus;

  @Column({ type: 'enum', enum: MotorsSourceType })
  sourceType: MotorsSourceType;

  @Column({ type: 'jsonb', nullable: true })
  sourcePayload: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  sourceFileName: string | null;

  @Column({ type: 'text', nullable: true })
  sourceFilePath: string | null;

  @Column({ type: 'int', nullable: true })
  sourceRowNumber: number | null;

  // Resolved product identity
  @Column({ type: 'text', nullable: true })
  brand: string | null;

  @Column({ type: 'text', nullable: true })
  brandNormalized: string | null;

  @Column({ type: 'text', nullable: true })
  mpn: string | null;

  @Column({ type: 'text', nullable: true })
  mpnNormalized: string | null;

  @Column({ type: 'text', nullable: true })
  oemPartNumber: string | null;

  @Column({ type: 'text', nullable: true })
  upc: string | null;

  @Column({ type: 'text', nullable: true })
  epid: string | null;

  @Column({ type: 'text', nullable: true })
  productType: string | null;

  @Column({ type: 'text', nullable: true })
  productFamily: string | null;

  @Column({ type: 'text', nullable: true })
  placement: string | null;

  @Column({ type: 'text', nullable: true })
  material: string | null;

  @Column({ type: 'text', nullable: true })
  finish: string | null;

  @Column({ type: 'text', nullable: true })
  condition: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  features: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  includes: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  dimensions: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  quantityPerPack: string | null;

  @Column({ type: 'text', nullable: true })
  sideOrientation: string | null;

  @Column({ type: 'text', nullable: true })
  frontRear: string | null;

  // eBay category resolution
  @Column({ type: 'text', nullable: true })
  ebayCategoryId: string | null;

  @Column({ type: 'text', nullable: true })
  ebayCategoryName: string | null;

  @Column({ type: 'boolean', default: false })
  compatibilityRequired: boolean;

  // Confidence scores
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  identityConfidence: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  fitmentConfidence: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  complianceConfidence: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  contentQualityScore: number | null;

  // Generated listing content
  @Column({ type: 'text', nullable: true })
  generatedTitle: string | null;

  @Column({ type: 'jsonb', nullable: true })
  generatedItemSpecifics: Record<string, string> | null;

  @Column({ type: 'text', array: true, nullable: true })
  generatedBulletFeatures: string[] | null;

  @Column({ type: 'text', nullable: true })
  generatedHtmlDescription: string | null;

  @Column({ type: 'text', nullable: true })
  generatedKeywordRationale: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  generatedSearchTags: string[] | null;

  // Fitment summary
  @Column({ type: 'jsonb', nullable: true })
  fitmentRows: any[] | null;

  @Column({ type: 'text', nullable: true })
  compatibleVehicleSummary: string | null;

  // Image references
  @Column({ type: 'text', array: true, nullable: true })
  imageUrls: string[] | null;

  @Column({ type: 'uuid', array: true, nullable: true })
  imageAssetIds: string[] | null;

  // Pricing
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number | null;

  @Column({ type: 'int', nullable: true })
  quantity: number | null;

  // Publishing
  @Column({ type: 'text', nullable: true })
  ebayListingId: string | null;

  @Column({ type: 'text', nullable: true })
  publishError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  // Provenance
  @Column({ type: 'text', nullable: true })
  createdBy: string | null;

  @Column({ type: 'text', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
