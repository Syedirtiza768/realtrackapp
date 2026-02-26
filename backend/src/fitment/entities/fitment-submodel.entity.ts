import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { FitmentModel } from './fitment-model.entity.js';

@Entity('fitment_submodels')
@Unique(['modelId', 'name'])
export class FitmentSubmodel {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'model_id', type: 'integer' })
  modelId!: number;

  @ManyToOne(() => FitmentModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'model_id' })
  model?: FitmentModel;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'aces_id', type: 'integer', nullable: true, unique: true })
  acesId!: number | null;
}
