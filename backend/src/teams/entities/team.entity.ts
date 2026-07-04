import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TeamMember } from './team-member.entity.js';

@Entity('teams')
@Index('idx_team_active', ['active'])
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Hex color for UI badges (e.g. #3B82F6) */
  @Column({ type: 'varchar', length: 7, default: '#3B82F6' })
  color!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @OneToMany(() => TeamMember, (m) => m.team)
  members!: TeamMember[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
