import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator.js';
import { User } from '../entities/user.entity.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = User>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const authenticated = super.handleRequest<TUser>(err, user, info, context);
    // JwtStrategy reloads the active database user on every request, including SSE.
    if (
      (authenticated as User).passwordChangeRequired &&
      !this.reflector.get<boolean>(ALLOW_PASSWORD_CHANGE_KEY, context.getHandler())
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Change your password before continuing.',
      });
    }
    return authenticated;
  }
}
