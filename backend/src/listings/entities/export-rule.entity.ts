import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Store } from '../../channels/entities/store.entity.js';

/**
 * ExportRule — Defines rules for automated listing export to eBay stores.
 *
 * Maps product criteria (filters) to a target store with per-rule overrides.
 * When new products match a rule's filters, they are automatically queued
 * for publishing to the target store.
 */
@Entity('export_rules')
@Index('idx_export_rule_store', ['storeId'])
@Index('idx_export_rule_status', ['status'])
@Index('idx_export_rule_org', ['organizationId'])
export class ExportRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Multi-tenant */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  /** Human-readable rule name */
  @Column({ type: 'varchar', length: 200 })
  name!: string;

  /** Optional description */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // ──────────────────────────── Target ────────────────────────────

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store!: Store;

  // ──────────────────────────── Filters ───────────────────────────

  /**
   * JSONB filter criteria. Products matching ALL criteria are exported.
   * Example:
   * {
   *   "brand": ["TRW", "Bosch"],
   *   "partType": ["Brake Pad Set"],
   *   "condition": ["NEW"],
   *   "minPrice": 10,
   *   "maxPrice": 500,
   *   "minQuantity": 1
   * }
   */
  @Column({ type: 'jsonb', default: '{}' })
  filters!: Record<string, unknown>;

  // ──────────────────────────── Overrides ─────────────────────────

  /** Price markup percentage (e.g. 1.15 = +15%) */
  @Column({ name: 'price_multiplier', type: 'numeric', precision: 5, scale: 4, default: 1 })
  priceMultiplier!: number;

  /** Fixed price addition (applied after multiplier) */
  @Column({ name: 'price_addition', type: 'numeric', precision: 12, scale: 2, default: 0 })
  priceAddition!: number;

  /** Title prefix to add (e.g. "OEM ") */
  @Column({ name: 'title_prefix', type: 'varchar', length: 50, nullable: true })
  titlePrefix!: string | null;

  /** Title suffix to add (e.g. " — Free Shipping") */
  @Column({ name: 'title_suffix', type: 'varchar', length: 50, nullable: true })
  titleSuffix!: string | null;

  /** eBay fulfillment policy ID for this rule */
  @Column({ name: 'fulfillment_policy_id', type: 'varchar', length: 100, nullable: true })
  fulfillmentPolicyId!: string | null;

  /** eBay payment policy ID */
  @Column({ name: 'payment_policy_id', type: 'varchar', length: 100, nullable: true })
  paymentPolicyId!: string | null;

  /** eBay return policy ID */
  @Column({ name: 'return_policy_id', type: 'varchar', length: 100, nullable: true })
  returnPolicyId!: string | null;

  // ──────────────────────────── Scheduling ────────────────────────

  /** How often to check for new matching products (cron expression) */
  @Column({ name: 'schedule_cron', type: 'varchar', length: 50, nullable: true })
  scheduleCron!: string | null;

  /** Whether to auto-publish or just create as draft offers */
  @Column({ name: 'auto_publish', type: 'boolean', default: false })
  autoPublish!: boolean;

  // ──────────────────────────── Status ────────────────────────────

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'paused' | 'disabled';

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt!: Date | null;

  @Column({ name: 'last_run_count', type: 'integer', default: 0 })
  lastRunCount!: number;

  @Column({ name: 'total_exported', type: 'integer', default: 0 })
  totalExported!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
