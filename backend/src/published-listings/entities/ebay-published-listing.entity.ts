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
import { Organization } from '../../auth/entities/organization.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../../integrations/ebay/entities/ebay-listing-channel.entity.js';

export type PublishedListingStatus =
  | 'active'
  | 'ended'
  | 'out_of_stock'
  | 'unknown';

export type PublishedListingFormat = 'fixed_price' | 'auction' | 'unknown';

export interface PublishedListingHealthFlag {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

@Entity('ebay_published_listings')
@Index('idx_epl_org', ['organizationId'])
@Index('idx_epl_account', ['ebayAccountId'])
@Index('idx_epl_store', ['storeId'])
@Index('idx_epl_marketplace', ['marketplaceId'])
@Index('idx_epl_status', ['listingStatus'])
@Index('idx_epl_sku', ['sku'])
@Index('idx_epl_item_id', ['ebayItemId'])
@Index('idx_epl_synced', ['lastSyncedAt'])
@Index(
  'uq_epl_account_item',
  ['ebayAccountId', 'marketplaceId', 'ebayItemId'],
  {
    unique: true,
    where: '"ebay_item_id" IS NOT NULL',
  },
)
export class EbayPublishedListing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'ebay_account_id', type: 'uuid' })
  ebayAccountId!: string;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store!: Store;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30 })
  marketplaceId!: string;

  @Column({
    name: 'ebay_item_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  ebayItemId!: string | null;

  @Column({ name: 'offer_id', type: 'varchar', length: 100, nullable: true })
  offerId!: string | null;

  @Column({ type: 'text', nullable: true })
  sku!: string | null;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'category_id', type: 'varchar', length: 50, nullable: true })
  categoryId!: string | null;

  @Column({ name: 'category_name', type: 'text', nullable: true })
  categoryName!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price!: string | null;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency!: string;

  @Column({ name: 'quantity_available', type: 'int', default: 0 })
  quantityAvailable!: number;

  @Column({ name: 'quantity_sold', type: 'int', default: 0 })
  quantitySold!: number;

  @Column({
    name: 'listing_status',
    type: 'varchar',
    length: 30,
    default: 'active',
  })
  listingStatus!: PublishedListingStatus;

  @Column({
    name: 'listing_format',
    type: 'varchar',
    length: 30,
    default: 'fixed_price',
  })
  listingFormat!: PublishedListingFormat;

  @Column({ type: 'varchar', length: 60, nullable: true })
  condition!: string | null;

  @Column({ name: 'listing_url', type: 'text', nullable: true })
  listingUrl!: string | null;

  @Column({ name: 'image_urls', type: 'jsonb', default: () => "'[]'" })
  imageUrls!: string[];

  @Column({ name: 'item_specifics', type: 'jsonb', default: () => "'{}'" })
  itemSpecifics!: Record<string, string[]>;

  @Column({ name: 'shipping_details', type: 'jsonb', nullable: true })
  shippingDetails!: Record<string, unknown> | null;

  @Column({ name: 'listing_policies', type: 'jsonb', nullable: true })
  listingPolicies!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  compatibility!: Record<string, unknown> | null;

  @Column({ name: 'performance_metrics', type: 'jsonb', default: () => "'{}'" })
  performanceMetrics!: Record<string, unknown>;

  @Column({ name: 'health_flags', type: 'jsonb', default: () => "'[]'" })
  healthFlags!: PublishedListingHealthFlag[];

  @Column({ type: 'jsonb', nullable: true })
  location!: Record<string, unknown> | null;

  @Column({ name: 'raw_ebay_response', type: 'jsonb', nullable: true })
  rawEbayResponse!: Record<string, unknown> | null;

  @Column({
    name: 'account_display_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  accountDisplayName!: string | null;

  @Column({ name: 'ebay_start_time', type: 'timestamptz', nullable: true })
  ebayStartTime!: Date | null;

  @Column({ name: 'ebay_end_time', type: 'timestamptz', nullable: true })
  ebayEndTime!: Date | null;

  @Column({
    name: 'ebay_last_modified_at',
    type: 'timestamptz',
    nullable: true,
  })
  ebayLastModifiedAt!: Date | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId!: string | null;

  @ManyToOne(() => CatalogProduct, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'catalog_product_id' })
  catalogProduct!: CatalogProduct | null;

  @Column({ name: 'ebay_listing_channel_id', type: 'uuid', nullable: true })
  ebayListingChannelId!: string | null;

  @ManyToOne(() => EbayListingChannel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ebay_listing_channel_id' })
  ebayListingChannel!: EbayListingChannel | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
