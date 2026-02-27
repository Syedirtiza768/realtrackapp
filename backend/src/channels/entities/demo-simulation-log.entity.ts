import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * DemoSimulationLog — audit trail for all demo-mode simulated operations.
 * When channels are in demo mode (no real API connection), every simulated
 * publish, sync, order, and webhook is logged here for demonstration purposes.
 */
@Entity('demo_simulation_logs')
@Index('idx_demo_log_operation', ['operationType'])
@Index('idx_demo_log_channel', ['channel'])
@Index('idx_demo_log_listing', ['listingId'])
@Index('idx_demo_log_created', ['createdAt'])
export class DemoSimulationLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'operation_type', type: 'varchar', length: 50 })
  operationType!:
    | 'publish'
    | 'update'
    | 'end_listing'
    | 'sync_inventory'
    | 'order_received'
    | 'webhook_simulated'
    | 'auth_simulated'
    | 'token_refresh';

  @Column({ type: 'varchar', length: 30 })
  channel!: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;

  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId!: string | null;

  @Column({ name: 'instance_id', type: 'uuid', nullable: true })
  instanceId!: string | null;

  /** Simulated external ID that would come from the marketplace */
  @Column({ name: 'simulated_external_id', type: 'varchar', length: 200, nullable: true })
  simulatedExternalId!: string | null;

  /** Simulated request payload */
  @Column({ name: 'request_payload', type: 'jsonb', default: '{}' })
  requestPayload!: Record<string, unknown>;

  /** Simulated response payload */
  @Column({ name: 'response_payload', type: 'jsonb', default: '{}' })
  responsePayload!: Record<string, unknown>;

  /** Simulated processing time (ms) */
  @Column({ name: 'simulated_latency_ms', type: 'integer', default: 0 })
  simulatedLatencyMs!: number;

  /** Whether the simulation was "successful" */
  @Column({ name: 'simulated_success', type: 'boolean', default: true })
  simulatedSuccess!: boolean;

  @Column({ name: 'simulated_error', type: 'text', nullable: true })
  simulatedError!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
