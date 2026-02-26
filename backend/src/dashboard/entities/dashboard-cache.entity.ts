import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'dashboard_metrics_cache' })
export class DashboardCache {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  metricKey: string;

  @Column({ type: 'jsonb' })
  metricValue: Record<string, unknown>;

  @UpdateDateColumn({ type: 'timestamptz' })
  computedAt: Date;
}
