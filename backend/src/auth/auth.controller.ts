import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RbacService } from '../rbac/rbac.service.js';
import { AuthAuditService } from './auth-audit.service.js';
import { AuthService } from './auth.service';
import { UserOrganizationService } from './user-organization.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { User } from './entities/user.entity.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly userOrgs: UserOrganizationService,
    private readonly rbac: RbacService,
    private readonly authAudit: AuthAuditService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request) {
    const result = await this.auth.validateAndSign(body.email, body.password);
    if (!result) {
      await this.authAudit.log('auth.login_failed', {
        metadata: { email: body.email?.toLowerCase() },
        req,
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.authAudit.log('auth.login_success', {
      actorId: result.user.id,
      entityId: result.user.id,
      req,
    });
    return result;
  }

  @Public()
  @Post('register')
  async register(@Body() body: RegisterDto, @Req() req: Request) {
    const result = await this.auth.register(body.email, body.password, body.name);
    await this.authAudit.log('auth.register', {
      actorId: result.user.id,
      entityId: result.user.id,
      req,
    });
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user with permissions' })
  async me(@CurrentUser() user: User, @Req() req: Request) {
    const profile = await this.rbac.getAuthProfile(user);
    const organizations = await this.userOrgs.listForUser(user.id);
    return {
      user: profile,
      organizations:
        organizations.length > 0
          ? organizations
          : [await this.userOrgs.ensureDefaultForUser(user.id)],
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (client should discard token)' })
  async logout(@CurrentUser() user: User, @Req() req: Request) {
    await this.authAudit.log('auth.logout', {
      actorId: user.id,
      entityId: user.id,
      req,
    });
    return { ok: true };
  }

  @Get('organizations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List RealTrack workspaces for the signed-in user (internal tenant, not eBay)',
  })
  async listOrganizations(@CurrentUser() user: User) {
    const organizations = await this.userOrgs.listForUser(user.id);
    if (organizations.length === 0) {
      const created = await this.userOrgs.ensureDefaultForUser(user.id);
      return { organizations: [created] };
    }
    return { organizations };
  }
}
