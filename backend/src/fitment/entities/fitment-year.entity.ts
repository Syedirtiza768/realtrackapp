import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('fitment_years')
@Unique(['year'])
export class FitmentYear {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'smallint' })
  year!: number;
}
