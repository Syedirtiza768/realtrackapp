import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-organization, per-batch SKU counter for Fashion quick capture.
 * `next_value` is advanced atomically with INSERT … ON CONFLICT … RETURNING,
 * so concurrent operators never receive the same number.
 */
@Entity('fashion_sku_counters')
export class FashionSkuCounter {
  @PrimaryColumn({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  batch!: string;

  /** Last number handed out for this batch. */
  @Column({ name: 'last_value', type: 'integer' })
  lastValue!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
