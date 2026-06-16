import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../dashboard/entities/audit-log.entity.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { AuthAuditService } from './auth-audit.service.js';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserOrganizationService } from './user-organization.service.js';
import { JwtStrategy } from './jwt.strategy';
import { User } from './entities/user.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationMember } from './entities/organization-member.entity';

@Module({
  imports: [
    RbacModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-in-production'),
        signOptions: {
          expiresIn: Number(config.get<string>('JWT_EXPIRY_SECONDS', '14400')),
        },
      }),
    }),
    TypeOrmModule.forFeature([User, Organization, OrganizationMember, AuditLog]),
  ],
  controllers: [AuthController],
  providers: [AuthService, UserOrganizationService, JwtStrategy, AuthAuditService],
  exports: [
    AuthService,
    UserOrganizationService,
    AuthAuditService,
    JwtModule,
    PassportModule,
    TypeOrmModule,
  ],
})
export class AuthModule {}
