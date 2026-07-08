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
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';

@Entity('listing_store_overrides')
@Unique('uq_listing_store_override', [
  'catalogProductId',
  'ebayAccountId',
  'marketplaceId',
])
@Index('idx_lso_product', ['catalogProductId'])
@Index('idx_lso_account', ['ebayAccountId'])
export class ListingStoreOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string;

  @ManyToOne(() => CatalogProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalog_product_id' })
  catalogProduct!: CatalogProduct;

  @Column({ name: 'ebay_account_id', type: 'uuid' })
  ebayAccountId!: string;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30 })
  marketplaceId!: string;

  @Column({ name: 'title_override', type: 'text', nullable: true })
  titleOverride!: string | null;

  @Column({
    name: 'price_override',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  priceOverride!: string | null;

  @Column({ name: 'quantity_override', type: 'int', nullable: true })
  quantityOverride!: number | null;

  @Column({ name: 'description_override', type: 'text', nullable: true })
  descriptionOverride!: string | null;

  @Column({ name: 'category_id_override', type: 'text', nullable: true })
  categoryIdOverride!: string | null;

  @Column({ name: 'condition_override', type: 'text', nullable: true })
  conditionOverride!: string | null;

  @Column({ name: 'policy_overrides', type: 'jsonb', default: () => `'{}'` })
  policyOverrides!: Record<string, unknown>;

  @Column({ name: 'image_order_override', type: 'jsonb', nullable: true })
  imageOrderOverride!: unknown;

  @Column({ name: 'fitment_override', type: 'jsonb', nullable: true })
  fitmentOverride!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
