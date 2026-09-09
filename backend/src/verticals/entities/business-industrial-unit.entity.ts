import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';

export type BusinessIndustrialUnitStatus =
  | 'available'
  | 'allocated'
  | 'sold'
  | 'quarantined';

/** One row per physical unit when a B&I listing is serialized. */
@Entity('business_industrial_units')
@Unique('uq_bi_unit_private_serial', ['organizationId', 'serialNumberPrivate'])
@Unique('uq_bi_unit_public_serial', ['organizationId', 'serialNumberPublic'])
@Index('idx_bi_unit_product_status', ['catalogProductId', 'status'])
export class BusinessIndustrialUnit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'catalog_product_id', type: 'uuid' })
  catalogProductId!: string;

  @ManyToOne(() => CatalogProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalog_product_id' })
  catalogProduct!: CatalogProduct;

  /** Private value is permission-gated and never returned in listing payloads. */
  @Column({ name: 'serial_number_private', type: 'text' })
  serialNumberPrivate!: string;

  /** Optional public serial shown to marketplace buyers. */
  @Column({ name: 'serial_number_public', type: 'text', nullable: true })
  serialNumberPublic!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'available' })
  status!: BusinessIndustrialUnitStatus;

  @Column({ name: 'allocated_store_id', type: 'uuid', nullable: true })
  allocatedStoreId!: string | null;

  @Column({ name: 'allocated_offer_id', type: 'varchar', length: 100, nullable: true })
  allocatedOfferId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
