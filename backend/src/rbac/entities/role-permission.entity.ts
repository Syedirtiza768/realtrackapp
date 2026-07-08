import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Permission } from './permission.entity.js';
import { Role } from './role.entity.js';

@Entity({ name: 'role_permissions' })
@Unique('uq_role_permissions_role_permission', ['roleId', 'permissionId'])
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index('idx_role_permissions_role')
  roleId: string;

  @Column({ type: 'uuid' })
  @Index('idx_role_permissions_permission')
  permissionId: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId' })
  permission: Permission;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
