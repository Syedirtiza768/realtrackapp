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
import { ProductFamily } from './product-family.entity.js';
import type { ProductAttributes, ProductVertical } from '../vertical.types.js';

@Entity('product_variants')
@Unique('uq_product_variant_family_sku', ['familyId', 'sku'])
@Index('idx_product_variant_org_sku', ['organizationId', 'sku'])
@Index('idx_product_variant_family', ['familyId'])
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @ManyToOne(() => ProductFamily, (family) => family.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'family_id' })
  family!: ProductFamily;

  /** Optional link to the existing catalog product used by single-SKU publish flows. */
  @Column({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId!: string | null;

  @ManyToOne(() => CatalogProduct, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'catalog_product_id' })
  catalogProduct!: CatalogProduct | null;

  @Column({ type: 'varchar', length: 32 })
  vertical!: ProductVertical;

  @Column({ type: 'varchar', length: 160 })
  sku!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price!: number | null;

  @Column({ type: 'integer', default: 0 })
  quantity!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  upc!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ean!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mpn!: string | null;

  @Column({ name: 'condition_id', type: 'varchar', length: 40, nullable: true })
  conditionId!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  attributes!: ProductAttributes;

  @Column({ name: 'image_urls', type: 'text', array: true, default: '{}' })
  imageUrls!: string[];

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
