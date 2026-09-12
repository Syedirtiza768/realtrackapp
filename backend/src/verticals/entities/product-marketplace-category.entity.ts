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
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import type { ProductVertical } from '../vertical.types.js';

@Entity('product_marketplace_categories')
@Unique('uq_product_marketplace_category', [
  'catalogProductId',
  'marketplaceId',
])
@Index('idx_product_marketplace_category_vertical', [
  'vertical',
  'marketplaceId',
  'categoryId',
])
export class ProductMarketplaceCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string;

  @ManyToOne(() => CatalogProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalog_product_id' })
  catalogProduct!: CatalogProduct;

  @Column({ type: 'varchar', length: 32 })
  vertical!: ProductVertical;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30 })
  marketplaceId!: string;

  @Column({ name: 'category_tree_id', type: 'varchar', length: 30 })
  categoryTreeId!: string;

  @Column({ name: 'category_id', type: 'varchar', length: 50 })
  categoryId!: string;

  @Column({ name: 'category_name', type: 'text', nullable: true })
  categoryName!: string | null;

  @Column({ name: 'aspect_metadata', type: 'jsonb', default: '[]' })
  aspectMetadata!: Record<string, unknown>[];

  @Column({ name: 'condition_metadata', type: 'jsonb', default: '[]' })
  conditionMetadata!: string[];

  @Column({ name: 'supports_variations', type: 'boolean', nullable: true })
  supportsVariations!: boolean | null;

  @Column({ name: 'fetched_at', type: 'timestamptz', nullable: true })
  fetchedAt!: Date | null;

  @Column({ name: 'invalidated_at', type: 'timestamptz', nullable: true })
  invalidatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
