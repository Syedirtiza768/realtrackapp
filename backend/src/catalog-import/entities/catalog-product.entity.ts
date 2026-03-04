import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Master catalog product — the single source of truth for all products
 * across all import sources and marketplace channels.
 */
@Entity('catalog_products')
@Index('idx_catalog_sku', ['sku'], { unique: true, where: '"sku" IS NOT NULL' })
@Index('idx_catalog_mpn', ['mpn'])
@Index('idx_catalog_upc', ['upc'], { unique: true, where: '"upc" IS NOT NULL' })
@Index('idx_catalog_ebay_item_id', ['ebayItemId'], { unique: true, where: '"ebay_item_id" IS NOT NULL' })
@Index('idx_catalog_brand_mpn', ['brandNormalized', 'mpnNormalized'])
@Index('idx_catalog_title_normalized', ['titleNormalized'])
@Index('idx_catalog_brand', ['brandNormalized'])
export class CatalogProduct {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ── Primary identifiers ───────────────────────────────── */

  @Column({ type: 'text', nullable: true })
  sku!: string | null;

  @Column({ type: 'text', nullable: true })
  mpn!: string | null;

  @Column({ name: 'mpn_normalized', type: 'text', nullable: true })
  mpnNormalized!: string | null;

  @Column({ type: 'text', nullable: true })
  upc!: string | null;

  @Column({ type: 'text', nullable: true })
  ean!: string | null;

  @Column({ name: 'ebay_item_id', type: 'text', nullable: true })
  ebayItemId!: string | null;

  @Column({ type: 'text', nullable: true })
  epid!: string | null;

  /* ── Product details ───────────────────────────────────── */

  @Column({ type: 'text' })
  title!: string;

  @Column({ name: 'title_normalized', type: 'text', nullable: true })
  titleNormalized!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  brand!: string | null;

  @Column({ name: 'brand_normalized', type: 'text', nullable: true })
  brandNormalized!: string | null;

  @Column({ name: 'part_type', type: 'text', nullable: true })
  partType!: string | null;

  @Column({ type: 'text', nullable: true })
  placement!: string | null;

  @Column({ type: 'text', nullable: true })
  material!: string | null;

  @Column({ type: 'text', nullable: true })
  features!: string | null;

  @Column({ name: 'country_of_origin', type: 'text', nullable: true })
  countryOfOrigin!: string | null;

  @Column({ name: 'oem_part_number', type: 'text', nullable: true })
  oemPartNumber!: string | null;

  /* ── Pricing & inventory ───────────────────────────────── */

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price!: number | null;

  @Column({ type: 'int', nullable: true })
  quantity!: number | null;

  @Column({ name: 'condition_id', type: 'text', nullable: true })
  conditionId!: string | null;

  @Column({ name: 'condition_label', type: 'text', nullable: true })
  conditionLabel!: string | null;

  /* ── Category ──────────────────────────────────────────── */

  @Column({ name: 'category_id', type: 'text', nullable: true })
  categoryId!: string | null;

  @Column({ name: 'category_name', type: 'text', nullable: true })
  categoryName!: string | null;

  /* ── Images ────────────────────────────────────────────── */

  @Column({ name: 'image_urls', type: 'text', array: true, default: '{}' })
  imageUrls!: string[];

  /* ── Shipping & policies ───────────────────────────────── */

  @Column({ type: 'text', nullable: true })
  location!: string | null;

  @Column({ type: 'text', nullable: true })
  format!: string | null;

  @Column({ type: 'text', nullable: true })
  duration!: string | null;

  @Column({ name: 'shipping_profile', type: 'text', nullable: true })
  shippingProfile!: string | null;

  @Column({ name: 'return_profile', type: 'text', nullable: true })
  returnProfile!: string | null;

  @Column({ name: 'payment_profile', type: 'text', nullable: true })
  paymentProfile!: string | null;

  /* ── Fitment compatibility (raw JSON) ──────────────────── */

  @Column({ name: 'fitment_data', type: 'jsonb', nullable: true })
  fitmentData!: Record<string, unknown>[] | null;

  /* ── Source tracking ───────────────────────────────────── */

  @Column({ name: 'source_file', type: 'text', nullable: true })
  sourceFile!: string | null;

  @Column({ name: 'source_row', type: 'int', nullable: true })
  sourceRow!: number | null;

  @Column({ name: 'import_id', type: 'uuid', nullable: true })
  importId!: string | null;

  /* ── Audit columns ─────────────────────────────────────── */

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /* ── Full-text search vector (managed by DB trigger) ──── */
  @Column({
    type: 'tsvector',
    nullable: true,
    select: false,
  })
  searchVector!: string | null;
}
