import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ListingRecord } from './listing-record.entity.js';

/**
 * Satellite table for product compliance / manufacturer / responsible-person
 * data. Extracted from listing_records (Phase 3.3) to reduce base-table width
 * and keep the hot path (catalog queries) lean.
 */
@Entity({ name: 'listing_compliance' })
@Index('idx_compliance_listing', ['listingId'])
export class ListingCompliance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'listing_id', type: 'uuid', unique: true })
  listingId: string;

  @OneToOne(() => ListingRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: ListingRecord;

  /* ── Product compliance ── */

  @Column({ name: 'product_compliance_policy_id', type: 'text', nullable: true })
  productCompliancePolicyId: string | null;

  @Column({ name: 'regional_product_compliance_policies', type: 'text', nullable: true })
  regionalProductCompliancePolicies: string | null;

  /* ── Product safety ── */

  @Column({ name: 'product_safety_pictograms', type: 'text', nullable: true })
  productSafetyPictograms: string | null;

  @Column({ name: 'product_safety_statements', type: 'text', nullable: true })
  productSafetyStatements: string | null;

  @Column({ name: 'product_safety_component', type: 'text', nullable: true })
  productSafetyComponent: string | null;

  @Column({ name: 'regulatory_document_ids', type: 'text', nullable: true })
  regulatoryDocumentIds: string | null;

  /* ── Manufacturer info ── */

  @Column({ name: 'manufacturer_name', type: 'text', nullable: true })
  manufacturerName: string | null;

  @Column({ name: 'manufacturer_address_line1', type: 'text', nullable: true })
  manufacturerAddressLine1: string | null;

  @Column({ name: 'manufacturer_address_line2', type: 'text', nullable: true })
  manufacturerAddressLine2: string | null;

  @Column({ name: 'manufacturer_city', type: 'text', nullable: true })
  manufacturerCity: string | null;

  @Column({ name: 'manufacturer_country', type: 'text', nullable: true })
  manufacturerCountry: string | null;

  @Column({ name: 'manufacturer_postal_code', type: 'text', nullable: true })
  manufacturerPostalCode: string | null;

  @Column({ name: 'manufacturer_state_or_province', type: 'text', nullable: true })
  manufacturerStateOrProvince: string | null;

  @Column({ name: 'manufacturer_phone', type: 'text', nullable: true })
  manufacturerPhone: string | null;

  @Column({ name: 'manufacturer_email', type: 'text', nullable: true })
  manufacturerEmail: string | null;

  @Column({ name: 'manufacturer_contact_url', type: 'text', nullable: true })
  manufacturerContactUrl: string | null;

  /* ── Responsible person ── */

  @Column({ name: 'responsible_person1', type: 'text', nullable: true })
  responsiblePerson1: string | null;

  @Column({ name: 'responsible_person1_type', type: 'text', nullable: true })
  responsiblePerson1Type: string | null;

  @Column({ name: 'responsible_person1_address_line1', type: 'text', nullable: true })
  responsiblePerson1AddressLine1: string | null;

  @Column({ name: 'responsible_person1_address_line2', type: 'text', nullable: true })
  responsiblePerson1AddressLine2: string | null;

  @Column({ name: 'responsible_person1_city', type: 'text', nullable: true })
  responsiblePerson1City: string | null;

  @Column({ name: 'responsible_person1_country', type: 'text', nullable: true })
  responsiblePerson1Country: string | null;

  @Column({ name: 'responsible_person1_postal_code', type: 'text', nullable: true })
  responsiblePerson1PostalCode: string | null;

  @Column({ name: 'responsible_person1_state_or_province', type: 'text', nullable: true })
  responsiblePerson1StateOrProvince: string | null;

  @Column({ name: 'responsible_person1_phone', type: 'text', nullable: true })
  responsiblePerson1Phone: string | null;

  @Column({ name: 'responsible_person1_email', type: 'text', nullable: true })
  responsiblePerson1Email: string | null;

  @Column({ name: 'responsible_person1_contact_url', type: 'text', nullable: true })
  responsiblePerson1ContactUrl: string | null;

  /* ── Timestamps ── */

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
