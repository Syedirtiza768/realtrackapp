import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'tenant_settings' })
@Unique('uq_setting_category_key', ['category', 'key'])
export class TenantSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 100, name: 'key' })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;
}
