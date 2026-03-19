import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

/**
 * MasterProduct — Canonical product record.
 *
 * The single source of truth for a product, independent of any channel.
 * eBay offers, cross-references, and fitment data all link back here.
 * Multiple eBay offers (one per store) can reference the same MasterProduct.
 */
@Entity('master_products')
@Index('idx_master_product_sku', ['sku'], { unique: true })
@Index('idx_master_product_brand', ['brand'])
@Index('idx_master_product_mpn', ['mpn'])
@Index('idx_master_product_oem', ['oemNumber'])
@Index('idx_master_product_part_type', ['partType'])
@Index('idx_master_product_org', ['organizationId'])
@Index('idx_master_product_status', ['status'])
export class MasterProduct {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Multi-tenant: nullable until multi-tenant flag is enabled */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  // ──────────────────────────── Core Identifiers ──────────────────

  /** Internal SKU — unique within the platform */
  @Column({ type: 'varchar', length: 100 })
  sku!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  brand!: string | null;

  /** Manufacturer Part Number */
  @Column({ name: 'mpn', type: 'varchar', length: 200, nullable: true })
  mpn!: string | null;

  /** OEM/OE Part Number */
  @Column({ name: 'oem_number', type: 'varchar', length: 200, nullable: true })
  oemNumber!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  upc!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ean!: string | null;

  /** eBay Product ID */
  @Column({ type: 'varchar', length: 100, nullable: true })
  epid!: string | null;

  // ──────────────────────────── Product Details ───────────────────

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** Part type / category (e.g. 'Brake Pad Set') */
  @Column({ name: 'part_type', type: 'varchar', length: 200, nullable: true })
  partType!: string | null;

  /** Condition: NEW, USED_EXCELLENT, etc. */
  @Column({ type: 'varchar', length: 50, default: 'NEW' })
  condition!: string;

  @Column({ name: 'condition_description', type: 'text', nullable: true })
  conditionDescription!: string | null;

  /** Full HTML description */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Short plain-text description */
  @Column({ name: 'short_description', type: 'text', nullable: true })
  shortDescription!: string | null;

  /** Key features (array of strings) */
  @Column({ type: 'jsonb', default: '[]' })
  features!: string[];

  // ──────────────────────────── Pricing ───────────────────────────

  /** Base cost (what we paid) — NUMERIC for precision */
  @Column({ name: 'cost_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  costPrice!: number | null;

  /** Base retail price — NUMERIC for precision */
  @Column({ name: 'retail_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  retailPrice!: number | null;

  /** MAP (Minimum Advertised Price) */
  @Column({ name: 'map_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  mapPrice!: number | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  // ──────────────────────────── Inventory ─────────────────────────

  /** Total available quantity across all locations */
  @Column({ name: 'total_quantity', type: 'integer', default: 0 })
  totalQuantity!: number;

  /** Warehouse location identifier */
  @Column({ name: 'warehouse_location', type: 'varchar', length: 100, nullable: true })
  warehouseLocation!: string | null;

  /** Weight in pounds */
  @Column({ name: 'weight_lbs', type: 'numeric', precision: 8, scale: 2, nullable: true })
  weightLbs!: number | null;

  /** Dimensions as JSONB {length, width, height, unit} */
  @Column({ type: 'jsonb', nullable: true })
  dimensions!: Record<string, unknown> | null;

  // ──────────────────────────── Media ─────────────────────────────

  /** Image URLs array (first = primary) */
  @Column({ name: 'image_urls', type: 'jsonb', default: '[]' })
  imageUrls!: string[];

  // ──────────────────────────── Classification ────────────────────

  /** eBay category ID (leaf category) */
  @Column({ name: 'ebay_category_id', type: 'varchar', length: 50, nullable: true })
  ebayCategoryId!: string | null;

  /** eBay category name (for display) */
  @Column({ name: 'ebay_category_name', type: 'varchar', length: 300, nullable: true })
  ebayCategoryName!: string | null;

  /** Item specifics / aspects (key → value arrays, eBay format) */
  @Column({ name: 'item_specifics', type: 'jsonb', default: '{}' })
  itemSpecifics!: Record<string, string[]>;

  // ──────────────────────────── AI Enrichment ─────────────────────

  /** AI-suggested search keywords */
  @Column({ name: 'ai_search_keywords', type: 'jsonb', default: '[]' })
  aiSearchKeywords!: string[];

  /** AI confidence scores */
  @Column({ name: 'ai_confidence', type: 'jsonb', nullable: true })
  aiConfidence!: Record<string, number> | null;

  /** When AI enrichment last ran */
  @Column({ name: 'ai_enriched_at', type: 'timestamptz', nullable: true })
  aiEnrichedAt!: Date | null;

  // ──────────────────────────── Status ────────────────────────────

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: 'draft' | 'ready' | 'published' | 'archived' | 'error';

  /** Source file/spreadsheet this product was imported from */
  @Column({ name: 'source_file', type: 'varchar', length: 500, nullable: true })
  sourceFile!: string | null;

  /** Original listing record ID (FK to listing_records) */
  @Column({ name: 'listing_record_id', type: 'uuid', nullable: true })
  listingRecordId!: string | null;

  // ──────────────────────────── Timestamps ────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
