import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrganizationMember } from './organization-member.entity.js';

/**
 * Organization entity for multi-tenant support.
 *
 * An Organization is the top-level tenant boundary. All resources
 * (listings, channels, stores, orders, etc.) belong to an Organization.
 *
 * Users are linked to Organizations through OrganizationMember (many-to-many with role).
 * A single user may belong to multiple organizations.
 *
 * This feature is gated behind the `multi_tenant` feature flag.
 */
@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string;

  /** Billing plan: 'free' | 'starter' | 'professional' | 'enterprise' */
  @Column({ type: 'varchar', length: 30, default: 'free' })
  plan!: string;

  /** Max number of listings allowed under the plan (null = unlimited) */
  @Column({ name: 'listing_limit', type: 'int', nullable: true })
  listingLimit!: number | null;

  /** Max number of channel connections allowed (null = unlimited) */
  @Column({ name: 'connection_limit', type: 'int', nullable: true })
  connectionLimit!: number | null;

  /** Max number of members (null = unlimited) */
  @Column({ name: 'member_limit', type: 'int', nullable: true })
  memberLimit!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'suspended' | 'cancelled';

  /** Organization-wide settings */
  @Column({ type: 'jsonb', default: '{}' })
  settings!: Record<string, unknown>;

  @OneToMany(() => OrganizationMember, (m) => m.organization, { cascade: true })
  members!: OrganizationMember[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
