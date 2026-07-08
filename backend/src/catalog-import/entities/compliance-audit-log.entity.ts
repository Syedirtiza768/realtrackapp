import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditAction =
  | 'validation'
  | 'auto_correction'
  | 'rejection'
  | 'title_optimization'
  | 'description_enhancement'
  | 'category_mapping'
  | 'item_specifics_fill'
  | 'fitment_normalization'
  | 'image_validation'
  | 'pricing_check';

/**
 * Tracks every compliance transformation and validation decision
 * for audit trail purposes.
 */
@Entity('compliance_audit_logs')
@Index('idx_compliance_audit_product', ['productId'])
@Index('idx_compliance_audit_import', ['importId'])
@Index('idx_compliance_audit_action', ['action'])
export class ComplianceAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId!: string | null;

  @Column({ name: 'import_id', type: 'uuid', nullable: true })
  importId!: string | null;

  @Column({ type: 'varchar', length: 40 })
  action!: AuditAction;

  @Column({ type: 'text' })
  field!: string;

  @Column({ name: 'original_value', type: 'text', nullable: true })
  originalValue!: string | null;

  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar', length: 10, default: 'info' })
  severity!: string;

  @Column({
    name: 'compliance_score',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  complianceScore!: number | null;

  @Column({ name: 'auto_fixed', type: 'boolean', default: false })
  autoFixed!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
