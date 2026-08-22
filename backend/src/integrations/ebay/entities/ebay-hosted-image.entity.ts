import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../../channels/entities/store.entity.js';

/**
 * Maps an app-hosted source image to its eBay Picture Services URL for one
 * eBay store. EPS images are account-scoped, so a store must not reuse a URL
 * uploaded for a different seller account.
 */
@Entity('ebay_hosted_images')
@Index('uq_ebay_hosted_images_store_source', ['storeId', 'sourceUrl'], {
  unique: true,
})
@Index('idx_ebay_hosted_images_store', ['storeId'])
export class EbayHostedImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store!: Store;

  @Column({ name: 'source_url', type: 'text' })
  sourceUrl!: string;

  @Column({ name: 'hosted_url', type: 'text' })
  hostedUrl!: string;

  @Column({ name: 'image_id', type: 'varchar', length: 255, nullable: true })
  imageId!: string | null;

  @Column({ name: 'expiration_date', type: 'timestamptz', nullable: true })
  expirationDate!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
