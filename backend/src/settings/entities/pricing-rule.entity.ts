import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'pricing_rules' })
export class PricingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  ruleType: 'markup' | 'markdown' | 'round' | 'min_margin' | 'competitive';

  @Column({ type: 'varchar', length: 30, nullable: true })
  channel: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'jsonb' })
  parameters: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
