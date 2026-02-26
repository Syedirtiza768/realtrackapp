import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'shipping_profiles' })
export class ShippingProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  carrier: string;

  @Column({ type: 'varchar', length: 100 })
  service: string;

  @Column({ type: 'int', default: 1 })
  handlingTime: number;

  @Column({ type: 'varchar', length: 20 })
  costType: 'flat' | 'calculated' | 'free';

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  flatCost: string | null;

  @Column({ type: 'boolean', default: false })
  weightBased: boolean;

  @Column({ type: 'boolean', default: true })
  domesticOnly: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
