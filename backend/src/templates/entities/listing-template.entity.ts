import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TemplateType = 'description' | 'title' | 'full';

@Entity({ name: 'listing_templates' })
export class ListingTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 200 })
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  /** If null, applies to all channels */
  @Column('varchar', { length: 30, nullable: true })
  channel: string | null;

  @Column('varchar', { length: 100, nullable: true })
  category: string | null;

  @Column('varchar', { length: 30, default: 'description' })
  templateType: TemplateType;

  /** Handlebars/Liquid template content */
  @Column('text')
  content: string;

  /** Optional custom CSS */
  @Column('text', { nullable: true })
  css: string | null;

  /** S3 URL for template preview image */
  @Column('text', { nullable: true })
  previewImage: string | null;

  /** Expected template variables */
  @Column('jsonb', { default: [] })
  variables: Record<string, unknown>[];

  @Column('boolean', { default: false })
  isDefault: boolean;

  @Column('boolean', { default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
