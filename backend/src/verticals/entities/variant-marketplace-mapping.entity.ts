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
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { ProductVariant } from './product-variant.entity.js';

@Entity('variant_marketplace_mappings')
@Unique('uq_variant_marketplace_mapping', [
  'variantId',
  'ebayAccountId',
  'marketplaceId',
])
@Index('idx_variant_mapping_account_sku', ['ebayAccountId', 'inventorySku'])
export class VariantMarketplaceMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant!: ProductVariant;

  @Column({ name: 'ebay_account_id', type: 'uuid' })
  ebayAccountId!: string;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30 })
  marketplaceId!: string;

  @Column({ name: 'inventory_sku', type: 'varchar', length: 160 })
  inventorySku!: string;

  @Column({ name: 'offer_id', type: 'varchar', length: 100, nullable: true })
  offerId!: string | null;

  @Column({ name: 'listing_id', type: 'varchar', length: 100, nullable: true })
  listingId!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: 'pending' | 'processing' | 'published' | 'failed' | 'ended';

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'result_payload', type: 'jsonb', nullable: true })
  resultPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
