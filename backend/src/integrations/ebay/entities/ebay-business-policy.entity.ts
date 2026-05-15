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
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';

export type EbayPolicyType = 'payment' | 'return' | 'fulfillment';

@Entity('ebay_business_policies')
@Index('idx_ebay_policies_account', ['ebayAccountId'])
@Index('idx_ebay_policies_marketplace', ['marketplaceId'])
export class EbayBusinessPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ebay_account_id', type: 'uuid' })
  ebayAccountId!: string;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30 })
  marketplaceId!: string;

  @Column({ name: 'policy_type', type: 'varchar', length: 20 })
  policyType!: EbayPolicyType;

  @Column({ name: 'ebay_policy_id', type: 'varchar', length: 100 })
  ebayPolicyId!: string;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ name: 'raw_payload', type: 'jsonb', default: () => `'{}'` })
  rawPayload!: Record<string, unknown>;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
