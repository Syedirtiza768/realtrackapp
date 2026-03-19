import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * EbayCategory — Cached eBay category tree data.
 *
 * Stores category hierarchy from eBay Taxonomy API for:
 *  - Fast category browsing in the UI
 *  - AI category classification
 *  - Item aspect lookups without hitting eBay API every time
 *
 * Refreshed periodically (weekly) via a scheduler job.
 */
@Entity('ebay_categories')
@Index('idx_ebay_cat_id_tree', ['ebayCategoryId', 'treeId'], { unique: true })
@Index('idx_ebay_cat_parent', ['parentCategoryId'])
@Index('idx_ebay_cat_name', ['categoryName'])
@Index('idx_ebay_cat_leaf', ['isLeaf'])
export class EbayCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** eBay category ID */
  @Column({ name: 'ebay_category_id', type: 'varchar', length: 50 })
  ebayCategoryId!: string;

  /** Category tree ID (e.g. '0' for US) */
  @Column({ name: 'tree_id', type: 'varchar', length: 10 })
  treeId!: string;

  /** Parent category ID (null for root) */
  @Column({ name: 'parent_category_id', type: 'varchar', length: 50, nullable: true })
  parentCategoryId!: string | null;

  /** Category name */
  @Column({ name: 'category_name', type: 'varchar', length: 300 })
  categoryName!: string;

  /** Full path from root (e.g. "eBay Motors > Parts & Accessories > ...") */
  @Column({ name: 'category_path', type: 'text', nullable: true })
  categoryPath!: string | null;

  /** Depth in tree (0 = root) */
  @Column({ type: 'integer', default: 0 })
  depth!: number;

  /** Whether this is a leaf category (can list items) */
  @Column({ name: 'is_leaf', type: 'boolean', default: false })
  isLeaf!: boolean;

  /** Required item aspects for this category (cached JSON) */
  @Column({ name: 'required_aspects', type: 'jsonb', default: '[]' })
  requiredAspects!: Record<string, unknown>[];

  /** Recommended item aspects (cached JSON) */
  @Column({ name: 'recommended_aspects', type: 'jsonb', default: '[]' })
  recommendedAspects!: Record<string, unknown>[];

  /** Whether this category supports vehicle compatibility */
  @Column({ name: 'supports_compatibility', type: 'boolean', default: false })
  supportsCompatibility!: boolean;

  /** Category tree version (to detect stale cache) */
  @Column({ name: 'tree_version', type: 'varchar', length: 50, nullable: true })
  treeVersion!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
