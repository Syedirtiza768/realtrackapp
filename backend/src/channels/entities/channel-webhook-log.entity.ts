import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('channel_webhook_logs')
@Index('idx_webhook_log_channel', ['channel'])
export class ChannelWebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  channel!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'external_id', type: 'varchar', length: 200, nullable: true })
  externalId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({
    name: 'processing_status',
    type: 'varchar',
    length: 20,
    default: 'received',
  })
  processingStatus!: string; // 'received' | 'processed' | 'failed' | 'ignored'

  @Column({ name: 'processing_error', type: 'text', nullable: true })
  processingError!: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
