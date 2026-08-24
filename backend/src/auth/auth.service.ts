import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LoginDto } from './dto/login.dto';
import {
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
} from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private database: DatabaseService,
    private jwt: JwtService,
    private config: ConfigService,
    private auditLog: AuditLogService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.database.user.findUnique({
      where: { userId: dto.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.auditLog.record({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      ...(await this.issueTokens(user.id, user.userId, user.role)),
      mustResetPassword: user.mustResetPassword,
      user: {
        id: user.id,
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async issueTokens(sub: string, userId: string, role: string) {
    const payload = { sub, userId, role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    });
    return { accessToken, refreshToken };
  }

  // Step 1: staff requests a reset from the login page. In production this
  // hands off to an IT-desk-issued one-time code rather than email, since
  // this is a LAN-only system. Stubbed here to return a token directly for
  // local development.
  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.database.user.findUnique({
      where: { userId: dto.userId },
    });
    if (!user) {
      // Do not reveal whether a userId exists
      return { message: 'If the account exists, a reset code was issued.' };
    }

    const resetToken = await this.jwt.signAsync(
      { sub: user.id, purpose: 'password_reset' },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: '15m' },
    );

    // TODO: deliver resetToken via hospital IT desk / admin workflow instead
    // of returning it in the API response.
    return { message: 'Reset code issued.', devOnlyResetToken: resetToken };
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(dto.resetToken, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new ForbiddenException('Reset code invalid or expired');
    }
    if (payload.purpose !== 'password_reset') {
      throw new ForbiddenException('Invalid reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.database.user.update({
      where: { id: payload.sub },
      data: { passwordHash, mustResetPassword: false },
    });

    await this.auditLog.record({
      userId: payload.sub,
      action: 'PASSWORD_RESET',
      entityType: 'User',
      entityId: payload.sub,
    });

    return { message: 'Password updated successfully.' };
  }
}
