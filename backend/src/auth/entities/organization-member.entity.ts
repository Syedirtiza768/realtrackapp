import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity.js';
import { User } from './user.entity.js';

export type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer';

/**
 * Join table linking Users to Organizations with a role.
 * A user can belong to multiple organizations.
 * An organization can have multiple users.
 */
@Entity('organization_members')
@Unique('uq_org_member', ['organizationId', 'userId'])
@Index('idx_org_member_user', ['userId'])
export class OrganizationMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => Organization, (o) => o.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 20, default: 'editor' })
  role!: OrgRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
