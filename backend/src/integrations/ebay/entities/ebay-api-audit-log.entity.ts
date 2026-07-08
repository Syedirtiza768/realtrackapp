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
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';

@Entity('ebay_api_audit_logs')
@Index('idx_ebay_audit_org', ['organizationId'])
@Index('idx_ebay_audit_account', ['ebayAccountId'])
@Index('idx_ebay_audit_created', ['createdAt'])
export class EbayApiAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'ebay_account_id', type: 'uuid', nullable: true })
  ebayAccountId!: string | null;

  @ManyToOne(() => ConnectedEbayAccount, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ name: 'http_method', type: 'varchar', length: 10 })
  httpMethod!: string;

  @Column({ name: 'api_family', type: 'varchar', length: 40 })
  apiFamily!: string;

  @Column({ name: 'endpoint_path', type: 'varchar', length: 500 })
  endpointPath!: string;

  @Column({
    name: 'marketplace_id',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  marketplaceId!: string | null;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus!: number | null;

  @Column({
    name: 'ebay_error_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  ebayErrorId!: string | null;

  @Column({ name: 'ebay_error_message', type: 'text', nullable: true })
  ebayErrorMessage!: string | null;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  correlationId!: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ name: 'request_metadata', type: 'jsonb', default: () => `'{}'` })
  requestMetadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
