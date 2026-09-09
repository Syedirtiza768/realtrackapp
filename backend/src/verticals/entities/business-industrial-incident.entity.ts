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
import { Organization } from '../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';

export type BusinessIndustrialIncidentType =
  | 'counterfeit'
  | 'intellectual_property'
  | 'product_safety'
  | 'recalled_product'
  | 'other';
export type BusinessIndustrialIncidentStatus =
  | 'received'
  | 'quarantined'
  | 'takedown_pending'
  | 'takedown_complete'
  | 'escalated'
  | 'released';

/** Idempotent enforcement incident and remote takedown evidence. */
@Entity('business_industrial_incidents')
@Unique('uq_bi_incident_event', ['organizationId', 'externalEventId'])
@Index('idx_bi_incident_org_status', ['organizationId', 'status'])
@Index('idx_bi_incident_product', ['catalogProductId'])
export class BusinessIndustrialIncident {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId!: string | null;

  @ManyToOne(() => CatalogProduct, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'catalog_product_id' })
  catalogProduct!: CatalogProduct | null;

  @Column({ name: 'external_event_id', type: 'varchar', length: 200 })
  externalEventId!: string;

  @Column({ name: 'incident_type', type: 'varchar', length: 32 })
  incidentType!: BusinessIndustrialIncidentType;

  @Column({ type: 'varchar', length: 24, default: 'received' })
  status!: BusinessIndustrialIncidentStatus;

  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  @Column({ name: 'event_occurred_at', type: 'timestamptz', nullable: true })
  eventOccurredAt!: Date | null;

  @Column({ name: 'detected_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  detectedAt!: Date;

  @Column({ name: 'first_takedown_attempt_at', type: 'timestamptz', nullable: true })
  firstTakedownAttemptAt!: Date | null;

  @Column({ name: 'takedown_completed_at', type: 'timestamptz', nullable: true })
  takedownCompletedAt!: Date | null;

  @Column({ name: 'event_payload', type: 'jsonb', default: '{}' })
  eventPayload!: Record<string, unknown>;

  @Column({ name: 'takedown_attempts', type: 'jsonb', default: '[]' })
  takedownAttempts!: Array<Record<string, unknown>>;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
