import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'client_settings' })
export class ClientSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null = global singleton row for single-tenant deployments. */
  @Column({ type: 'uuid', nullable: true })
  @Index('idx_client_settings_org', { unique: true })
  organizationId: string | null;

  @Column({ type: 'varchar', length: 200, default: 'RealTrackApp' })
  appName: string;

  @Column({ type: 'varchar', length: 200, default: 'RealTrack' })
  clientName: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  shortName: string | null;

  @Column({ type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  faviconUrl: string | null;

  @Column({ type: 'text', nullable: true })
  loginLogoUrl: string | null;

  @Column({ type: 'varchar', length: 20, default: '#2563eb' })
  primaryColor: string;

  @Column({ type: 'varchar', length: 20, default: '#1e293b' })
  secondaryColor: string;

  @Column({ type: 'varchar', length: 20, default: '#0ea5e9' })
  accentColor: string;

  @Column({ type: 'varchar', length: 20, default: 'dark' })
  themeMode: string;

  @Column({ type: 'varchar', length: 40, default: 'slate' })
  sidebarTheme: string;

  @Column({ type: 'varchar', length: 40, default: 'slate' })
  navbarTheme: string;

  @Column({ type: 'text', nullable: true })
  footerText: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  supportEmail: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  supportPhone: string | null;

  @Column({ type: 'boolean', default: true })
  whiteLabelEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  poweredByVisible: boolean;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
