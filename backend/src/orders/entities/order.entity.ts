import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';

@Entity('orders')
@Index('idx_order_status', ['status'])
@Index('idx_order_channel', ['channel', 'orderedAt'])
@Index('idx_order_date', ['orderedAt'])
@Index('idx_order_buyer', ['buyerEmail'])
@Index('idx_order_external', ['channel', 'externalOrderId'], { unique: true })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ─── Source ───

  @Column({ type: 'varchar', length: 30 })
  channel!: string; // 'ebay' | 'shopify' | 'manual'

  @Column({ name: 'connection_id', type: 'uuid', nullable: true })
  connectionId!: string | null;

  @ManyToOne(() => ChannelConnection, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'connection_id' })
  connection!: ChannelConnection | null;

  @Column({ name: 'external_order_id', type: 'varchar', length: 100, nullable: true })
  externalOrderId!: string | null;

  @Column({ name: 'external_url', type: 'text', nullable: true })
  externalUrl!: string | null;

  // ─── State machine ───

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: string;

  // ─── Buyer info ───

  @Column({ name: 'buyer_username', type: 'varchar', length: 200, nullable: true })
  buyerUsername!: string | null;

  @Column({ name: 'buyer_email', type: 'varchar', length: 200, nullable: true })
  buyerEmail!: string | null;

  @Column({ name: 'buyer_name', type: 'varchar', length: 200, nullable: true })
  buyerName!: string | null;

  // ─── Shipping ───

  @Column({ name: 'shipping_name', type: 'varchar', length: 200, nullable: true })
  shippingName!: string | null;

  @Column({ name: 'shipping_address_1', type: 'text', nullable: true })
  shippingAddress1!: string | null;

  @Column({ name: 'shipping_address_2', type: 'text', nullable: true })
  shippingAddress2!: string | null;

  @Column({ name: 'shipping_city', type: 'varchar', length: 100, nullable: true })
  shippingCity!: string | null;

  @Column({ name: 'shipping_state', type: 'varchar', length: 100, nullable: true })
  shippingState!: string | null;

  @Column({ name: 'shipping_zip', type: 'varchar', length: 20, nullable: true })
  shippingZip!: string | null;

  @Column({ name: 'shipping_country', type: 'char', length: 2, nullable: true })
  shippingCountry!: string | null;

  @Column({ name: 'shipping_method', type: 'varchar', length: 100, nullable: true })
  shippingMethod!: string | null;

  @Column({ name: 'tracking_number', type: 'varchar', length: 100, nullable: true })
  trackingNumber!: string | null;

  @Column({ name: 'tracking_carrier', type: 'varchar', length: 50, nullable: true })
  trackingCarrier!: string | null;

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  // ─── Financials ───

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  subtotal!: string;

  @Column({ name: 'shipping_cost', type: 'numeric', precision: 10, scale: 2, default: 0 })
  shippingCost!: string;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 10, scale: 2, default: 0 })
  taxAmount!: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 10, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency!: string;

  @Column({ name: 'marketplace_fee', type: 'numeric', precision: 10, scale: 2, default: 0 })
  marketplaceFee!: string;

  @Column({ name: 'net_revenue', type: 'numeric', precision: 10, scale: 2, nullable: true })
  netRevenue!: string | null;

  // ─── Refund ───

  @Column({ name: 'refund_amount', type: 'numeric', precision: 10, scale: 2, default: 0 })
  refundAmount!: string;

  @Column({ name: 'refund_reason', type: 'text', nullable: true })
  refundReason!: string | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt!: Date | null;

  // ─── Timestamps ───

  @Column({ name: 'ordered_at', type: 'timestamptz', default: () => 'NOW()' })
  orderedAt!: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
