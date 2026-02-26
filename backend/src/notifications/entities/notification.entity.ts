import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_notif_recipient')
  recipientId: string | null;

  @Column({ type: 'varchar', length: 50 })
  @Index('idx_notif_type')
  type: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  icon: string | null;

  @Column({ type: 'varchar', length: 10, default: 'info' })
  severity: 'info' | 'success' | 'warning' | 'error';

  @Column({ type: 'varchar', length: 50, nullable: true })
  entityType: string | null;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'text', nullable: true })
  actionUrl: string | null;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ type: 'boolean', default: false })
  dismissed: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
