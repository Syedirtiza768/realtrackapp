import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FashionReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'quarantined';

/** Private compliance record. Evidence keys are never included in listing feeds. */
@Entity('fashion_reviews')
@Index('idx_fashion_reviews_product', ['catalogProductId'])
@Index('idx_fashion_reviews_org_status', ['organizationId', 'status'])
export class FashionReview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: FashionReviewStatus;

  @Column({ name: 'authenticity_confirmed', type: 'boolean', default: false })
  authenticityConfirmed!: boolean;

  @Column({ name: 'evidence_keys', type: 'text', array: true, default: '{}' })
  evidenceKeys!: string[];

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
