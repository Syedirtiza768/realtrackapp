import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayPublishedListing } from './ebay-published-listing.entity.js';

@Entity('ebay_published_listing_revisions')
@Index('idx_epl_rev_listing', ['publishedListingId'])
@Index('idx_epl_rev_org', ['organizationId'])
@Index('idx_epl_rev_created', ['createdAt'])
export class EbayPublishedListingRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'published_listing_id', type: 'uuid' })
  publishedListingId!: string;

  @ManyToOne(() => EbayPublishedListing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'published_listing_id' })
  publishedListing!: EbayPublishedListing;

  @Column({ name: 'ebay_account_id', type: 'uuid' })
  ebayAccountId!: string;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ name: 'action_type', type: 'varchar', length: 80 })
  actionType!: string;

  @Column({ name: 'ebay_item_id', type: 'varchar', length: 100, nullable: true })
  ebayItemId!: string | null;

  @Column({ name: 'before_value', type: 'jsonb', nullable: true })
  beforeValue!: Record<string, unknown> | null;

  @Column({ name: 'after_value', type: 'jsonb', nullable: true })
  afterValue!: Record<string, unknown> | null;

  @Column({ name: 'api_result', type: 'varchar', length: 40 })
  apiResult!: string;

  @Column({ name: 'api_error', type: 'text', nullable: true })
  apiError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
