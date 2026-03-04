import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TriggerType = 'schedule' | 'event' | 'condition';
export type ActionType =
  | 'update_price'
  | 'sync_inventory'
  | 'publish'
  | 'end_listing'
  | 'notify'
  | 'apply_template';

@Entity({ name: 'automation_rules' })
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 200 })
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('varchar', { length: 50 })
  triggerType: TriggerType;

  @Column('jsonb', { default: {} })
  triggerConfig: Record<string, unknown>;

  @Column('varchar', { length: 50 })
  actionType: ActionType;

  @Column('jsonb', { default: {} })
  actionConfig: Record<string, unknown>;

  @Column('jsonb', { default: [] })
  conditions: Record<string, unknown>[];

  @Column('uuid', { name: 'store_id', nullable: true })
  storeId: string | null;

  @Column('varchar', { length: 30, nullable: true })
  channel: string | null;

  @Column('boolean', { default: false })
  enabled: boolean;

  @Column('integer', { default: 0 })
  priority: number;

  @Column('timestamptz', { nullable: true })
  lastExecutedAt: Date | null;

  @Column('integer', { default: 0 })
  executionCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
