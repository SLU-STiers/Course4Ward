import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_TEMPORARY_PASSWORD_KEY } from '../decorators/allow-temporary-password.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  handleRequest<TUser = { mustResetPassword?: boolean }>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const authenticated = super.handleRequest(err, user, info, context) as TUser & {
      mustResetPassword?: boolean;
    };
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_TEMPORARY_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (authenticated?.mustResetPassword && !allowed) {
      throw new ForbiddenException('Change your temporary password before using the system');
    }
    return authenticated;
  }
}
