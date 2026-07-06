import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'sidebar_module_configs' })
export class SidebarModuleConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  @Index('idx_sidebar_config_role')
  roleSlug: string;

  @Column({ type: 'varchar', length: 120 })
  @Index('idx_sidebar_config_module')
  moduleKey: string;

  @Column({ type: 'boolean', default: true })
  visible: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
