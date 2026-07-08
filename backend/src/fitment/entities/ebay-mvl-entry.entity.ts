import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EbayMvlRelease } from './ebay-mvl-release.entity.js';

@Entity('ebay_mvl_entries')
@Index('idx_ebay_mvl_entries_lookup', ['marketplace', 'make', 'model', 'year'])
@Index('idx_ebay_mvl_entries_make', ['marketplace', 'make'])
@Index('idx_ebay_mvl_entries_release', ['releaseId'])
export class EbayMvlEntry {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'release_id', type: 'uuid' })
  releaseId!: string;

  @ManyToOne(() => EbayMvlRelease, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'release_id' })
  release?: EbayMvlRelease;

  @Column({ type: 'varchar', length: 4 })
  marketplace!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  epid!: string | null;

  @Column({ type: 'varchar', length: 120 })
  make!: string;

  @Column({ type: 'varchar', length: 120 })
  model!: string;

  @Column({ type: 'smallint' })
  year!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  trim!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  engine!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  submodel!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  variant!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  platform!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  body!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ktype!: string | null;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  displayName!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  extras!: Record<string, unknown> | null;
}
