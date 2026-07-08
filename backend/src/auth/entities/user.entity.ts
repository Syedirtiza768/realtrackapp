import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'user' | 'viewer';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  email: string;

  @Column({ type: 'text', select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'store_access_all', type: 'boolean', default: false })
  storeAccessAll: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
