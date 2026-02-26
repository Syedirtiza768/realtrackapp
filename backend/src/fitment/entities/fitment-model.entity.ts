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
import { FitmentMake } from './fitment-make.entity.js';

@Entity('fitment_models')
@Unique(['makeId', 'slug'])
export class FitmentModel {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'make_id', type: 'integer' })
  @Index()
  makeId!: number;

  @ManyToOne(() => FitmentMake, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'make_id' })
  make?: FitmentMake;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ name: 'aces_id', type: 'integer', nullable: true, unique: true })
  acesId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
