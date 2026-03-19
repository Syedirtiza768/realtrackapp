import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * VinCache — Caches NHTSA VIN decode results to avoid repeated API calls.
 * Cache entries are considered valid for 30 days.
 */
@Entity('vin_cache')
export class VinCache {
  @PrimaryColumn({ type: 'varchar', length: 17 })
  vin!: string;

  @Column({ name: 'decoded_data', type: 'jsonb' })
  decodedData!: Record<string, unknown>;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
