import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LoginDto } from './dto/login.dto';
import {
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
} from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private auditLog: AuditLogService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId: dto.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.auditLog.record({ userId: user.id, action: 'LOGIN' });

    return {
      ...(await this.issueTokens(user.id, user.userId, user.role)),
      mustResetPassword: user.mustResetPassword,
      user: {
        id: user.id,
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mustResetPassword: user.mustResetPassword,
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
    const user = await this.prisma.user.findUnique({
      where: { userId: dto.userId },
    });
    if (!user) {
      // Do not reveal whether a userId exists
      return { message: 'If the account exists, a reset code was issued.' };
    }

    await this.prisma.passwordResetRequest.updateMany({
      where: { userId: user.id, status: 'PENDING' },
      data: { status: 'EXPIRED', resolvedAt: new Date() },
    });

    await this.prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        token: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    return { message: 'Reset request submitted for administrator approval.' };
  }

  async findPasswordResetRequests() {
    return this.prisma.passwordResetRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      include: {
        user: {
          select: { userId: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  async approvePasswordReset(requestId: string, actingAdminId: string) {
    const request = await this.prisma.passwordResetRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) throw new NotFoundException('Password reset request not found');
    if (request.status !== 'PENDING' || request.expiresAt < new Date()) {
      throw new BadRequestException('Password reset request is no longer pending');
    }

    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: request.userId },
        data: { passwordHash, mustResetPassword: true },
      }),
      this.prisma.passwordResetRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED', resolvedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({ userId: actingAdminId, action: 'PASSWORD_RESET' });

    return {
      message: 'Password reset approved.',
      temporaryPassword,
      user: {
        userId: request.user.userId,
        firstName: request.user.firstName,
        lastName: request.user.lastName,
      },
    };
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    const request = await this.prisma.passwordResetRequest.findUnique({
      where: { token: dto.resetToken },
    });
    if (
      !request ||
      request.userId !== dto.userId ||
      request.status !== 'APPROVED' ||
      request.resolvedAt ||
      request.expiresAt < new Date()
    ) {
      throw new ForbiddenException('Reset code invalid or expired');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: request.userId },
      data: { passwordHash, mustResetPassword: false },
    });

    await this.prisma.passwordResetRequest.update({
      where: { id: request.id },
      data: { resolvedAt: new Date() },
    });

    await this.auditLog.record({
      userId: request.userId,
      action: 'PASSWORD_RESET',
    });

    return { message: 'Password updated successfully.' };
  }

  async changePassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustResetPassword: false },
    });

    await this.auditLog.record({ userId, action: 'PASSWORD_RESET' });
    return { message: 'Password updated successfully.' };
  }
}
