import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
import { EbayListingChannel } from './ebay-listing-channel.entity.js';

@Entity('ebay_api_errors')
@Index('idx_ebay_api_errors_org', ['organizationId'])
@Index('idx_ebay_api_errors_account', ['ebayAccountId'])
export class EbayApiError {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'ebay_account_id', type: 'uuid', nullable: true })
  ebayAccountId!: string | null;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount | null;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30, nullable: true })
  marketplaceId!: string | null;

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

  @Column({ name: 'api_name', type: 'varchar', length: 80 })
  apiName!: string;

  @Column({ type: 'text' })
  endpoint!: string;

  @Column({ name: 'response_code', type: 'int', nullable: true })
  responseCode!: number | null;

  @Column({ name: 'ebay_error_id', type: 'varchar', length: 80, nullable: true })
  ebayErrorId!: string | null;

  @Column({ name: 'ebay_error_domain', type: 'varchar', length: 120, nullable: true })
  ebayErrorDomain!: string | null;

  @Column({ name: 'ebay_error_category', type: 'varchar', length: 120, nullable: true })
  ebayErrorCategory!: string | null;

  @Column({ name: 'ebay_error_message', type: 'text', nullable: true })
  ebayErrorMessage!: string | null;

  @Column({ name: 'ebay_long_message', type: 'text', nullable: true })
  ebayLongMessage!: string | null;

  @Column({ type: 'boolean', default: false })
  retryable!: boolean;

  @Column({ name: 'raw_response', type: 'jsonb', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
