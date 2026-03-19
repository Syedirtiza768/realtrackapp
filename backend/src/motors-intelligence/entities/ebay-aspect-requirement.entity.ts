import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AspectRequirementLevel {
  REQUIRED = 'required',
  RECOMMENDED = 'recommended',
  OPTIONAL = 'optional',
}

@Entity('ebay_aspect_requirements')
@Index('idx_ebay_aspect_category', ['ebayCategoryId'])
@Index('idx_ebay_aspect_name', ['aspectName'])
export class EbayAspectRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  ebayCategoryId: string;

  @Column({ type: 'text' })
  aspectName: string;

  @Column({ type: 'enum', enum: AspectRequirementLevel })
  requirementLevel: AspectRequirementLevel;

  @Column({ type: 'text', nullable: true })
  dataType: string | null; // 'STRING', 'NUMBER', 'DATE'

  @Column({ type: 'text', array: true, nullable: true })
  allowedValues: string[] | null;

  @Column({ type: 'int', nullable: true })
  maxLength: number | null;

  @Column({ type: 'boolean', default: false })
  isMultiValue: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  defaultValue: string | null;

  @Column({ type: 'jsonb', nullable: true })
  validationRules: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;
}
