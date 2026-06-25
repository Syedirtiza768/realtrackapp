import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { Store } from './store.entity.js';

export type StoreAccessLevel = 'view' | 'operate' | 'admin';

@Entity('user_store_assignments')
@Unique('uq_user_store', ['userId', 'storeId'])
@Index('idx_usa_user', ['userId'])
@Index('idx_usa_store', ['storeId'])
export class UserStoreAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store!: Store;

  @Column({
    name: 'access_level',
    type: 'varchar',
    length: 20,
    default: 'view',
  })
  accessLevel!: StoreAccessLevel;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
