import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { FitmentMake } from './fitment-make.entity.js';
import { FitmentModel } from './fitment-model.entity.js';
import { FitmentSubmodel } from './fitment-submodel.entity.js';
import { FitmentEngine } from './fitment-engine.entity.js';

export type FitmentSource = 'manual' | 'aces_import' | 'ai_detected' | 'bulk_import';

@Entity('part_fitments')
@Unique(['listingId', 'makeId', 'modelId', 'yearStart', 'yearEnd', 'engineId'])
@Index('idx_fitment_listing', ['listingId'])
@Index('idx_fitment_vehicle', ['makeId', 'modelId', 'yearStart', 'yearEnd'])
export class PartFitment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @ManyToOne(() => ListingRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: ListingRecord;

  @Column({ name: 'make_id', type: 'integer' })
  makeId!: number;

  @ManyToOne(() => FitmentMake)
  @JoinColumn({ name: 'make_id' })
  make?: FitmentMake;

  @Column({ name: 'model_id', type: 'integer' })
  modelId!: number;

  @ManyToOne(() => FitmentModel)
  @JoinColumn({ name: 'model_id' })
  model?: FitmentModel;

  @Column({ name: 'submodel_id', type: 'integer', nullable: true })
  submodelId!: number | null;

  @ManyToOne(() => FitmentSubmodel, { nullable: true })
  @JoinColumn({ name: 'submodel_id' })
  submodel?: FitmentSubmodel;

  @Column({ name: 'year_start', type: 'smallint' })
  yearStart!: number;

  @Column({ name: 'year_end', type: 'smallint' })
  yearEnd!: number;

  @Column({ name: 'engine_id', type: 'integer', nullable: true })
  engineId!: number | null;

  @ManyToOne(() => FitmentEngine, { nullable: true })
  @JoinColumn({ name: 'engine_id' })
  engine?: FitmentEngine;

  // ─── Source tracking ───
  @Column({ type: 'varchar', length: 20, default: 'manual' })
  source!: FitmentSource;

  @Column({ type: 'real', nullable: true })
  confidence!: number | null;

  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
