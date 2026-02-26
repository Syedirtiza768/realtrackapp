import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'sales_records' })
export class SalesRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'uuid' })
  @Index('idx_sales_listing')
  listingId: string;

  @Column({ type: 'varchar', length: 30 })
  @Index('idx_sales_channel')
  channel: string;

  @Column({ type: 'int', default: 1 })
  quantitySold: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  salePrice: string;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  marketplaceFee: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  netRevenue: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  @Index('idx_sales_date')
  soldAt: Date;
}
