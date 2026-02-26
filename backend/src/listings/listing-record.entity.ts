import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

@Entity({ name: 'listing_records' })
@Unique('uq_listing_source_row', [
  'sourceFileName',
  'sheetName',
  'sourceRowNumber',
])
@Index('idx_listing_sku', ['customLabelSku'])
@Index('idx_listing_category_id', ['categoryId'])
@Index('idx_listing_title', ['title'])
@Index('idx_listing_brand', ['cBrand'])
@Index('idx_listing_condition', ['conditionId'])
@Index('idx_listing_c_type', ['cType'])
@Index('idx_listing_source_file', ['sourceFileName'])
export class ListingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ── source metadata ────────────────────────────────────── */

  @Column({ type: 'text' })
  sourceFileName: string;

  @Column({ type: 'text' })
  sourceFilePath: string;

  @Column({ type: 'text', default: 'Listings' })
  sheetName: string;

  @Column({ type: 'int' })
  sourceRowNumber: number;

  @CreateDateColumn({ type: 'timestamptz' })
  importedAt: Date;

  /* ── eBay listing columns (76 columns) ──────────────────── */

  @Column({ type: 'text', nullable: true })
  action: string | null;

  @Column({ type: 'text', nullable: true })
  customLabelSku: string | null;

  @Column({ type: 'text', nullable: true })
  categoryId: string | null;

  @Column({ type: 'text', nullable: true })
  categoryName: string | null;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  relationship: string | null;

  @Column({ type: 'text', nullable: true })
  relationshipDetails: string | null;

  @Column({ type: 'text', nullable: true })
  scheduleTime: string | null;

  @Column({ type: 'text', nullable: true })
  pUpc: string | null;

  @Column({ type: 'text', nullable: true })
  pEpid: string | null;

  @Column({ type: 'text', nullable: true })
  startPrice: string | null;

  @Column({ type: 'text', nullable: true })
  quantity: string | null;

  @Column({ type: 'text', nullable: true })
  itemPhotoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  conditionId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  format: string | null;

  @Column({ type: 'text', nullable: true })
  duration: string | null;

  @Column({ type: 'text', nullable: true })
  buyItNowPrice: string | null;

  @Column({ type: 'text', nullable: true })
  bestOfferEnabled: string | null;

  @Column({ type: 'text', nullable: true })
  bestOfferAutoAcceptPrice: string | null;

  @Column({ type: 'text', nullable: true })
  minimumBestOfferPrice: string | null;

  @Column({ type: 'text', nullable: true })
  immediatePayRequired: string | null;

  @Column({ type: 'text', nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  shippingService1Option: string | null;

  @Column({ type: 'text', nullable: true })
  shippingService1Cost: string | null;

  @Column({ type: 'text', nullable: true })
  shippingService1Priority: string | null;

  @Column({ type: 'text', nullable: true })
  shippingService2Option: string | null;

  @Column({ type: 'text', nullable: true })
  shippingService2Cost: string | null;

  @Column({ type: 'text', nullable: true })
  shippingService2Priority: string | null;

  @Column({ type: 'text', nullable: true })
  maxDispatchTime: string | null;

  @Column({ type: 'text', nullable: true })
  returnsAcceptedOption: string | null;

  @Column({ type: 'text', nullable: true })
  returnsWithinOption: string | null;

  @Column({ type: 'text', nullable: true })
  refundOption: string | null;

  @Column({ type: 'text', nullable: true })
  returnShippingCostPaidBy: string | null;

  @Column({ type: 'text', nullable: true })
  shippingProfileName: string | null;

  @Column({ type: 'text', nullable: true })
  returnProfileName: string | null;

  @Column({ type: 'text', nullable: true })
  paymentProfileName: string | null;

  @Column({ type: 'text', nullable: true })
  productCompliancePolicyId: string | null;

  @Column({ type: 'text', nullable: true })
  regionalProductCompliancePolicies: string | null;

  @Column({ type: 'text', nullable: true })
  cBrand: string | null;

  @Column({ type: 'text', nullable: true })
  cType: string | null;

  @Column({ type: 'text', nullable: true })
  cItemHeight: string | null;

  @Column({ type: 'text', nullable: true })
  cItemLength: string | null;

  @Column({ type: 'text', nullable: true })
  cItemWidth: string | null;

  @Column({ type: 'text', nullable: true })
  cItemDiameter: string | null;

  @Column({ type: 'text', nullable: true })
  cFeatures: string | null;

  @Column({ type: 'text', nullable: true })
  cManufacturerPartNumber: string | null;

  @Column({ type: 'text', nullable: true })
  cOeOemPartNumber: string | null;

  @Column({ type: 'text', nullable: true })
  cOperatingMode: string | null;

  @Column({ type: 'text', nullable: true })
  cFuelType: string | null;

  @Column({ type: 'text', nullable: true })
  cDriveType: string | null;

  @Column({ type: 'text', nullable: true })
  productSafetyPictograms: string | null;

  @Column({ type: 'text', nullable: true })
  productSafetyStatements: string | null;

  @Column({ type: 'text', nullable: true })
  productSafetyComponent: string | null;

  @Column({ type: 'text', nullable: true })
  regulatoryDocumentIds: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerName: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerAddressLine1: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerAddressLine2: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerCity: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerCountry: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerPostalCode: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerStateOrProvince: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerPhone: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerEmail: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturerContactUrl: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1Type: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1AddressLine1: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1AddressLine2: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1City: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1Country: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1PostalCode: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1StateOrProvince: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1Phone: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1Email: string | null;

  @Column({ type: 'text', nullable: true })
  responsiblePerson1ContactUrl: string | null;

  /* ── Lifecycle columns (Module 1 — Listing CRUD) ──────── */

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: 'draft' | 'ready' | 'published' | 'sold' | 'delisted' | 'archived';

  @VersionColumn()
  version: number;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ebayListingId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  shopifyProductId: string | null;

  /* ── Full-text search vector (managed by DB trigger) ──── */
  @Column({
    type: 'tsvector',
    nullable: true,
    select: false, // don't return in normal queries
  })
  searchVector: string | null;
}
