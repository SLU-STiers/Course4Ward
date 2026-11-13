import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LAST_SEEN_THROTTLE_MS, touchSession } from './session-activity';

export interface JwtPayload {
  sub: string; // internal user uuid
  userId: string; // hospital login id
  role: string;
  sessionVersion?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        userId: true,
        role: true,
        isActive: true,
        sessionVersion: true,
        mustResetPassword: true,
        lastSeenAt: true,
      },
    });

    if (!user || !user.isActive || user.sessionVersion !== (payload.sessionVersion ?? 0)) {
      throw new UnauthorizedException('Session expired');
    }

    // Keeps the account marked as signed in while it is in use, so a second
    // sign-in elsewhere is refused (see AuthService.login).
    if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() >= LAST_SEEN_THROTTLE_MS) {
      await touchSession(this.prisma, user.id, user.sessionVersion);
    }

    // JwtAuthGuard refuses most routes while this is set.
    return { id: user.id, userId: user.userId, role: user.role, mustResetPassword: user.mustResetPassword };
  }
}
