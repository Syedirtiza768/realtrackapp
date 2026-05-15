import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';

export type InventoryMovementType =
  | 'manual_adjustment'
  | 'ebay_sale'
  | 'ebay_sync'
  | 'reservation'
  | 'release'
  | 'correction';

@Entity('inventory_movements')
@Index('idx_inv_mov_org', ['organizationId'])
@Index('idx_inv_mov_product', ['catalogProductId'])
export class InventoryMovement {
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

  @Column({ name: 'movement_type', type: 'varchar', length: 40 })
  movementType!: InventoryMovementType;

  @Column({ name: 'quantity_change', type: 'int' })
  quantityChange!: number;

  @Column({ name: 'source_channel', type: 'varchar', length: 40 })
  sourceChannel!: string;

  @Column({ name: 'ebay_account_id', type: 'uuid', nullable: true })
  ebayAccountId!: string | null;

  @ManyToOne(() => ConnectedEbayAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ebay_account_id' })
  ebayAccount!: ConnectedEbayAccount | null;

  @Column({ name: 'ebay_order_id', type: 'varchar', length: 120, nullable: true })
  ebayOrderId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
