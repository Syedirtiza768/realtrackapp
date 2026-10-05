import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';

export type BusinessIndustrialReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'quarantined';

/** Private provenance, safety, and test-review record for a B&I product. */
@Entity('business_industrial_reviews')
@Unique('uq_bi_review_product', ['organizationId', 'catalogProductId'])
@Index('idx_bi_review_org_status', ['organizationId', 'status'])
export class BusinessIndustrialReview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string;

  @ManyToOne(() => CatalogProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalog_product_id' })
  catalogProduct!: CatalogProduct;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: BusinessIndustrialReviewStatus;

  @Column({ name: 'provenance_confirmed', type: 'boolean', default: false })
  provenanceConfirmed!: boolean;

  @Column({ name: 'specifications_verified', type: 'boolean', default: false })
  specificationsVerified!: boolean;

  @Column({ name: 'testing_reviewed', type: 'boolean', default: false })
  testingReviewed!: boolean;

  @Column({
    name: 'restricted_category_cleared',
    type: 'boolean',
    default: false,
  })
  restrictedCategoryCleared!: boolean;

  @Column({ name: 'evidence_keys', type: 'text', array: true, default: '{}' })
  evidenceKeys!: string[];

  @Column({ name: 'risk_flags', type: 'text', array: true, default: '{}' })
  riskFlags!: string[];

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({
    name: 'reviewed_product_updated_at',
    type: 'timestamptz',
    nullable: true,
  })
  reviewedProductUpdatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
