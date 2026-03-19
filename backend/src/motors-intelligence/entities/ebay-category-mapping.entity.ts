import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ebay_category_mappings')
@Index('idx_ebay_cat_map_category_id', ['ebayCategoryId'])
@Index('idx_ebay_cat_map_product_type', ['productType'])
export class EbayCategoryMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  ebayCategoryId: string;

  @Column({ type: 'text' })
  ebayCategoryName: string;

  @Column({ type: 'text', nullable: true })
  parentCategoryId: string | null;

  @Column({ type: 'text', nullable: true })
  parentCategoryName: string | null;

  @Column({ type: 'text', nullable: true })
  productType: string | null;

  @Column({ type: 'boolean', default: false })
  isMotorsCategory: boolean;

  @Column({ type: 'boolean', default: false })
  supportsCompatibility: boolean;

  @Column({ type: 'text', array: true, nullable: true })
  compatibilityProperties: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  listingPolicies: Record<string, any> | null;

  @Column({ type: 'int', nullable: true })
  maxFitmentRows: number | null;

  @Column({ type: 'text', array: true, nullable: true })
  keywords: string[] | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;
}
