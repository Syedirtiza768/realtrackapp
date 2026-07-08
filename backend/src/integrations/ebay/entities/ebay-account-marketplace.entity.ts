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
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';

@Entity('ebay_account_marketplaces')
@Unique('uq_ebay_acct_marketplace', ['ebayAccountId', 'marketplaceId'])
@Index('idx_ebay_acct_mp_account', ['ebayAccountId'])
@Index('idx_ebay_acct_mp_marketplace', ['marketplaceId'])
export class EbayAccountMarketplace {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ebay_account_id', type: 'uuid' })
  ebayAccountId!: string;

  @ManyToOne(() => ConnectedEbayAccount, (a) => a.marketplaces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount;

  @Column({ name: 'marketplace_id', type: 'varchar', length: 30 })
  marketplaceId!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'varchar', length: 20 })
  locale!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({
    name: 'default_inventory_location_key',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  defaultInventoryLocationKey!: string | null;

  @Column({
    name: 'default_payment_policy_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  defaultPaymentPolicyId!: string | null;

  @Column({
    name: 'default_return_policy_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  defaultReturnPolicyId!: string | null;

  @Column({
    name: 'default_fulfillment_policy_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  defaultFulfillmentPolicyId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
