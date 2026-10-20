import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService, LOGOUT_REASONS, LogoutReason, RESET_REQUEST_TTL_MS } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
} from './dto/reset-password.dto';
import { IsIn, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string;
}

const RESET_TOKEN_COOKIE = 'resetToken';
const RESET_TOKEN_COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, path: '/' };

class LogoutDto {
  @IsIn(LOGOUT_REASONS)
  reason: LogoutReason;
}

class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Body() dto: LogoutDto, @CurrentUser() user: any) {
    return this.authService.logout(user.id, dto.reason);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  session(@CurrentUser() user: any) {
    return { authenticated: true, user };
  }

  @Post('password-reset/request')
  async requestReset(
    @Body() dto: RequestPasswordResetDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resetToken = await this.authService.createPasswordResetRequest(dto.userId, req.ip);

    res.cookie(RESET_TOKEN_COOKIE, resetToken, {
      ...RESET_TOKEN_COOKIE_OPTIONS,
      maxAge: RESET_REQUEST_TTL_MS,
    });

    return { message: 'Reset request submitted for administrator approval.' };
  }

  // The httpOnly cookie is what lets the login page get its temporary password
  // back after a refresh: the password itself never touches client storage.
  @Get('password-reset/status')
  async passwordResetStatus(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieToken = req.headers.cookie
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${RESET_TOKEN_COOKIE}=`))
      ?.split('=')
      .slice(1)
      .join('=');

    const result = await this.authService.getPasswordResetStatus(cookieToken ?? '');

    if (result.status === 'APPROVED') {
      // Approval restarts the request's expiry; keep the cookie alive to match.
      const { expiresAt, ...body } = result;
      res.cookie(RESET_TOKEN_COOKIE, cookieToken, { ...RESET_TOKEN_COOKIE_OPTIONS, expires: expiresAt });
      return body;
    }

    if (result.status === 'EXPIRED' && cookieToken) {
      res.clearCookie(RESET_TOKEN_COOKIE, RESET_TOKEN_COOKIE_OPTIONS);
    }

    return result;
  }

  @Post('password-reset/confirm')
  confirmReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(dto);
  }

  @Post('password-change')
  @UseGuards(JwtAuthGuard)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: any) {
    return this.authService.changePassword(user.id, dto.newPassword);
  }
}
