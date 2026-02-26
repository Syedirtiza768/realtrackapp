import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('channel_connections')
@Index('idx_channel_conn_user', ['userId'])
export class ChannelConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  channel!: string; // 'ebay' | 'shopify' | 'amazon'

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'account_name', type: 'varchar', length: 200, nullable: true })
  accountName!: string | null;

  @Column({ name: 'external_account_id', type: 'varchar', length: 200, nullable: true })
  externalAccountId!: string | null;

  /** AES-256-GCM encrypted JSON blob containing {accessToken, refreshToken, expiresAt} */
  @Column({ name: 'encrypted_tokens', type: 'text' })
  encryptedTokens!: string;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  scope!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status!: string; // 'active' | 'expired' | 'revoked' | 'error'

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
