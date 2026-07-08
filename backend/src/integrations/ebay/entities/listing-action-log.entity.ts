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
import { User } from '../../../auth/entities/user.entity.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
import { EbayListingChannel } from './ebay-listing-channel.entity.js';

@Entity('listing_action_logs')
@Index('idx_listing_action_logs_org', ['organizationId'])
@Index('idx_listing_action_logs_created', ['createdAt'])
export class ListingActionLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ name: 'ebay_account_id', type: 'uuid', nullable: true })
  ebayAccountId!: string | null;

  @ManyToOne(() => ConnectedEbayAccount, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount | null;

  @Column({
    name: 'marketplace_id',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
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

  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({ name: 'before_snapshot', type: 'jsonb', nullable: true })
  beforeSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'after_snapshot', type: 'jsonb', nullable: true })
  afterSnapshot!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 40 })
  result!: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
