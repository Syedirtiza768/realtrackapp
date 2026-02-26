import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index('idx_audit_entity')
  entityType: string;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 30 })
  @Index('idx_audit_action')
  action: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_audit_actor')
  actorId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  actorType: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, { old: unknown; new: unknown }> | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  @Index('idx_audit_created')
  createdAt: Date;
}
