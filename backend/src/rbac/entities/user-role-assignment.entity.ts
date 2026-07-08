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
import { User } from '../../auth/entities/user.entity.js';
import { Role } from './role.entity.js';

@Entity({ name: 'user_roles' })
@Unique('uq_user_roles_user_role', ['userId', 'roleId'])
export class UserRoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index('idx_user_roles_user')
  userId: string;

  @Column({ type: 'uuid' })
  @Index('idx_user_roles_role')
  roleId: string;

  @Column({ type: 'boolean', default: true })
  isPrimary: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Role, (role) => role.userAssignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
