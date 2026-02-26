import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'listing_revisions' })
@Unique('uq_revision_version', ['listingId', 'version'])
export class ListingRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  listingId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  statusBefore: string | null;

  @Column({ type: 'varchar', length: 20 })
  statusAfter: string;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  changeReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  changedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
