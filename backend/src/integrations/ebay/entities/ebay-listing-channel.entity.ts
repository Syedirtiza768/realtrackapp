import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';

export type EbayListingChannelStatus =
  | 'draft'
  | 'validating'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'revising'
  | 'ended'
  | 'deleted';

@Entity('ebay_listing_channels')
@Index('idx_elc_org', ['organizationId'])
@Index('idx_elc_account', ['ebayAccountId'])
@Index('idx_elc_marketplace', ['marketplaceId'])
@Index('idx_elc_product', ['catalogProductId'])
@Index('idx_elc_listing', ['listingId'])
@Index('idx_elc_offer', ['offerId'])
@Index('idx_elc_inv_sku', ['ebayInventorySku'])
@Index('idx_elc_status', ['listingStatus'])
export class EbayListingChannel {
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

  @Column({ name: 'ebay_account_id', type: 'uuid' })
  ebayAccountId!: string;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30 })
  marketplaceId!: string;

  @Column({ name: 'internal_sku', type: 'text', nullable: true })
  internalSku!: string | null;

  @Column({ name: 'ebay_inventory_sku', type: 'text', nullable: true })
  ebayInventorySku!: string | null;

  @Column({ name: 'offer_id', type: 'varchar', length: 100, nullable: true })
  offerId!: string | null;

  @Column({ name: 'listing_id', type: 'varchar', length: 100, nullable: true })
  listingId!: string | null;

  @Column({ name: 'listing_url', type: 'text', nullable: true })
  listingUrl!: string | null;

  @Column({ name: 'channel_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  channelPrice!: string | null;

  @Column({ name: 'channel_quantity', type: 'int', nullable: true })
  channelQuantity!: number | null;

  @Column({ name: 'listing_status', type: 'varchar', length: 30, default: 'draft' })
  listingStatus!: EbayListingChannelStatus;

  @Column({ name: 'last_error_code', type: 'varchar', length: 80, nullable: true })
  lastErrorCode!: string | null;

  @Column({ name: 'last_error_message', type: 'text', nullable: true })
  lastErrorMessage!: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'last_revised_at', type: 'timestamptz', nullable: true })
  lastRevisedAt!: Date | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
