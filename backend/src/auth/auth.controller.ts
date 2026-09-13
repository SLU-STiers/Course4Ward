import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
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
  requestReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    return this.authService.requestPasswordReset(dto, req.ip);
  }

  @Get('password-reset/status')
  passwordResetStatus(@Query('resetToken') resetToken: string) {
    return this.authService.getPasswordResetStatus(resetToken);
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
