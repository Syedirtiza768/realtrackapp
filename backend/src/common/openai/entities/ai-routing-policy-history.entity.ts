import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import type { AiRoutingPolicy } from '../ai-routing-policy.types.js';

@Entity('ai_routing_policy_history')
@Index('idx_ai_routing_policy_history_version', ['version'])
export class AiRoutingPolicyHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'jsonb' })
  policy!: AiRoutingPolicy;

  @Column({ type: 'varchar', length: 40, default: 'optimizer' })
  source!: string;

  @CreateDateColumn({ name: 'generated_at', type: 'timestamptz' })
  generatedAt!: Date;
}
