import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';

@Entity('ebay_oauth_tokens')
export class EbayOAuthToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ebay_account_id', type: 'uuid', unique: true })
  ebayAccountId!: string;

  @OneToOne(() => ConnectedEbayAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'access_token_encrypted', type: 'text' })
  accessTokenEncrypted!: string;

  @Column({ name: 'access_token_expires_at', type: 'timestamptz' })
  accessTokenExpiresAt!: Date;

  @Column({ name: 'refresh_token_encrypted', type: 'text' })
  refreshTokenEncrypted!: string;

  @Column({
    name: 'refresh_token_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  refreshTokenExpiresAt!: Date | null;

  @Column({ name: 'granted_scopes', type: 'jsonb', default: () => `'[]'` })
  grantedScopes!: string[];

  @Column({ name: 'last_refreshed_at', type: 'timestamptz', nullable: true })
  lastRefreshedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'reconnect_required', type: 'boolean', default: false })
  reconnectRequired!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
