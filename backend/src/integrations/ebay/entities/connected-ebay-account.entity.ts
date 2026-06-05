import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../../auth/entities/organization.entity.js';
import { User } from '../../../auth/entities/user.entity.js';
import { ChannelConnection } from '../../../channels/entities/channel-connection.entity.js';
import { Store } from '../../../channels/entities/store.entity.js';
import { EbayOAuthToken } from './ebay-oauth-token.entity.js';
import { EbayAccountMarketplace } from './ebay-account-marketplace.entity.js';
import { InternalStore } from './internal-store.entity.js';

export type EbayConnectionEnvironment = 'sandbox' | 'production';
export type EbayConnectionStatus =
  | 'active'
  | 'reconnect_required'
  | 'disabled'
  | 'token_expired'
  | 'permissions_missing';

@Entity('connected_ebay_accounts')
@Index('idx_connected_ebay_org', ['organizationId'])
@Index('idx_connected_ebay_status', ['connectionStatus'])
@Index('idx_connected_ebay_ebay_user', ['ebayUserId'])
@Index('uq_connected_ebay_org_user', ['organizationId', 'ebayUserId'], {
  unique: true,
})
export class ConnectedEbayAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'internal_store_id', type: 'uuid', nullable: true })
  internalStoreId!: string | null;

  @ManyToOne(() => InternalStore, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'internal_store_id' })
  internalStore!: InternalStore | null;

  @Column({ name: 'channel_connection_id', type: 'uuid' })
  channelConnectionId!: string;

  @ManyToOne(() => ChannelConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_connection_id' })
  channelConnection!: ChannelConnection;

  @Column({ name: 'primary_store_id', type: 'uuid' })
  primaryStoreId!: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'primary_store_id' })
  primaryStore!: Store;

  @Column({ name: 'ebay_user_id', type: 'varchar', length: 200 })
  ebayUserId!: string;

  @Column({ name: 'ebay_username', type: 'varchar', length: 200, nullable: true })
  ebayUsername!: string | null;

  @Column({ name: 'account_display_name', type: 'varchar', length: 200 })
  accountDisplayName!: string;

  @Column({ type: 'varchar', length: 20, default: 'sandbox' })
  environment!: EbayConnectionEnvironment;

  @Column({ name: 'connection_status', type: 'varchar', length: 30, default: 'active' })
  connectionStatus!: EbayConnectionStatus;

  @Column({ name: 'connected_by_user_id', type: 'uuid', nullable: true })
  connectedByUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'connected_by_user_id' })
  connectedByUser!: User | null;

  @Column({ name: 'connected_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  connectedAt!: Date;

  @Column({ name: 'last_verified_at', type: 'timestamptz', nullable: true })
  lastVerifiedAt!: Date | null;

  @Column({ name: 'last_successful_sync_at', type: 'timestamptz', nullable: true })
  lastSuccessfulSyncAt!: Date | null;

  @Column({ name: 'last_token_refresh_at', type: 'timestamptz', nullable: true })
  lastTokenRefreshAt!: Date | null;

  @Column({ name: 'last_error_message', type: 'text', nullable: true })
  lastErrorMessage!: string | null;

  @Column({ name: 'last_listings_fetched_count', type: 'int', default: 0 })
  lastListingsFetchedCount!: number;

  @Column({ name: 'last_policies_fetched_count', type: 'int', default: 0 })
  lastPoliciesFetchedCount!: number;

  @Column({ name: 'connection_source', type: 'varchar', length: 30, default: 'native_oauth' })
  connectionSource!: 'native_oauth' | 'sellerpundit';

  @Column({ name: 'sellerpundit_token_id', type: 'int', nullable: true })
  sellerpunditTokenId!: number | null;

  @Column({ name: 'sellerpundit_account_name', type: 'varchar', length: 200, nullable: true })
  sellerpunditAccountName!: string | null;

  @Column({ name: 'sellerpundit_marketplace_id', type: 'int', nullable: true })
  sellerpunditMarketplaceId!: number | null;

  @Column({ name: 'sellerpundit_last_sync_at', type: 'timestamptz', nullable: true })
  sellerpunditLastSyncAt!: Date | null;

  @Column({ name: 'sellerpundit_last_policy_sync_at', type: 'timestamptz', nullable: true })
  sellerpunditLastPolicySyncAt!: Date | null;

  @OneToOne(() => EbayOAuthToken, (t) => t.ebayAccount)
  oauthToken?: EbayOAuthToken;

  @OneToMany(() => EbayAccountMarketplace, (m) => m.ebayAccount)
  marketplaces!: EbayAccountMarketplace[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
