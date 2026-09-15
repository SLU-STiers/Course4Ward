import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
} from './dto/reset-password.dto';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip);
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

    if (resetToken) {
      res.cookie('resetToken', resetToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 1000,
      });
    }

    return resetToken
      ? { message: 'Reset request submitted for administrator approval.' }
      : {
          message:
            'If the user ID exists, a reset request has been submitted for administrator approval.',
        };
  }

  @Get('password-reset/status')
  passwordResetStatus(@Req() req: Request) {
    const cookieToken = req.headers.cookie
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('resetToken='))
      ?.split('=')
      .slice(1)
      .join('=');

    return this.authService.getPasswordResetStatus(cookieToken ?? '');
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
