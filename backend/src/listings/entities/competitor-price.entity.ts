import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * CompetitorPrice — Snapshot of competitor pricing from eBay Browse API.
 *
 * Stores pricing data from competitive analysis for:
 *  - Historical pricing trends
 *  - AI competitive analysis pipeline input
 *  - Dashboard market intelligence widgets
 */
@Entity('competitor_prices')
@Index('idx_competitor_part', ['partNumber'])
@Index('idx_competitor_captured', ['capturedAt'])
@Index('idx_competitor_product', ['masterProductId'])
export class CompetitorPrice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Master product this competitor data relates to (nullable for ad-hoc searches) */
  @Column({ name: 'master_product_id', type: 'uuid', nullable: true })
  masterProductId!: string | null;

  /** Part number or search query used */
  @Column({ name: 'part_number', type: 'varchar', length: 200 })
  partNumber!: string;

  /** eBay item ID of the competitor listing */
  @Column({ name: 'ebay_item_id', type: 'varchar', length: 100, nullable: true })
  ebayItemId!: string | null;

  /** Competitor listing title */
  @Column({ type: 'varchar', length: 300, nullable: true })
  title!: string | null;

  /** Seller username */
  @Column({ type: 'varchar', length: 100, nullable: true })
  seller!: string | null;

  /** Listed price */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price!: number;

  /** Currency */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  /** Condition */
  @Column({ type: 'varchar', length: 50, nullable: true })
  condition!: string | null;

  /** Quantity available */
  @Column({ name: 'quantity_available', type: 'integer', nullable: true })
  quantityAvailable!: number | null;

  /** Quantity sold */
  @Column({ name: 'quantity_sold', type: 'integer', nullable: true })
  quantitySold!: number | null;

  /** When this snapshot was taken */
  @Column({ name: 'captured_at', type: 'timestamptz' })
  capturedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
