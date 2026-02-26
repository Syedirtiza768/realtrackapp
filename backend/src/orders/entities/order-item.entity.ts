import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity.js';

@Entity('order_items')
@Index('idx_order_item_order', ['orderId'])
@Index('idx_order_item_listing', ['listingId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId!: string | null;

  @Column({ name: 'external_item_id', type: 'varchar', length: 100, nullable: true })
  externalItemId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku!: string | null;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'integer', default: 1 })
  quantity!: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2 })
  unitPrice!: string;

  @Column({ name: 'total_price', type: 'numeric', precision: 10, scale: 2 })
  totalPrice!: string;

  @Column({ type: 'boolean', default: false })
  fulfilled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
