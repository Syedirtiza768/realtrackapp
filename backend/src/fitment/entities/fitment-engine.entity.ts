import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('fitment_engines')
@Unique(['code'])
export class FitmentEngine {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'displacement_l', type: 'numeric', precision: 4, scale: 1, nullable: true })
  displacementL!: number | null;

  @Column({ type: 'smallint', nullable: true })
  cylinders!: number | null;

  @Column({ name: 'fuel_type', type: 'varchar', length: 30, nullable: true })
  fuelType!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  aspiration!: string | null;

  @Column({ name: 'aces_id', type: 'integer', nullable: true, unique: true })
  acesId!: number | null;
}
