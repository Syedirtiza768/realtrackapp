import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ProductVariant } from './product-variant.entity.js';
import type { ProductVertical } from '../vertical.types.js';

@Entity('product_families')
@Unique('uq_product_family_org_slug', ['organizationId', 'slug'])
@Index('idx_product_family_org', ['organizationId'])
@Index('idx_product_family_product', ['catalogProductId'])
export class ProductFamily {
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

  @Column({ type: 'varchar', length: 32 })
  vertical!: ProductVertical;

  @Column({ type: 'varchar', length: 160 })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @OneToMany(() => ProductVariant, (variant) => variant.family)
  variants!: ProductVariant[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
