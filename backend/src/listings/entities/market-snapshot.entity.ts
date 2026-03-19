import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * MarketSnapshot — Aggregated market intelligence data.
 *
 * Stores AI-generated market analysis results for dashboard widgets.
 * One snapshot per product per analysis run.
 */
@Entity('market_snapshots')
@Index('idx_market_snapshot_product', ['masterProductId'])
@Index('idx_market_snapshot_captured', ['capturedAt'])
export class MarketSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'master_product_id', type: 'uuid' })
  masterProductId!: string;

  /** Part number or search query used */
  @Column({ name: 'part_number', type: 'varchar', length: 200 })
  partNumber!: string;

  // ──────────────────────────── Market Summary ────────────────────

  @Column({ name: 'total_listings', type: 'integer', default: 0 })
  totalListings!: number;

  @Column({ name: 'avg_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  avgPrice!: number | null;

  @Column({ name: 'median_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  medianPrice!: number | null;

  @Column({ name: 'min_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  minPrice!: number | null;

  @Column({ name: 'max_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  maxPrice!: number | null;

  // ──────────────────────────── AI Analysis ───────────────────────

  /** AI recommended pricing (competitive, premium, aggressive) */
  @Column({ name: 'recommended_pricing', type: 'jsonb', nullable: true })
  recommendedPricing!: Record<string, unknown> | null;

  /** Market insights (array of strings) */
  @Column({ name: 'market_insights', type: 'jsonb', default: '[]' })
  marketInsights!: string[];

  /** AI confidence score */
  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true })
  confidence!: number | null;

  /** Cost of the AI analysis (USD) */
  @Column({ name: 'ai_cost_usd', type: 'numeric', precision: 8, scale: 4, nullable: true })
  aiCostUsd!: number | null;

  // ──────────────────────────── Metadata ──────────────────────────

  @Column({ name: 'captured_at', type: 'timestamptz' })
  capturedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
