import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type PartsSearchEventType = 'query' | 'select' | 'request';
export type PartsSearchRequestStatus = 'open' | 'done' | 'dismissed';

/**
 * Parts Search audit + demand log.
 *
 * - `query`: every options search (who, what, which vehicle, how many options,
 *   how many in stock). `demand = true` when nothing was found or nothing is
 *   in stock — the "searched but could not sell" signal.
 * - `select`: a staff member opened / copied a specific part from the results.
 * - `request`: an explicit sourcing request from the results page; procurement
 *   works these (`status`).
 */
@Entity('parts_search_events')
@Index('idx_pse_type_created', ['type', 'createdAt'])
@Index('idx_pse_demand_created', ['demand', 'createdAt'])
export class PartsSearchEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;

  @Column({ type: 'varchar', length: 12 }) type!: PartsSearchEventType;

  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId!: string | null;

  @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true }) userEmail!: string | null;

  @Column({ type: 'text', default: '' }) query!: string;

  /** Normalized part numbers the query contained. */
  @Column({ type: 'text', array: true, default: () => "'{}'" }) numbers!: string[];

  /** Resolved vehicle (label, make, model, year, engine litres). */
  @Column({ type: 'jsonb', nullable: true }) vehicle!: Record<string, unknown> | null;

  @Column({ name: 'result_count', type: 'integer', default: 0 }) resultCount!: number;

  @Column({ name: 'in_stock_count', type: 'integer', default: 0 }) inStockCount!: number;

  @Column({ name: 'fits_count', type: 'integer', default: 0 }) fitsCount!: number;

  @Column({ type: 'boolean', default: false }) demand!: boolean;

  /** PartsBazar360 part id (select) or the part the request is about. */
  @Column({ name: 'part_id', type: 'varchar', length: 100, nullable: true }) partId!: string | null;

  /** PartsBazar360 options requestId, to tie selections to the query. */
  @Column({ name: 'request_ref', type: 'varchar', length: 64, nullable: true }) requestRef!: string | null;

  @Column({ type: 'text', nullable: true }) note!: string | null;

  @Column({ type: 'varchar', length: 12, nullable: true }) status!: PartsSearchRequestStatus | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy!: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true }) updatedAt!: Date | null;
}
