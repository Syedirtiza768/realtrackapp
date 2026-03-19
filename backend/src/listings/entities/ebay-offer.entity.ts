import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MasterProduct } from './master-product.entity.js';
import { Store } from '../../channels/entities/store.entity.js';

/**
 * EbayOffer — Per-store eBay offer record.
 *
 * Links a MasterProduct to a specific eBay store.
 * One MasterProduct can have multiple EbayOffer rows (one per store).
 * Tracks the full lifecycle: draft → published → ended.
 */
@Entity('ebay_offers')
@Index('idx_ebay_offer_product', ['masterProductId'])
@Index('idx_ebay_offer_store', ['storeId'])
@Index('idx_ebay_offer_ebay_offer_id', ['ebayOfferId'], { unique: true, where: '"ebay_offer_id" IS NOT NULL' })
@Index('idx_ebay_offer_ebay_listing_id', ['ebayListingId'])
@Index('idx_ebay_offer_sku_store', ['sku', 'storeId'], { unique: true })
@Index('idx_ebay_offer_status', ['status'])
export class EbayOffer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ──────────────────────────── Relations ─────────────────────────

  @Column({ name: 'master_product_id', type: 'uuid' })
  masterProductId!: string;

  @ManyToOne(() => MasterProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'master_product_id' })
  masterProduct!: MasterProduct;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store!: Store;

  // ──────────────────────────── eBay Identifiers ─────────────────

  /** SKU used on this store (may differ from master SKU) */
  @Column({ type: 'varchar', length: 100 })
  sku!: string;

  /** eBay offer ID (returned by Inventory API) */
  @Column({ name: 'ebay_offer_id', type: 'varchar', length: 100, nullable: true })
  ebayOfferId!: string | null;

  /** eBay listing ID (returned after publishing) */
  @Column({ name: 'ebay_listing_id', type: 'varchar', length: 100, nullable: true })
  ebayListingId!: string | null;

  /** eBay marketplace (e.g. EBAY_US) */
  @Column({ name: 'marketplace_id', type: 'varchar', length: 30, default: 'EBAY_US' })
  marketplaceId!: string;

  // ──────────────────────────── Per-Store Overrides ───────────────

  /** Store-specific title override (null = use master title) */
  @Column({ name: 'title_override', type: 'varchar', length: 200, nullable: true })
  titleOverride!: string | null;

  /** Store-specific price */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price!: number | null;

  /** Store-specific quantity */
  @Column({ type: 'integer', nullable: true })
  quantity!: number | null;

  /** eBay category ID */
  @Column({ name: 'category_id', type: 'varchar', length: 50, nullable: true })
  categoryId!: string | null;

  /** Listing format */
  @Column({ type: 'varchar', length: 20, default: 'FIXED_PRICE' })
  format!: 'FIXED_PRICE' | 'AUCTION';

  // ──────────────────────────── Policy IDs ────────────────────────

  @Column({ name: 'fulfillment_policy_id', type: 'varchar', length: 100, nullable: true })
  fulfillmentPolicyId!: string | null;

  @Column({ name: 'payment_policy_id', type: 'varchar', length: 100, nullable: true })
  paymentPolicyId!: string | null;

  @Column({ name: 'return_policy_id', type: 'varchar', length: 100, nullable: true })
  returnPolicyId!: string | null;

  @Column({ name: 'merchant_location_key', type: 'varchar', length: 100, nullable: true })
  merchantLocationKey!: string | null;

  // ──────────────────────────── Status ────────────────────────────

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: 'draft' | 'pending' | 'published' | 'ended' | 'error';

  /** Last error from eBay API */
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  /** Last time this offer was synced with eBay */
  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  /** When the offer was first published */
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  /** When the listing was ended */
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  // ──────────────────────────── Timestamps ────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
